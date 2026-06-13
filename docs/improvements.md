# Code Quality Improvements

Sorted by impact × effort. High-impact / low-effort items first. Each item references the affected file(s).

---

## Wave 1 — No-risk, standalone (< 1 day each)

These are safe, isolated changes with zero behavior impact. Do these incrementally.

- [x] **[DRY/SSOT] Derive `NodeType` from schema** — `src/lib/types.ts:27`, `src/lib/schemas.ts:205`
      Delete the manual string-union and replace with `export type NodeType = NodeData["type"]`. Eliminates a sync risk with no behavior change.

- [x] **[Boy Scout] Type `cleanNode` in `use-flow-store.ts`** — `src/lib/store/use-flow-store.ts:1`
      Remove the file-wide `/* eslint-disable @typescript-eslint/no-explicit-any */` by typing `node` as `Node<NodeData>` in the `partialize` helper.

- [x] **[POLA/LoD] Make `executionResults` private, add `getResult()` accessor** — `src/lib/workflow-engine.ts:164`
      Replace the public `executionResults` map with a `getResult(nodeId: string)` method. Callers (sub-workflow executor) currently reach directly into the map.

- [x] **[ISP] Remove index signatures from `CanvasImageData` / `CanvasVideoData`** — `src/lib/canvas/types.ts:22,47`
      Audit which ad-hoc keys are set at runtime, promote them to proper optional fields, then delete `[key: string]: unknown`.

- [x] **[DRY] Centralize `MediaRef` type** — `src/lib/types.ts:58`, `src/lib/schemas.ts:260`, `src/lib/services/gemini.service.ts:66`
      Declare `export interface MediaRef { url: string; type: string }` once in `types.ts`. The shape is repeated at least 8 times with no shared name.

- [x] **[DRY] Centralize `isGcsUri` predicate** — `src/lib/services/gemini.service.ts:144`, `src/lib/canvas/generation.ts`, `src/lib/nodes/shared/node-helpers.ts:144`
      `url.startsWith("gs://")` is scattered across three modules. Move to `src/lib/utils/gcs-uri.ts` (file already exists).

---

## Wave 2 — Legacy phaseout (1–2 PRs, do together)

All of these are resolved in one migration: extract shared types → deprecate `streamAgentResponse` → delete legacy code.

- [x] **[Boy Scout → SoC] Extract shared types out of `agent.ts`** — `src/lib/canvas/agent.ts`, `src/lib/canvas/adk/runner.ts:37`
      Move `AgentEvent`, `AgentInput`, `MediaDefaults`, `VideoDefaults`, and `applyVideoFallback` into `src/lib/canvas/types.ts`.
      Update all imports. This severs the backward dependency (new ADK code imports from old legacy file).

- [x] **[SoC] Delete `streamAgentResponse` and `AGENT_SCHEMA` from `agent.ts`**
      Mark as `@deprecated` first, then delete once the route handler no longer references it.
      Also removes the duplicate `SYSTEM_PROMPT` and `buildStyleInstruction`/`getModeInstruction` definitions.

_Resolves: DRY §1.2, SoC §3.2+3.3, POLA §4.3, SSOT §5.2, ADP §9.1_

---

## Wave 3 — WorkflowEngine refactor (design first, then implement)

These are related — tackle together to avoid multiple passes over `workflow-engine.ts`.

- [x] **[SRP/DIP] Extract `saveToLibrary` out of `WorkflowEngine`** — `src/lib/workflow-engine.ts:396`
      `WorkflowEngine` currently builds `LibraryAssetProvenance`, makes HTTP calls to `/api/library`, and branches on node type. This belongs in the route handler. Inject as a callback: `onMediaGenerated?: (node, result) => void` via `ExecutionContext`.

- [x] **[DIP] Remove concrete infrastructure imports from `WorkflowEngine`** — `src/lib/workflow-engine.ts:12`
      `fetchAndCacheSignedUrl` and `fetch("/api/library", ...)` are hardcoded. Add `onMediaSaved?` and `signedUrlPrefetch?` hooks to `ExecutionContext`. Leave implementations to callers (route handlers).

- [x] **[POLA] Rename or document `executeNode`'s hidden side effect** — `src/lib/workflow-engine.ts:250`
      `executeNode` silently traverses the graph and runs upstream routers, while `run()` calls `executeNodeSync` directly (bypassing this). Rename to `executeNodeWithRouterResolution` or document the divergence prominently.

- [x] **[LoD] Add `getOutputs()` to `WorkflowEngine`** — `src/lib/workflow-engine.ts:688`
      `executeSubWorkflow` currently reaches into `subEngine.executionResults.get(outNode.id)`. A `getOutputs(outputNodeIds: string[])` method would remove this coupling and is a natural extension of the `getResult()` accessor above.

- [x] **[KISS] Replace recursive `runNext` concurrency pool** — `src/lib/workflow-engine.ts:310`
      The tail-recursive Promise pool is clever but non-obvious. Replace with an explicit `while` loop and a fixed-size worker set (or an `async-pool` utility).

_Resolves: SRP §2.1, DIP §2.4, POLA §4.1, LoD §6.1, KISS §7.2_

---

## Wave 3 (cont.) — NodeDefinition extension points

- [x] **[OCP] Add `getSourcePortType` hook to `NodeDefinition`** — `src/lib/node-registry.ts:40`
      `getSourcePortType` has a chain of `if (node.data.type === ...)` checks that must be modified for every new node type. Add an optional `getSourcePortType?(node, handleId): string` to `NodeDefinition`, then make the central function a dispatcher with a fallback.

- [x] **[OCP] Add `mergeBatchResults` hook to `NodeDefinition`** — `src/lib/workflow-engine.ts:96`
      Same pattern: `switch (nodeType)` must be extended for each batch-capable node. Add `mergeBatchResults?(results: Partial<T>[]): Partial<T>` to `NodeDefinition`. Default: return `results[0]`.

- [x] **[KISS] Decompose `getSourceValue`** — `src/lib/nodes/shared/node-helpers.ts:80`
      The function does envelope unwrapping, `workflow-input` port logic, strategy dispatch, and multi-property fallback in one body. Split into `unwrapEnvelope(data)` and `extractWorkflowInputValue(data)`, then delegate to `VALUE_STRATEGIES`.

_Resolves: OCP §2.2+2.3, KISS §7.1_

---

## Wave 4 — Type cleanup (low urgency)

- [x] **[SSOT] Consolidate `types.ts` / `schemas.ts` re-export layer** — `src/lib/types.ts:1`
      `types.ts` imports all Zod-inferred types from `schemas.ts` under aliased names, then re-exports them under their original names. Either own types only in `schemas.ts` and make `types.ts` a pure extension file, or move all Zod inference into `types.ts` and remove schema-level type exports.

- [ ] **[ISP] Narrow `NodeInputs` interface** — `src/lib/types.ts:55`
      The `[key: string]: unknown` index signature defeats type safety. Most `gatherInputs` implementations use only 2–3 fields. Remove the index signature and narrow per-node via the typed `I` parameter that `NodeDefinition<T, I>` already supports.

- [x] **[DIP] Inject services into `executePlan`** — dead step functions removed; `executePlan` now uses primitive registry exclusively — `src/lib/canvas/generation.ts:3`
      `geminiService`, `storageService`, and `libraryService` are imported as module-level singletons. Passing them through the existing `ExecutionContext` parameter would make dependencies explicit and injectable for testing.

_Resolves: SSOT §5.1, ISP §2.6, DIP §2.5_
