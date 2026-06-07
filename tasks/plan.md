# Implementation Plan: Canvas Media Agent (Director Architecture)

## Overview

Migrate the canvas chat agent from a single `LlmAgent` to the Director architecture described in `docs/media_agent/design.md`. The work is gated behind the existing `agentVariant: "b"` toggle, so Agent A (current) stays untouched throughout. Phase 1 delivers a testable Director via the toggle. Phase 2 adds PromptEngineer to the execute-plan path. Phase 3 adds DAG-aware execution.

## Architecture Decisions

- **Agent B = Director**: `buildAgentB` in `runner.ts` becomes the Director. Zero risk to Agent A.
- **New types are additive**: `ProductionPlan`/`PlanNode`/`PlanEdge` are new; existing `AgentPlan`/`GenerationStep` survive unchanged for Agent A compatibility.
- **execute-plan stays flat for Phase 1**: the Director emits nodes in the same `GenerationStep[]` shape Agent A uses, so no execute-plan changes are needed until Phase 2.
- **SkillToolset loaded per-request**: skills are small markdown files; loading them per-request avoids stale-cache issues during development.

## Dependency Graph

```
Task 1: Types (ProductionPlan, PlanNode, PlanEdge, MediaOperation)
    │
    ├── Task 2: plan_production tool (Zod schema uses new types)
    │       │
    │       ├── Task 3: Skill files (SKILL.md content — no code dep, parallel)
    │       │
    │       └── Task 4: Director agent in buildAgentB (uses tool + SkillToolset)
    │               │
    │               └── Task 5: extractAgentEvents handles plan_production
    │                       │
    │                       └── CHECKPOINT A — Agent B testable in UI
    │
    └── Task 6: PromptEngineer agent (uses types from Task 1)
            │
            └── Task 7: execute-plan calls PromptEngineer per node
                    │
                    └── CHECKPOINT B — execution uses enriched prompts
                            │
                            └── Task 8: Topological sort utility
                                    │
                                    └── Task 9: execute-plan DAG execution
                                            │
                                            └── Task 10: derivedFrom on canvas nodes
                                                    │
                                                    └── CHECKPOINT C — DAG plans execute correctly
```

---

## Phase 1: Director as Agent B

### Task 1: Extend shared types for the production plan

**Description:** Add `ProductionPlan`, `PlanNode`, `PlanEdge`, `MediaOperation`, `EdgeRole`, and `ResolvedPlanNode` to `src/lib/canvas/types.ts`. These coexist with the existing `AgentPlan` / `GenerationStep` types — no removal.

**Acceptance criteria:**

- [ ] `MediaOperation` union covers all operations from the design (`t2i | i2i | t2v | i2v | i2v2 | t2s | t2m | sfx | concat | edit | upscale`)
- [ ] `PlanNode` has `promptIntent: string` (plain-language intent) and `prompt?: string` (filled by PromptEngineer)
- [ ] `PlanEdge` has `from`, `to`, `role: EdgeRole`
- [ ] `ProductionPlan` has `nodes: PlanNode[]`, `edges: PlanEdge[]`, `clarifications?: string[]`
- [ ] `ResolvedPlanNode` extends `PlanNode` with `prompt: string` (non-optional)
- [ ] TypeScript compiles without errors: `npx tsc --noEmit`

**Verification:**

- [ ] `npx tsc --noEmit` — clean

**Dependencies:** None

**Files likely touched:**

- `src/lib/canvas/types.ts`

**Estimated scope:** S

---

### Task 2: Add plan_production tool

**Description:** Add `planProductionTool` to `src/lib/canvas/adk/tools.ts`. The tool schema accepts `nodes: PlanNode[]` and `edges: PlanEdge[]`, using the Zod schemas that mirror the new types. Keep the existing `planImageGenerationTool`, `planVideoGenerationTool`, and `suggestActionsTool` — they are still used by Agent A.

**Acceptance criteria:**

- [ ] `planProductionTool` is exported from `tools.ts`
- [ ] Schema validates `operation` against the `MediaOperation` union
- [ ] Schema accepts `promptIntent` (required) and `prompt` (optional)
- [ ] Schema accepts `edges[]` with `from`, `to`, `role`
- [ ] Schema accepts optional `clarifications: string[]`
- [ ] TypeScript compiles without errors

**Verification:**

- [ ] `npx tsc --noEmit` — clean

**Dependencies:** Task 1

**Files likely touched:**

- `src/lib/canvas/adk/tools.ts`

**Estimated scope:** S

---

### Task 3: Write initial skill files

**Description:** Create the `src/lib/canvas/adk/skills/` directory and write four `SKILL.md` files following the agentskills.io standard: three primitives (`t2i`, `i2v`, `t2s`) and one pattern (`virtual-tryon`). Each file has valid YAML frontmatter (`name`, `description`, `metadata.type`) and a markdown body with prompting best practices or workflow steps.

**Acceptance criteria:**

- [ ] Each `SKILL.md` has valid frontmatter: `name` (kebab-case, matches directory), `description` (≤1024 chars), `metadata.type` (`primitive` or `pattern`)
- [ ] Primitive skills (`t2i`, `i2v`, `t2s`) contain: prompting conventions, common failures, model hints
- [ ] Pattern skill (`virtual-tryon`) contains: trigger condition, quality checks, ordered steps with operation tags, dependencies, common failures
- [ ] ADK can load them: `loadAllSkillsInDir("src/lib/canvas/adk/skills")` resolves without error (manual test in a script)

**Verification:**

- [ ] Manual: run a small Node script calling `loadAllSkillsInDir` and log the result

**Dependencies:** None (parallel with Tasks 1–2)

**Files likely touched:**

- `src/lib/canvas/adk/skills/t2i/SKILL.md` (new)
- `src/lib/canvas/adk/skills/i2v/SKILL.md` (new)
- `src/lib/canvas/adk/skills/t2s/SKILL.md` (new)
- `src/lib/canvas/adk/skills/virtual-tryon/SKILL.md` (new)

**Estimated scope:** S

---

### Task 4: Build the Director as Agent B

**Description:** Rewrite `buildAgentB` in `runner.ts` to instantiate the Director. This means: a new system prompt (`DIRECTOR_PROMPT`), loading skills via `loadAllSkillsInDir` + `SkillToolset`, and using `[planProductionTool, suggestActionsTool, skillToolset]` as tools. Add `buildDirectorInstruction(canvasContext, activeStyle)` to assemble the prompt with canvas context and active style injected.

**Acceptance criteria:**

- [ ] `buildAgentB` instantiates a `LlmAgent` named `"Director"` with the Director prompt
- [ ] `SkillToolset` is passed as a tool — Director has `list_skills` / `load_skill` available
- [ ] Director prompt includes `PRIMITIVES` list, canvas context, and active style slots
- [ ] `planProductionTool` and `suggestActionsTool` are in the Director's tool list
- [ ] `buildAgentA` is unchanged
- [ ] TypeScript compiles without errors

**Verification:**

- [ ] `npx tsc --noEmit` — clean
- [ ] `agentVariant: "a"` still calls `buildAgentA` (regression check)

**Dependencies:** Tasks 1, 2, 3

**Files likely touched:**

- `src/lib/canvas/adk/runner.ts`

**Estimated scope:** M

---

### Task 5: Handle plan_production in extractAgentEvents

**Description:** Add a `case "plan_production"` branch to `extractAgentEvents` in `runner.ts`. Map the Director's `PlanNode[]` output to the existing `GenerationStep[]` shape (using `promptIntent` as the prompt for now, until the PromptEngineer is wired in Phase 2), so the current execute-plan route works without changes.

**Acceptance criteria:**

- [ ] `extractAgentEvents` recognises `plan_production` function calls
- [ ] Each `PlanNode` with `operation: "t2i" | "i2i"` maps to `GenerationStep` with `type: "image"`
- [ ] Each `PlanNode` with `operation: "t2v" | "i2v" | "i2v2"` maps to `type: "video"`
- [ ] Unsupported operations (`t2s`, `concat`, etc.) are skipped with a warning log
- [ ] Edges are ignored at this stage (Phase 3 wires them)
- [ ] Existing `plan_image_generation` / `plan_video_generation` handling is untouched

**Verification:**

- [ ] `npx tsc --noEmit` — clean
- [ ] Manual: send a chat message with `agentVariant: "b"`, verify a plan is returned

**Dependencies:** Tasks 1, 2, 4

**Files likely touched:**

- `src/lib/canvas/adk/runner.ts`

**Estimated scope:** S

---

### Checkpoint A: Agent B testable end-to-end

- [ ] TypeScript builds clean: `npx tsc --noEmit`
- [ ] Agent A (`agentVariant: "a"`) still works: send a chat message, receive a plan, execute it
- [ ] Agent B (`agentVariant: "b"`): send a chat message, Director calls `list_skills`, loads a relevant skill, emits a `plan_production` call, plan appears in the UI
- [ ] User can click Proceed and execution completes (using `promptIntent` as the prompt)
- [ ] **Human review before proceeding to Phase 2**

---

## Phase 2: PromptEngineer in execute-plan

### Task 6: PromptEngineer agent

**Description:** Create `src/lib/canvas/adk/prompt-engineer.ts`. Export `runPromptEngineer(node, primitiveSkill, activeStyle)` — an async function that instantiates a `LlmAgent` named `"PromptEngineer"`, runs it once with the node's `promptIntent`, and returns `{ prompt: string, negativePrompt?: string, resolvedParams: MediaParams }`. The agent has no tools and no session; it is a single-turn call.

**Acceptance criteria:**

- [ ] `runPromptEngineer` accepts a `PlanNode` (or `GenerationStep`), a `Skill | undefined`, and `activeStyle`
- [ ] Returns `{ prompt: string, negativePrompt?: string, resolvedParams: MediaParams }`
- [ ] If the primitive skill is absent, falls back to using `promptIntent` as the prompt (graceful degradation)
- [ ] Active style's negative constraints are reflected in `negativePrompt` when the model supports it
- [ ] TypeScript compiles without errors

**Verification:**

- [ ] `npx tsc --noEmit` — clean
- [ ] Manual: call `runPromptEngineer` with a test node and log the output

**Dependencies:** Tasks 1, 3

**Files likely touched:**

- `src/lib/canvas/adk/prompt-engineer.ts` (new)

**Estimated scope:** M

---

### Task 7: Wire PromptEngineer into execute-plan route

**Description:** In `src/app/api/canvases/[id]/execute-plan/route.ts`, before calling `executePlan` for each step, call `runPromptEngineer` to enrich the step's prompt. Load the primitive skill matching the step's operation from the skills directory and pass it in. Replace `step.prompt` with the PromptEngineer's output before handing the step to `executePlan`.

**Acceptance criteria:**

- [ ] Each step's `prompt` is replaced with PromptEngineer output before execution
- [ ] If PromptEngineer fails (throws), the original `promptIntent` / `prompt` is used as fallback and a warning is logged — execution is not blocked
- [ ] Active style is passed to PromptEngineer
- [ ] Existing `executePlan` function signature is unchanged

**Verification:**

- [ ] `npx tsc --noEmit` — clean
- [ ] Manual: execute a plan via Agent B, confirm the executed prompt is richer than the raw `promptIntent`

**Dependencies:** Tasks 5, 6

**Files likely touched:**

- `src/app/api/canvases/[id]/execute-plan/route.ts`

**Estimated scope:** S

---

### Checkpoint B: PromptEngineer enriching executions

- [ ] TypeScript builds clean
- [ ] Agent B end-to-end: plan → approve → execute uses PromptEngineer-enriched prompts
- [ ] Agent A unaffected (PromptEngineer only runs when a `plan_production`-derived plan is executed)
- [ ] PromptEngineer failure falls back gracefully — no broken executions
- [ ] **Human review before proceeding to Phase 3**

---

## Phase 3: DAG execution

### Task 8: Topological sort utility

**Description:** Create `src/lib/canvas/adk/topology.ts` exporting `topoSort(nodes: PlanNode[], edges: PlanEdge[]): PlanNode[][]` — returns nodes grouped by execution level (nodes in the same level have no dependencies on each other and can run in parallel). Throws if a cycle is detected.

**Acceptance criteria:**

- [ ] Returns `PlanNode[][]` where each inner array is a parallel batch
- [ ] Nodes with no incoming edges are in level 0
- [ ] A node N is in level K where K = max(level of all dependencies) + 1
- [ ] Throws a descriptive error if a cycle exists
- [ ] Works correctly with zero edges (returns all nodes in a single level)

**Verification:**

- [ ] Unit tests cover: linear chain, parallel nodes, diamond dependency, cycle detection
- [ ] `npx tsc --noEmit` — clean

**Dependencies:** Task 1

**Files likely touched:**

- `src/lib/canvas/adk/topology.ts` (new)
- `src/lib/canvas/adk/topology.test.ts` (new)

**Estimated scope:** S

---

### Task 9: DAG-aware execution in execute-plan route

**Description:** Update `execute-plan/route.ts` to accept `edges: PlanEdge[]` in the request body alongside `plan.steps`. Use `topoSort` to determine execution order. Execute each topological level sequentially; within a level, run steps concurrently with `Promise.all`. Pass resolved output URIs from earlier levels to dependent steps via the existing `completedStepUris` map in `generation.ts`.

**Acceptance criteria:**

- [ ] `edges` field is accepted in the request body (optional — no edges = flat sequential, backward-compatible)
- [ ] Steps in the same topological level start concurrently
- [ ] A step with a `depends_on` edge waits for the dependency's output URI before starting
- [ ] `step_start` / `step_done` / `step_error` SSE events are emitted per step (same as today)
- [ ] A single step error does not abort the entire plan — other independent steps continue
- [ ] Without `edges`, behaviour is identical to current sequential execution

**Verification:**

- [ ] `npx tsc --noEmit` — clean
- [ ] Manual: create a 3-step plan (image → image → video with dependencies), verify correct execution order in logs

**Dependencies:** Tasks 7, 8

**Files likely touched:**

- `src/app/api/canvases/[id]/execute-plan/route.ts`
- `src/lib/canvas/generation.ts` (minor: accept resolved URIs from DAG)

**Estimated scope:** M

---

### Task 10: derivedFrom on canvas node data

**Description:** Add optional `operation: MediaOperation`, `planNodeId?: string`, `derivedFrom?: string[]`, and `skill?: string` fields to `CanvasImageData` and `CanvasVideoData` in `types.ts`. Populate these fields in `executePlan` / `executeImageNode` / `executeVideoNode` from the `PlanNode` being executed.

**Acceptance criteria:**

- [ ] `CanvasImageData` and `CanvasVideoData` accept the four new optional fields
- [ ] When a node is created from a `PlanNode`, `planNodeId` and `operation` are set
- [ ] When a node has a `depends_on` edge, `derivedFrom` contains the parent canvas node IDs
- [ ] Existing nodes without these fields remain valid (all fields are optional)
- [ ] TypeScript compiles without errors

**Verification:**

- [ ] `npx tsc --noEmit` — clean
- [ ] Manual: inspect a generated canvas node's data in the DB — `operation` and `planNodeId` are present

**Dependencies:** Tasks 1, 9

**Files likely touched:**

- `src/lib/canvas/types.ts`
- `src/lib/canvas/generation.ts`

**Estimated scope:** S

---

### Checkpoint C: DAG plans execute correctly

- [ ] TypeScript builds clean: `npx tsc --noEmit`
- [ ] Multi-step plan with dependencies executes in correct topological order
- [ ] Independent steps run concurrently (visible in logs)
- [ ] `derivedFrom` is populated on generated canvas nodes
- [ ] Agent A is fully unaffected
- [ ] **Human review: Phase 3 complete**

---

## Risks and Mitigations

| Risk                                                                    | Impact | Mitigation                                                                                |
| ----------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `SkillToolset` / `loadAllSkillsInDir` API differs from type definitions | High   | Verify against ADK source before Task 4; write a small test script                        |
| Director produces `plan_production` calls inconsistently                | Medium | Start with a simple prompt; iterate on the Director instruction without code changes      |
| PromptEngineer adds latency per node                                    | Medium | Phase 2 introduces it; measure latency and decide if it's acceptable before Phase 3       |
| `topoSort` edge cases (disconnected subgraphs)                          | Low    | Cover in unit tests in Task 8 before wiring into the route                                |
| Concurrent step execution causes race conditions in the SSE stream      | Medium | Test with a 3+ node parallel plan in Task 9; use individual try/catch per concurrent step |

## Open Questions

- Should the Director session persist across turns (full conversation history) or reset per intent? Currently Agent A persists — confirm this is desired for Agent B too.
- Should `runPromptEngineer` use the same Gemini model as the Director, or a smaller/faster model (e.g. Flash Lite)?
- Phase 3 runs steps concurrently — does the current SSE stream (single controller) handle concurrent `controller.enqueue` calls safely in Next.js?
