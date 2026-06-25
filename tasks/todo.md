# Flowcraft Extensibility Phase B Tasks

## Phase 1: Database & Services (Foundation)

- [x] **Task 1: Constants & Type Definitions**
    - _Files_: [constants.ts](file:///Users/mblanc/projects/flowcraft/src/lib/constants.ts), [types.ts](file:///Users/mblanc/projects/flowcraft/src/lib/canvas/types.ts), [skill-types.ts](file:///Users/mblanc/projects/flowcraft/src/lib/canvas/agent/skills/skill-types.ts) [NEW]
    - _Verify_: `bun run check`
- [x] **Task 2: Skill CRUD Service**
    - _Files_: [skill.service.ts](file:///Users/mblanc/projects/flowcraft/src/lib/services/skill.service.ts) [NEW]
    - _Verify_: `bun run check`
- [x] **Task 3: Service Unit Tests**
    - _Files_: [skill.service.test.ts](file:///Users/mblanc/projects/flowcraft/src/__tests__/unit/lib/services/skill.service.test.ts) [NEW]
    - _Verify_: `bun run test src/__tests__/unit/lib/services/skill.service.test.ts`

### Checkpoint: Foundation

- [x] `bun run check` compiles clean with no errors
- [x] `bun run test` passes all skill service tests successfully

---

## Phase 2: API Endpoints

- [ ] **Task 4: CRUD API Routes**
    - _Files_: `src/app/api/skills/route.ts` [NEW], `src/app/api/skills/[id]/route.ts` [NEW], `src/app/api/skills/[id]/clone/route.ts` [NEW]
    - _Verify_: `bun run check`
- [ ] **Task 5: Canvas Skill Toggle API Route**
    - _Files_: `src/app/api/canvases/[id]/toggle-skill/route.ts` [NEW]
    - _Verify_: `bun run check`

### Checkpoint: API Layer

- [ ] All Next.js route handlers compile clean
- [ ] All unit tests pass with zero regressions

---

## Phase 3: ADK Agent & Slash Commands Integration

- [ ] **Task 6: Dynamic Skill Merging in CanvasAgent**
    - _Files_: [canvas-agent.ts](file:///Users/mblanc/projects/flowcraft/src/lib/canvas/agent/canvas-agent.ts), `src/__tests__/unit/lib/canvas/adk/canvas-agent-dynamic.test.ts` [NEW]
    - _Verify_: `bun run test src/__tests__/unit/lib/canvas/adk/canvas-agent-dynamic.test.ts`
- [ ] **Task 7: Slash Command Agent Interception**
    - _Files_: [agent-runner.ts](file:///Users/mblanc/projects/flowcraft/src/lib/canvas/agent/agent-runner.ts)
    - _Verify_: `bun run check`
- [ ] **Task 8: Integration Tests for Agent Runner & Commands**
    - _Files_: `src/__tests__/unit/lib/canvas/adk/agent-runner-slash-commands.test.ts` [NEW]
    - _Verify_: `bun run test src/__tests__/unit/lib/canvas/adk/agent-runner-slash-commands.test.ts`

### Checkpoint: Backend Complete

- [ ] All tests pass successfully
- [ ] `bun run preflight` passes with zero errors
