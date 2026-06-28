# Ruleset Validation & Policy Enforcement — Task List

## Phase 1: Foundation

- [ ] **Task 1**: Add RULESETS collection constant + Rule/Ruleset Zod schemas
    - _Files_: `src/lib/constants.ts`, `src/lib/schemas.ts`
    - _Verify_: `bun run check`
- [ ] **Task 2**: Extend canvas types — ValidationResult, StepEvent, CanvasDocument, CanvasUpdateSchema
    - _Files_: `src/lib/canvas/types.ts`, `src/lib/schemas.ts`
    - _Verify_: `bun run check`

### Checkpoint: Foundation

- [ ] `bun run check` passes
- [ ] `bun run test` passes

---

## Phase 2: Service + API

- [ ] **Task 3**: RulesetService CRUD + access control + unit tests
    - _Files_: `src/lib/services/ruleset.service.ts` [NEW], `src/__tests__/unit/lib/services/ruleset.service.test.ts` [NEW]
    - _Verify_: `bun run test src/__tests__/unit/lib/services/ruleset.service.test.ts`
- [ ] **Task 4**: Ruleset API routes (GET list, POST create, GET/PATCH/DELETE by id)
    - _Files_: `src/app/api/rulesets/route.ts` [NEW], `src/app/api/rulesets/[id]/route.ts` [NEW]
    - _Verify_: `bun run check`
- [ ] **Task 5**: Canvas service + PATCH API — read/write activeRulesetId/activeRulesetName
    - _Files_: `src/lib/services/canvas.service.ts`
    - _Verify_: `bun run check`

### Checkpoint: Service layer

- [ ] `bun run test` passes
- [ ] `bun run check` passes

---

## Phase 3: Validation engine

- [ ] **Task 6**: `validation.ts` — Gemini vision call + parser + unit tests
    - _Files_: `src/lib/canvas/validation.ts` [NEW], `src/__tests__/unit/lib/canvas/validation.test.ts` [NEW]
    - _Verify_: `bun run test src/__tests__/unit/lib/canvas/validation.test.ts`
- [ ] **Task 7**: Integrate validation into `executePlan` (ruleset context + per-step validate + retry)
    - _Files_: `src/lib/canvas/generation.ts`
    - _Verify_: `bun run check && bun run test`

### Checkpoint: Validation core

- [ ] `bun run test` passes
- [ ] `bun run check` passes

---

## Phase 4: Preventive injection

- [ ] **Task 8**: Inject ruleset into Director system prompt
    - _Files_: `src/lib/canvas/agent/canvas-agent.ts`, `src/app/api/canvases/[id]/chat/route.ts`
    - _Verify_: `bun run check`
- [ ] **Task 9**: Inject ruleset into Prompt Engineer + violation feedback on retry
    - _Files_: `src/lib/canvas/agent/prompt-engineer.ts`
    - _Verify_: `bun run check`

### Checkpoint: Injection

- [ ] `bun run preflight` passes

---

## Phase 5: UI

- [ ] **Task 10**: Ruleset editor component (name, description, rule list CRUD)
    - _Files_: `src/components/ruleset/ruleset-editor.tsx` [NEW]
    - _Verify_: `bun run check`
- [ ] **Task 11**: Ruleset list component (sidebar — my/shared/community)
    - _Files_: `src/components/ruleset/ruleset-list.tsx` [NEW]
    - _Verify_: `bun run check`
- [ ] **Task 12**: Canvas ruleset picker (attach/detach in canvas settings panel)
    - _Files_: `src/components/canvas/ruleset-picker.tsx` [NEW], `src/components/canvas/canvas-editor.tsx`
    - _Verify_: `bun run check`
- [ ] **Task 13**: Validation badges on image nodes + chat failure surface (Accept/Regenerate)
    - _Files_: `src/components/canvas/canvas-chat-panel.tsx`, canvas image node component
    - _Verify_: `bun run check`

### Checkpoint: Complete

- [ ] `bun run preflight` passes with no errors
