# Codebase Design-Principles Audit

Findings are grouped by principle and ordered by impact within each section.
Each entry names the affected file(s), describes the violation, and proposes a concrete fix.

---

## 1. DRY — Don't Repeat Yourself

### 1.1 `NodeType` union duplicates the schema discriminated union

**Files:** `src/lib/types.ts:27`, `src/lib/schemas.ts:205`

`NodeType` is a manually-maintained string-union that must stay in sync with the `NodeDataSchema` discriminated union. Adding a node requires editing both. The union is already derivable from the schema:

```ts
// types.ts
export type NodeType = NodeData["type"];
// Delete the manual union literal
```

This is the highest-confidence fix in the file: zero behaviour change, eliminates a sync risk.

---

### 1.2 `buildStyleInstruction` and `getModeInstruction` duplicated in two files

**Files:** `src/lib/canvas/agent.ts:85`, `src/lib/canvas/adk/prompts.ts`

Both files define `buildStyleInstruction` and `getModeInstruction` with identical logic. Since `agent.ts` is being phased out in favour of the ADK runner, the canonical home for these helpers is `adk/prompts.ts`. The legacy file can be deleted once the migration is complete (see §3.2).

---

### 1.3 `{ url: string; type: string }[]` repeated without a named type

**Files:** `src/lib/types.ts:58`, `src/lib/schemas.ts:260`, `src/lib/services/gemini.service.ts:66`

The shape `{ url: string; type: string }` (a media URL + MIME type pair) appears at least eight times across the codebase with no shared name. Declare it once:

```ts
// types.ts
export interface MediaRef {
    url: string;
    type: string;
}
```

---

### 1.4 GCS URI prefix check duplicated

**Files:** `src/lib/services/gemini.service.ts:144`, `src/lib/canvas/generation.ts`, `src/lib/nodes/shared/node-helpers.ts:144`

`url.startsWith("gs://")` is scattered across three modules. A tiny shared predicate `isGcsUri(url: string): boolean` in `src/lib/utils/gcs-uri.ts` (which already exists) would centralise this check.

---

## 2. SOLID

### 2.1 SRP — `WorkflowEngine` has too many reasons to change

**File:** `src/lib/workflow-engine.ts`

The `WorkflowEngine` class currently:

- Orchestrates node-level execution order (its core job)
- Runs batch fan-out with a concurrency pool
- Pre-warms the signed URL cache (`prewarmSignedUrls`)
- Saves generated media to the library (`saveToLibrary`, lines 396–467)
- Executes sub-workflows recursively

**`saveToLibrary` is the clearest violation.** It builds a `LibraryAssetProvenance` object, makes HTTP calls to `/api/library`, and contains node-type-specific branching — all business logic that has nothing to do with graph execution. The same pattern exists in `generation.ts` (which also fire-and-forgets library saves inline). Both callers should delegate to a shared `LibrarySaveHandler` or an observable callback:

```ts
// Proposed injection point
constructor(
  nodes, edges, onNodeUpdate,
  context?,
  onMediaGenerated?: (node: Node<NodeData>, result: Partial<NodeData>) => void
)
```

The pre-warming (`prewarmSignedUrls`) is also a side effect that belongs outside execution — callers should decide if and when to warm the cache.

---

### 2.2 OCP — `getSourcePortType` must be modified for every new node type

**File:** `src/lib/node-registry.ts:40`

```ts
if (node.data.type === "list") { ... }
if (node.data.type === "workflow-input") { ... }
if (node.data.type === "custom-workflow") { ... }
if (node.data.type === "llm") { ... }
if (node.data.type === "file") { ... }
```

This is an open/closed violation: adding a node with non-default port-type behaviour requires modifying a central function. The existing `NodeDefinition` interface is the right extension point — add an optional hook:

```ts
interface NodeDefinition<T, I> {
    getSourcePortType?: (node: Node<T>, handleId?: string | null) => string;
}
```

`getSourcePortType` then becomes a small dispatcher that calls the definition's hook and falls back to the current default logic. New nodes never touch this function again.

---

### 2.3 OCP — `mergeResults` switch must also be extended for new batch-capable nodes

**File:** `src/lib/workflow-engine.ts:96`

Same pattern: `switch (nodeType) { case "image": ... case "llm": ... }`. Move this into `NodeDefinition`:

```ts
interface NodeDefinition<T, I> {
    mergeBatchResults?: (results: Partial<T>[]) => Partial<T>;
}
```

Default: return `results[0]`.

---

### 2.4 DIP — `WorkflowEngine` depends on concrete infrastructure

**File:** `src/lib/workflow-engine.ts:12,396`

`WorkflowEngine` imports `fetchAndCacheSignedUrl` directly and calls `fetch("/api/library", ...)` with a hardcoded URL. Both are concrete infrastructure dependencies inside a domain-layer class. The existing `ExecutionContext` object is already the right vehicle — add `onMediaSaved?` and `signedUrlPrefetch?` hooks there, and leave the implementations to the callers (the route handlers that instantiate the engine).

---

### 2.5 DIP — `executePlan` depends on singleton services

**File:** `src/lib/canvas/generation.ts:3`

```ts
import { geminiService } from "@/lib/services/gemini.service";
import { storageService } from "@/lib/services/storage.service";
import { libraryService } from "@/lib/services/library.service";
```

All three are imported as module-level singletons. This makes the function hard to test in isolation. Passing them through an `ExecutionContext` parameter (already defined in the file at line 14) would make the dependencies explicit and injectable.

---

### 2.6 ISP — `NodeInputs` is an overly wide interface

**File:** `src/lib/types.ts:55`

Most node `gatherInputs` implementations use only two or three fields from `NodeInputs`, yet the interface declares `prompt`, `prompts`, `files`, `images`, `firstFrame`, `lastFrame`, `image`, `namedNodes`, and `[key: string]: unknown`. The index signature in particular defeats type safety. Consider splitting into narrower input shapes per node family, or at minimum remove the index signature and let nodes use their own typed `I` parameter (which `NodeDefinition<T, I>` already supports).

---

### 2.7 ISP — `CanvasImageData` / `CanvasVideoData` use escape-hatch index signatures

**File:** `src/lib/canvas/types.ts:22,47`

```ts
[key: string]: unknown;
```

Both canvas node data types carry this. It silently allows arbitrary runtime properties that the type system can't check. Audit which ad-hoc keys are actually set at runtime and add them as proper optional fields; then remove the index signatures.

---

## 3. SoC — Separation of Concerns

### 3.1 `generation.ts` mixes topology, generation, library persistence, and URL resolution

**File:** `src/lib/canvas/generation.ts`

The `executePlan` generator does four distinct things:

1. Builds execution waves (topological sort) — _scheduling_
2. Resolves reference URIs — _data resolution_
3. Calls Gemini and GCS — _generation_
4. Fire-and-forgets library saves — _persistence_

The topology and reference resolution are pure functions and already well-extracted (`topoSort`, `resolveReferences`). The library persistence is a side effect that should be handled by the caller (the route handler), consistent with the §2.1 fix.

---

### 3.2 `agent.ts` is a legacy implementation file that has become a shared type hub

**File:** `src/lib/canvas/agent.ts`

The ADK runner imports `AgentEvent`, `AgentInput`, `MediaDefaults`, `VideoDefaults` from `agent.ts`, despite `agent.ts` being the legacy (to-be-deleted) single-pass Gemini path. This creates an awkward dependency: the new code depends on the old code for its types.

**Action:** Move `AgentEvent`, `AgentInput`, `MediaDefaults`, `VideoDefaults` and `applyVideoFallback` into `src/lib/canvas/types.ts` (or a new `src/lib/canvas/agent-types.ts`). Then delete the legacy `streamAgentResponse` function and `AGENT_SCHEMA` from `agent.ts`. This severs the backward dependency and unblocks the phaseout.

---

### 3.3 `agent.ts` mixes prompt-building, API call, JSON parsing, validation, and event emission

**File:** `src/lib/canvas/agent.ts:321`

`streamAgentResponse` is ~220 lines doing all of the above. Given the planned deletion this is less urgent, but the same concern applies to the ADK `runner.ts` `stream()` method: instruction assembly, session management, event extraction, and prompt enrichment all live in one function. The prompt-enrichment step (`promptEngineer.enrichSteps`) at line 208 is already factored out cleanly — the instruction assembly could follow the same pattern.

---

## 4. POLA — Principle of Least Astonishment

### 4.1 `WorkflowEngine.executeNode` silently runs upstream routers

**File:** `src/lib/workflow-engine.ts:250`

```ts
async executeNode(nodeId: string) {
    await this.executeUpstreamRouters(nodeId); // ← hidden side effect
    return this.executeNodeSync(nodeId);
}
```

A method named `executeNode` would not be expected to recursively traverse the graph and execute other nodes. The surprise is compounded by the fact that `run()` calls `executeNodeSync` directly (bypassing this behaviour). Either rename to `executeNodeWithRouterResolution` or document the divergence prominently.

---

### 4.2 `executionResults` is public on `WorkflowEngine`

**File:** `src/lib/workflow-engine.ts:164`

```ts
public executionResults: Map<string, Partial<NodeData>> = new Map();
```

Callers (the sub-workflow executor) reach directly into this map. An accessor method `getResult(nodeId: string)` would make the contract explicit and allow the internal structure to change without touching callers.

---

### 4.3 Two parallel agent implementations for the same surface

**Files:** `src/lib/canvas/agent.ts`, `src/lib/canvas/adk/runner.ts`

Two functions (`streamAgentResponse` / `runner.stream`) that look like they do the same job but behave differently (streaming mode, multi-turn, prompt engineering) without any code-level indication of the relationship. The route handler at `src/app/api/canvases/[id]/chat/route.ts` is the only place that distinguishes them. Once the legacy path is deleted (§3.2), this confusion disappears.

---

## 5. SSOT — Single Source of Truth

### 5.1 Redundant type re-export layer in `types.ts`

**File:** `src/lib/types.ts:1`

`types.ts` imports all Zod-inferred types from `schemas.ts` under aliased names (`InferredLLMData`, etc.) then re-exports them under their original names. This creates two import paths to the same type and the aliasing adds noise. Either:

- Own the types in `schemas.ts` only and make `types.ts` a pure extension file (for non-Zod types like `ExecutionContext`, `NodeDefinition`), or
- Move all Zod inference into `types.ts` and remove the schema-level type exports.

---

### 5.2 Two canvas system prompts diverging over time

**Files:** `src/lib/canvas/agent.ts:53`, `src/lib/canvas/adk/prompts.ts`

`SYSTEM_PROMPT` is defined in both files with different content. As the ADK path evolves, the legacy prompt diverges silently. This is resolved by §3.2 (delete the legacy file).

---

## 6. Law of Demeter

### 6.1 `executeSubWorkflow` directly accesses `subEngine.executionResults`

**File:** `src/lib/workflow-engine.ts:688`

```ts
const subEngine = new WorkflowEngine(...);
await subEngine.run();
const outResult = subEngine.executionResults.get(outNode.id); // ← reach-in
```

This tightly couples the sub-workflow execution to the internal `executionResults` map. The fix from §4.2 (`getResult(nodeId)`) would resolve this naturally. Additionally, `WorkflowEngine` could expose a `getOutputs(outputNodeIds: string[])` method that returns the final mapped results, removing the caller's need to understand the internal data structure.

---

## 7. KISS — Keep It Simple

### 7.1 `getSourceValue` has deeply nested unwrapping logic

**File:** `src/lib/nodes/shared/node-helpers.ts:80`

The function has a `while` loop that unwraps `{ value: ... }` envelopes, then special-cases `workflow-output`, then special-cases `workflow-input` with four `portType` branches, then delegates to `VALUE_STRATEGIES`, then falls back through a five-property OR chain, then handles the case where the whole object might be the value. This is doing too much in one function. Breaking it into:

- `unwrapEnvelope(data)` — strips `{ value: ... }` layers
- `extractWorkflowInputValue(data)` — handles the `workflow-input` port logic
- Then delegate to `VALUE_STRATEGIES`

…would make each concern independently testable and readable.

---

### 7.2 Batch execution uses a recursive `runNext` closure

**File:** `src/lib/workflow-engine.ts:310`

```ts
const runNext = async (): Promise<void> => {
    const i = indices.shift();
    if (i === undefined) return;
    // ... execute ...
    return runNext(); // ← tail-recursive via Promise
};
await Promise.all(Array.from({ length: BATCH_CONCURRENCY }, runNext));
```

This is a clever concurrency pool but not obviously correct at a glance. An `async-pool`-style utility (or a simple explicit queue using a `while` loop and `Promise.all` on a fixed-size worker set) would make the intent clearer without the recursive pattern.

---

### 7.3 Step-building spread chains in `streamAgentResponse`

**File:** `src/lib/canvas/agent.ts:406`

The step construction block uses five-deep conditional spreads (`...(isVideo && (s.duration ?? ...) ? { duration: ... } : {})`) that are hard to read and easy to get wrong. This is moot once the function is deleted, but the same pattern should be avoided in step-mapping code elsewhere.

---

## 8. Boy Scout Rule

### 8.1 `agent.ts` has accrued unrelated responsibilities

**File:** `src/lib/canvas/agent.ts`

Since it's being phased out, the most productive "leave it cleaner" action is to start the migration now: extract the four shared types (`AgentEvent`, `AgentInput`, `MediaDefaults`, `VideoDefaults`) and `applyVideoFallback` into `types.ts`, update imports, then mark `streamAgentResponse` as `@deprecated`. This leaves the deletion as a clean, low-risk final step.

---

### 8.2 `eslint-disable` suppression at the top of `use-flow-store.ts`

**File:** `src/lib/store/use-flow-store.ts:1`

```ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
```

File-wide disables suppress useful warnings everywhere in the file. The `no-explicit-any` use is in `partialize`'s `cleanNode` helper — typing `node` as `Node<NodeData>` with a destructure removes the need for the suppression.

---

## 9. ADP — Acyclic Dependencies

### 9.1 ADK runner depends on legacy `agent.ts` for its type definitions

**Files:** `src/lib/canvas/adk/runner.ts:37`, `src/lib/canvas/agent.ts`

```ts
import type { AgentEvent, AgentInput } from "../agent";
```

The new ADK code imports types from the legacy implementation file. This is a soft cycle in terms of intent (new code depends on old code's types). Resolution is the same as §3.2: move the types, then the import arrow flips to point in the right direction (or disappears with the legacy file).

---

## Summary Table

| #   | Principle  | File(s)                  | Impact | Effort                 |
| --- | ---------- | ------------------------ | ------ | ---------------------- |
| 1.1 | DRY / SSOT | `types.ts`               | Medium | Low                    |
| 1.2 | DRY        | `agent.ts`, `prompts.ts` | Medium | Low (resolved by §3.2) |
| 1.3 | DRY        | Multiple                 | Low    | Low                    |
| 1.4 | DRY        | Multiple                 | Low    | Low                    |
| 2.1 | SRP        | `workflow-engine.ts`     | High   | Medium                 |
| 2.2 | OCP        | `node-registry.ts`       | High   | Medium                 |
| 2.3 | OCP        | `workflow-engine.ts`     | Medium | Medium                 |
| 2.4 | DIP        | `workflow-engine.ts`     | High   | Medium                 |
| 2.5 | DIP        | `generation.ts`          | Medium | Low                    |
| 2.6 | ISP        | `types.ts`               | Medium | Medium                 |
| 2.7 | ISP        | `canvas/types.ts`        | Medium | Low                    |
| 3.1 | SoC        | `generation.ts`          | Medium | Low                    |
| 3.2 | SoC / DRY  | `agent.ts`               | High   | Medium                 |
| 3.3 | SoC        | `agent.ts`, `runner.ts`  | Low    | — (resolved by §3.2)   |
| 4.1 | POLA       | `workflow-engine.ts`     | Medium | Low                    |
| 4.2 | POLA / LoD | `workflow-engine.ts`     | Medium | Low                    |
| 4.3 | POLA       | `agent.ts`, `runner.ts`  | Medium | — (resolved by §3.2)   |
| 5.1 | SSOT       | `types.ts`, `schemas.ts` | Medium | Low                    |
| 5.2 | SSOT       | `agent.ts`, `prompts.ts` | Medium | — (resolved by §3.2)   |
| 6.1 | LoD        | `workflow-engine.ts`     | Medium | Low                    |
| 7.1 | KISS       | `node-helpers.ts`        | Medium | Medium                 |
| 7.2 | KISS       | `workflow-engine.ts`     | Low    | Low                    |
| 8.1 | Boy Scout  | `agent.ts`               | High   | Low                    |
| 8.2 | Boy Scout  | `use-flow-store.ts`      | Low    | Low                    |
| 9.1 | ADP        | `runner.ts`, `agent.ts`  | Medium | — (resolved by §3.2)   |

---

## Suggested Sequencing

**Wave 1 — no-risk, standalone (< 1 day each)**

- 1.1 Derive `NodeType` from schema
- 2.7 Remove index signatures from `CanvasImageData`/`CanvasVideoData`
- 4.2 Make `executionResults` private, add `getResult()` accessor
- 8.2 Type `cleanNode` properly in `use-flow-store.ts`
- 1.3 + 1.4 Centralise `MediaRef` type and `isGcsUri` predicate

**Wave 2 — legacy phaseout (1–2 PRs)**

- 8.1 → 3.2 → 9.1 → 1.2 → 4.3 → 5.2 (all resolved as one migration: extract shared types, deprecate `streamAgentResponse`, delete legacy code)

**Wave 3 — engine refactor (design first)**

- 2.1 + 2.4 + 4.1 + 6.1 + 7.2 (WorkflowEngine cleanup: remove SRP violations, inject infrastructure hooks, clean up public surface)
- 2.2 + 2.3 (add `getSourcePortType` + `mergeBatchResults` to `NodeDefinition`)
- 7.1 (decompose `getSourceValue`)

**Wave 4 — type cleanup**

- 5.1 (consolidate schema/types re-export layers)
- 2.6 (narrow `NodeInputs`)
