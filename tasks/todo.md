# Task List: Canvas Media Agent (Director Architecture)

## Phase 1: Director as Agent B

- [ ] **Task 1** — Extend shared types (`ProductionPlan`, `PlanNode`, `PlanEdge`, `MediaOperation`, `EdgeRole`, `ResolvedPlanNode`) in `src/lib/canvas/types.ts`
- [ ] **Task 2** — Add `planProductionTool` to `src/lib/canvas/adk/tools.ts`
- [ ] **Task 3** — Write skill files: `t2i`, `i2v`, `t2s` (primitives) + `virtual-tryon` (pattern) under `src/lib/canvas/adk/skills/`
- [ ] **Task 4** — Rewrite `buildAgentB` in `runner.ts` as the Director with `SkillToolset`, `planProductionTool`, `suggestActionsTool`
- [ ] **Task 5** — Handle `plan_production` in `extractAgentEvents`, mapping `PlanNode[]` → `GenerationStep[]`

**Checkpoint A** — Agent B testable end-to-end via `agentVariant: "b"` toggle

## Phase 2: PromptEngineer in execute-plan

- [x] **Task 6** — Create `src/lib/canvas/adk/prompt-engineer.ts` with `runPromptEngineer(node, primitiveSkill, activeStyle)`
- [x] **Task 7** — Wire `runPromptEngineer` into `src/app/api/canvases/[id]/execute-plan/route.ts` before each step executes

**Checkpoint B** — Agent B end-to-end uses PromptEngineer-enriched prompts

## Phase 3: DAG execution

- [x] **Task 8** — Create `src/lib/canvas/adk/topology.ts` with `topoSort(nodes, edges): PlanNode[][]` + unit tests
- [x] **Task 9** — DAG-aware execution already handled: runner maps PlanEdges → GenerationStep.dependsOn; generation.ts uses buildExecutionWaves + Promise.allSettled per wave
- [x] **Task 10** — Add `operation`, `planNodeId`, `derivedFrom`, `skill` fields to `CanvasImageData` / `CanvasVideoData` in `types.ts` and populate in execution

**Checkpoint C** — Multi-step DAG plans execute in correct topological order with lineage tracking
