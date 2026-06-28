# Implementation Plan: Ruleset Validation & Policy Enforcement

## Overview

Build rulesets as a first-class library asset that attaches to canvases and validates every image generation via a single Gemini vision call. Failures retry (Prompt Engineer only) or surface inline in chat. Preventive injection seeds the Director and Prompt Engineer before generation.

## Architecture Decisions

- **Validation resolves ruleset once** — loaded at the top of `executePlan`, stored in `ExecutionContext`, never fetched per step.
- **Retry is prompt-only** — Director plan is never re-run; only `PromptEngineer.engineerPrompt` gets called again with violation feedback appended to its input string.
- **`validation.ts` is pure** — takes a GCS URI + `RulesetDocument`; no Firestore, no generation infra. Retry orchestration lives in `generation.ts`.
- **Gemini vision** uses `MODELS.TEXT.GEMINI_3_5_FLASH` with inline image bytes (fetch via signed URL).
- **Canvas PATCH is already wired** — we just extend `CanvasUpdateSchema` with two optional nullable fields; `CanvasService.updateCanvas` passes them through automatically.
- **No new Zustand slice** — `activeRulesetId` / `activeRulesetName` are additional fields on the existing canvas document object returned from Firestore.

## Dependency Graph

```
Task 1: Constants + Schemas
      │
      ▼
Task 2: Canvas type extensions (ValidationResult, StepEvent, CanvasDocument)
      │
      ├──► Task 3: RulesetService (CRUD + access control)
      │           │
      │           ├──► Task 4: Ruleset API routes
      │           └──► Task 5: Canvas service + PATCH API extensions
      │
      └──► Task 6: validation.ts (Gemini vision call + parser)
                  │
                  ▼
            Task 7: generation.ts integration (ruleset context + validate step)
                  │
                  ├──► Task 8: Director preventive injection
                  └──► Task 9: Prompt Engineer injection + retry feedback
                              │
                              ▼
                        Task 10: Ruleset editor UI
                        Task 11: Ruleset list UI (sidebar)
                        Task 12: Canvas ruleset picker UI
                        Task 13: Validation badges + chat failure surface UI
```

## Task List

### Phase 1: Foundation

#### Task 1: Constants + Schemas

Add `RULESETS: "rulesets"` to `COLLECTIONS`. Add `RuleSchema`, `RulesetSchema`, `CreateRulesetSchema`, `UpdateRulesetSchema` to `src/lib/schemas.ts`. Export inferred types.

**Acceptance criteria:**

- `COLLECTIONS.RULESETS === "rulesets"`
- `RuleSchema` validates `{ id, description, severity, failureStrategy, maxRetries? }`
- `CreateRulesetSchema` omits `id` and `userId`; `UpdateRulesetSchema` makes all fields partial
- `bun run check` passes

**Verification:** `bun run check`
**Files:** `src/lib/constants.ts`, `src/lib/schemas.ts`
**Scope:** XS

#### Task 2: Canvas type extensions

Add `ValidationResult` type and `activeRulesetId?`/`activeRulesetName?` to `CanvasDocument` in `src/lib/canvas/types.ts`. Extend `step_done` in `StepEvent` union to carry `validationResults?: ValidationResult[]`. Add `activeRulesetId`/`activeRulesetName` optional nullable fields to `CanvasUpdateSchema` in `src/lib/schemas.ts`.

**Acceptance criteria:**

- `ValidationResult` has `{ ruleId, ruleDescription, severity, status, reason }`
- `step_done` event type includes `validationResults?: ValidationResult[]`
- `CanvasDocument` has `activeRulesetId?: string` and `activeRulesetName?: string`
- `CanvasUpdateSchema` accepts `activeRulesetId: z.string().nullable().optional()` and same for `activeRulesetName`
- `bun run check` passes

**Verification:** `bun run check`
**Files:** `src/lib/canvas/types.ts`, `src/lib/schemas.ts`
**Scope:** XS
**Dependencies:** Task 1

### Checkpoint: Foundation

- [ ] `bun run check` passes with no errors
- [ ] `bun run test` passes

---

### Phase 2: Service + API layer

#### Task 3: RulesetService

Create `src/lib/services/ruleset.service.ts`. Class follows the exact `StyleService` pattern: `private firestore`, `transformDoc`, typed error classes. Methods: `listRulesets(userId, userEmail?, tab)`, `getRuleset(id, userId, userEmail?)`, `createRuleset(userId, data)`, `updateRuleset(id, userId, data)`, `deleteRuleset(id, userId)`. Export `rulesetService` singleton.

Also write unit tests in `src/__tests__/unit/lib/services/ruleset.service.test.ts` covering: list tabs, get (owner/shared/forbidden), create, update (owner/editor/forbidden), delete.

**Acceptance criteria:**

- `getRuleset` throws `RulesetNotFoundError` / `RulesetForbiddenError` appropriately
- `listRulesets` filters by `my` / `shared` (sharedWithEmails) / `community` (visibility=public)
- Service unit tests cover all access-control branches
- `bun run test src/__tests__/unit/lib/services/ruleset.service.test.ts` passes

**Verification:** `bun run test src/__tests__/unit/lib/services/ruleset.service.test.ts`
**Files:** `src/lib/services/ruleset.service.ts` [NEW], `src/__tests__/unit/lib/services/ruleset.service.test.ts` [NEW]
**Scope:** M
**Dependencies:** Task 1

#### Task 4: Ruleset API routes

Create `src/app/api/rulesets/route.ts` (GET list + POST create) and `src/app/api/rulesets/[id]/route.ts` (GET + PATCH + DELETE). Follow the `styles/route.ts` pattern exactly: `withAuth`, `Zod safeParse`, typed error handler.

**Acceptance criteria:**

- GET `/api/rulesets?tab=my|shared|community` returns `{ rulesets: RulesetDocument[] }`
- POST `/api/rulesets` validates with `CreateRulesetSchema`, returns created document
- GET/PATCH/DELETE `/api/rulesets/[id]` handle 404/403/500 via error handler
- `bun run check` passes

**Verification:** `bun run check`
**Files:** `src/app/api/rulesets/route.ts` [NEW], `src/app/api/rulesets/[id]/route.ts` [NEW]
**Scope:** S
**Dependencies:** Task 3

#### Task 5: Canvas service + PATCH API extensions

In `CanvasService.transformDoc`, read `activeRulesetId` and `activeRulesetName` from Firestore data. The `updateCanvas` method already passes `data` through to Firestore — no change needed there as long as the fields arrive in the update payload. Confirm `CanvasUpdateSchema` already has the new fields (from Task 2). Verify the existing `/api/canvases/[id]` PATCH route passes the parsed body to `canvasService.updateCanvas`.

**Acceptance criteria:**

- `CanvasDocument` returned by `canvasService.getCanvas` includes `activeRulesetId` / `activeRulesetName`
- PATCH `/api/canvases/[id]` with `{ activeRulesetId: "abc" }` persists the value
- `bun run check` passes

**Verification:** `bun run check`
**Files:** `src/lib/services/canvas.service.ts`, `src/app/api/canvases/[id]/route.ts` (verify only, likely no change)
**Scope:** XS
**Dependencies:** Task 2

### Checkpoint: Service layer

- [ ] `bun run test` passes
- [ ] `bun run check` passes

---

### Phase 3: Validation engine

#### Task 6: validation.ts — Gemini vision call + parser

Create `src/lib/canvas/validation.ts`. Export:

- `validateImage(imageGcsUri: string, ruleset: RulesetDocument): Promise<ValidationResult[]>` — fetches image bytes via `storageService.downloadBytes` or signed URL, sends inline to Gemini with the fixed system prompt, parses `RULE <id>: PASS|FAIL — <reason>` lines.
- Parse defensively: unrecognised lines → skip; unknown rule id → skip; unparseable result → `{ status: "fail", reason: "parse error" }`.

Write unit tests in `src/__tests__/unit/lib/canvas/validation.test.ts` mocking `geminiService.generateTextWithVision` (or equivalent). Test: all pass, some fail, bad Gemini response, empty rules list.

**Acceptance criteria:**

- Returns one `ValidationResult` per rule in `ruleset.rules`
- PASS lines → `status: "pass"`, FAIL lines → `status: "fail"` with extracted reason
- Gemini call uses correct system prompt and sends image inline
- Unit tests pass: `bun run test src/__tests__/unit/lib/canvas/validation.test.ts`

**Verification:** `bun run test src/__tests__/unit/lib/canvas/validation.test.ts`
**Files:** `src/lib/canvas/validation.ts` [NEW], `src/__tests__/unit/lib/canvas/validation.test.ts` [NEW]
**Scope:** M
**Dependencies:** Task 2

#### Task 7: Integrate validation into executePlan

Extend `executePlan` signature in `src/lib/canvas/generation.ts` to accept `activeRulesetId?: string`. At the top of the function (before wave loop), if `activeRulesetId` is set, load the `RulesetDocument` from Firestore via `rulesetService.getRuleset` and store in `ExecutionContext`. In the per-step execution (image steps only), after `primitive.execute` succeeds, call `validateImage`. If any rule fails and has `failureStrategy: "retry"` with retriesLeft > 0, re-run `PromptEngineer.engineerPrompt` with violation feedback appended, re-execute, re-validate (loop up to `maxRetries`). Emit `step_done` with `validationResults` attached.

**Acceptance criteria:**

- No validation when `activeRulesetId` is absent (existing behaviour unchanged)
- `step_done` includes `validationResults` when ruleset is active
- Retry loop calls `engineerPrompt` at most `maxRetries + 1` times total
- Video/audio/concat steps skip validation
- `bun run check` passes

**Verification:** `bun run check && bun run test`
**Files:** `src/lib/canvas/generation.ts`, `src/lib/canvas/validation.ts`
**Scope:** M
**Dependencies:** Task 6

### Checkpoint: Validation core

- [ ] `bun run test` passes (validation + generation unit tests)
- [ ] `bun run check` passes

---

### Phase 4: Preventive injection

#### Task 8: Director preventive injection

Extend `CanvasAgent.build` to accept `activeRuleset?: { name: string; rules: Rule[] }`. When present, append the ruleset block to the `instruction` string before building the `LlmAgent`. The API route that calls `CanvasAgent.build` must pass the ruleset (loaded from the canvas's `activeRulesetId`).

**Acceptance criteria:**

- When `activeRuleset` is set, `instruction` ends with the `ACTIVE RULESET — <name>:` block
- When absent, `instruction` is unchanged
- `bun run check` passes

**Verification:** `bun run check`
**Files:** `src/lib/canvas/agent/canvas-agent.ts`, `src/app/api/canvases/[id]/chat/route.ts`
**Scope:** S
**Dependencies:** Task 1

#### Task 9: Prompt Engineer injection + retry feedback

Extend `PromptEngineer.buildRequest` to accept `activeRuleset?: { name: string; rules: Rule[] }` and append the ruleset block to the PE instruction. Extend `PromptEngineer.engineerPrompt` to accept an optional `violationFeedback?: string` string; when set, append the VALIDATION FEEDBACK block to the user message before the Gemini call.

**Acceptance criteria:**

- Ruleset block appears in PE user message when `activeRuleset` is set
- `violationFeedback` block appears in user message on retry attempts
- `bun run check` passes

**Verification:** `bun run check`
**Files:** `src/lib/canvas/agent/prompt-engineer.ts`
**Scope:** S
**Dependencies:** Task 7, Task 8

### Checkpoint: Injection

- [ ] `bun run preflight` passes

---

### Phase 5: UI

#### Task 10: Ruleset editor component

Create `src/components/ruleset/ruleset-editor.tsx`. Form fields: name (input), description (textarea). Rule list: add rule button → inline form (description textarea, severity toggle hard/soft, failureStrategy toggle retry/surface, maxRetries number shown only when strategy=retry). Each rule shows delete button. Submit calls POST or PATCH `/api/rulesets`.

**Acceptance criteria:**

- Can create a new ruleset with at least one rule
- Can edit name/description/rules on an existing ruleset
- maxRetries field hidden when failureStrategy = "surface"
- `bun run check` passes

**Verification:** `bun run check`
**Files:** `src/components/ruleset/ruleset-editor.tsx` [NEW]
**Scope:** M
**Dependencies:** Task 4

#### Task 11: Ruleset list component

Create `src/components/ruleset/ruleset-list.tsx`. Sidebar section alongside Flows/Canvases/Styles. Tabs: my / shared / community. Each row shows name, rule count badge, visibility badge. Row actions: edit (opens editor), delete (confirm dialog), share (visibility/sharedWith). Fetches from GET `/api/rulesets?tab=...`.

**Acceptance criteria:**

- Lists rulesets by tab
- Delete removes item from list
- Edit opens editor pre-filled
- `bun run check` passes

**Verification:** `bun run check`
**Files:** `src/components/ruleset/ruleset-list.tsx` [NEW]
**Scope:** M
**Dependencies:** Task 10

#### Task 12: Canvas ruleset picker

Create `src/components/canvas/ruleset-picker.tsx`. Mirrors the style picker: shows active ruleset name (or "No ruleset"), dropdown/combobox to search and attach a ruleset, "Remove ruleset" action. On change, calls PATCH `/api/canvases/[id]` with `{ activeRulesetId, activeRulesetName }`. Wire into the canvas settings panel in `canvas-editor.tsx`.

**Acceptance criteria:**

- Picker shows current active ruleset name
- Selecting a ruleset PATCHes the canvas and updates local state
- Clearing removes `activeRulesetId` (sends null)
- `bun run check` passes

**Verification:** `bun run check`
**Files:** `src/components/canvas/ruleset-picker.tsx` [NEW], `src/components/canvas/canvas-editor.tsx`
**Scope:** M
**Dependencies:** Task 5, Task 11

#### Task 13: Validation badges + chat failure surface

On canvas image nodes: show coloured badge when `validationResults` present (green = all pass, yellow = soft fail, red = hard fail). Click → popover with rule-by-rule breakdown.

In `canvas-chat-panel.tsx`: when a `step_done` event carries failing `validationResults`, show inline failure surface (toast + expandable details with Accept / Regenerate actions).

**Acceptance criteria:**

- Green/yellow/red badge appears based on `validationResults` status
- Popover shows each rule's description, PASS/FAIL, and Gemini reason
- Failure toast appears in chat for steps with failing rules
- Accept action clears the failure state on soft rules
- `bun run check` passes

**Verification:** `bun run check`
**Files:** `src/components/canvas/canvas-chat-panel.tsx`, relevant canvas node component
**Scope:** M
**Dependencies:** Task 7, Task 12

### Checkpoint: Complete

- [ ] `bun run preflight` passes with no errors
- [ ] All acceptance criteria met across all 13 tasks

## Risks and Mitigations

| Risk                                             | Impact | Mitigation                                                                                                     |
| ------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------- |
| Gemini vision response format inconsistent       | Med    | Parse defensively; treat unparseable lines as FAIL with `reason: "parse error"`                                |
| GCS image fetch for validation adds latency      | Med    | Fire validation after step is done; failure surfaces post-step so user flow isn't blocked until result arrives |
| Retry loop adds per-step latency                 | Low    | Default maxRetries=1, hard cap at 5 in schema                                                                  |
| CanvasUpdateSchema validation rejects new fields | Low    | Use `.nullable().optional()` — fully backward compatible                                                       |
