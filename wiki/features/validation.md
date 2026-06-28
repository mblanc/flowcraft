# Ruleset Validation & Policy Enforcement

A feature that lets users define `rulesets` — first-class library assets — and attach them to a canvas. Every image generation on that canvas is then validated against the ruleset's rules by a single Gemini vision call. Failures are retried (Prompt Engineer only, with violation feedback) or surfaced to the user. Validation is opt-in: a canvas with no attached ruleset skips it entirely.

---

## Confirmed Decisions

| Decision                 | Choice                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| Collection name          | `rulesets` (Firestore top-level, same pattern as `styles`)                                |
| Rule authoring           | Free-text only — no structured fields, no programmatic checks                             |
| Validation engine        | Single Gemini vision call: image + all rules → PASS/FAIL + reason per rule                |
| Media scope              | Images only (not video)                                                                   |
| Failure strategy options | `retry` (Prompt Engineer re-runs with violation feedback) or `surface` (default)          |
| Retry target             | Prompt Engineer only — Director plan is not re-run                                        |
| Default failure strategy | `surface`                                                                                 |
| Default maxRetries       | `1`                                                                                       |
| Preventive injection     | Active ruleset rules injected into Director system prompt + Prompt Engineer system prompt |
| Opt-in                   | Canvas must have an active ruleset attached; no ruleset = no validation                   |
| Sharing                  | Same model as other assets: `userId`, `visibility` (`private`/`public`), `sharedWith`     |

**Out of scope for v1:** auto-correct/programmatic fixes, inpainting, AI-assisted rule creation, channel preset library, video validation.

---

## Data Model

### Firestore: `rulesets/{id}`

```ts
interface RulesetDocument {
    id: string;
    userId: string; // owner
    name: string;
    description?: string;
    rules: Rule[];
    visibility: "private" | "public";
    sharedWith: string[]; // user emails
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

interface Rule {
    id: string; // uuid, stable across edits
    description: string; // free-text, e.g. "Logo must appear in the top-right quadrant"
    severity: "hard" | "soft"; // hard = blocking, soft = warning
    failureStrategy: "retry" | "surface"; // default: "surface"
    maxRetries?: number; // only relevant when failureStrategy = "retry", default: 1
}
```

### Canvas document — active ruleset reference

Add to the existing `CanvasDocument`:

```ts
activeRulesetId?: string;
activeRulesetName?: string;
```

Same pattern as `activeStyleId` / `activeStyleName`.

### Constants

Add to `COLLECTIONS` in `src/lib/constants.ts`:

```ts
RULESETS: "rulesets";
```

---

## Validation Pipeline

Runs after every image generation step, before `step_done` is emitted. Only runs when `activeRulesetId` is set on the canvas.

```
generate image
  → if no activeRulesetId → skip, emit step_done as normal
  → load ruleset from Firestore (or pass it in ExecutionContext)
  → call Gemini vision: image + rules → ValidationResult[]
  → if all pass → emit step_done with validationResults attached
  → if any fail:
      → for each failing rule:
          → if failureStrategy = "retry" and retriesLeft > 0:
              → re-run PromptEngineer with violation feedback appended
              → re-execute generation
              → re-validate (loop, up to maxRetries)
          → else → mark as needs_review
      → if any rule still needs_review → emit step_done with validationResults (including failures)
```

### Gemini validation call

Single call per generation. System prompt:

```
You are a media validation assistant. You will receive an image and a list of rules.
For each rule, respond with exactly:
RULE <id>: PASS | FAIL — <one sentence reason>
Do not add any other text.
```

User message: the image (inline) + the rule list formatted as:

```
Rule <id>: <description> [severity: hard|soft]
```

### Retry: Prompt Engineer feedback injection

When a retry is triggered, append to the Prompt Engineer's input:

```
VALIDATION FEEDBACK (attempt <n>/<maxRetries>):
The previous generation failed the following rules:
- Rule <id> (<severity>): <reason>
Adjust the prompt to address these violations explicitly.
```

### StepEvent extension

Extend `StepEvent` in `src/lib/canvas/generation.ts`:

```ts
export type ValidationResult = {
  ruleId: string;
  ruleDescription: string;
  severity: "hard" | "soft";
  status: "pass" | "fail";
  reason: string;
};

// Extend step_done:
| {
    type: "step_done";
    stepId: string;
    node: NodePayload;
    validationResults?: ValidationResult[];  // present when a ruleset is active
  }
```

---

## Preventive Injection

When a canvas has an active ruleset, inject its rules into:

1. **Director system prompt** (`src/lib/canvas/agent/canvas-agent.ts`) — append after existing instructions:

    ```
    ACTIVE RULESET — <rulesetName>:
    The following rules must be respected in all generations:
    <rule list as bullet points>
    Plan your production with these constraints in mind.
    ```

2. **Prompt Engineer system prompt** (`src/lib/canvas/agent/prompt-engineer.ts`) — append after existing `INSTRUCTION`:
    ```
    ACTIVE RULESET — <rulesetName>:
    <rule list as bullet points>
    Every prompt you produce must explicitly satisfy these rules.
    ```

Both injections are assembled at request time from the canvas's `activeRulesetId` (resolved to the ruleset document).

---

## API Routes

### `GET /api/rulesets` — list user's rulesets

### `POST /api/rulesets` — create ruleset

### `GET /api/rulesets/[id]` — get ruleset

### `PATCH /api/rulesets/[id]` — update ruleset

### `DELETE /api/rulesets/[id]` — delete ruleset

### `PATCH /api/canvases/[id]` — existing route, extend to accept `activeRulesetId` / `activeRulesetName`

All routes follow the same auth pattern as `/api/canvases`: call `auth()`, check ownership or `sharedWith`.

---

## Service Layer

Create `src/lib/services/ruleset.service.ts` following the same structure as `canvas.service.ts`:

- `listRulesets(userId, userEmail, tab)` — my / shared / community tabs
- `createRuleset(userId, data)` → `RulesetDocument`
- `getRuleset(rulesetId, userId, userEmail)` → `RulesetDocument` (throws `RulesetNotFoundError`, `RulesetForbiddenError`)
- `updateRuleset(rulesetId, userId, data)` → `RulesetDocument`
- `deleteRuleset(rulesetId, userId)` → `void`

---

## Zod Schemas

Add to `src/lib/schemas.ts`:

```ts
export const RuleSchema = z.object({
    id: z.string(),
    description: z.string().min(1),
    severity: z.enum(["hard", "soft"]),
    failureStrategy: z.enum(["retry", "surface"]).default("surface"),
    maxRetries: z.number().int().min(1).max(5).optional(),
});

export const RulesetSchema = z.object({
    id: z.string(),
    userId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    rules: z.array(RuleSchema),
    visibility: z.enum(["private", "public"]).default("private"),
    sharedWith: SharedWithSchema.optional(),
});

export const CreateRulesetSchema = RulesetSchema.omit({
    id: true,
    userId: true,
});
export const UpdateRulesetSchema = CreateRulesetSchema.partial();
```

---

## UI

### 1. Main sidebar — Ruleset library

New section in the main sidebar alongside Flows, Canvases, Styles, Skills. Displays the user's rulesets (my / shared / community tabs). Each item shows name, rule count, visibility badge. Actions: create, edit, delete, share.

**Ruleset editor** (full-page or modal):

- Name + description fields
- Rule list:
    - Add rule button → inline form: description (textarea), severity (toggle hard/soft), failure strategy (toggle retry/surface), maxRetries (number, visible only when strategy = retry)
    - Drag to reorder rules
    - Delete rule

### 2. Canvas — Ruleset picker

New tab or section in the canvas settings panel, mirroring the style picker. Shows:

- Active ruleset name (or "No ruleset")
- Dropdown/search to attach a ruleset
- "Remove ruleset" action

### 3. Canvas nodes — Validation badges

After generation, each canvas image node shows a badge:

- **Green** — all rules passed
- **Yellow** — soft rule failed, accepted by user
- **Red** — hard rule failed, needs review
- **No badge** — no ruleset active

Click badge → rule-by-rule breakdown: rule description, PASS/FAIL, Gemini's reason.

### 4. Failure surface — inline in chat panel

When a generation surfaces a failure (after retries exhausted):

**Toast:** `"<N> rule(s) failed — [See details] [Accept anyway] [Regenerate]"`

**Details panel** (expandable in chat):

- Thumbnail of the generated image
- Rule list with PASS/FAIL status and Gemini's reason per rule
- Actions: **Accept anyway** (marks soft failures as accepted, unblocks hard failures with a warning) / **Regenerate** (triggers a new generation with the same step)

---

## Execution Context Changes

Pass the active ruleset into `executePlan` in `src/lib/canvas/generation.ts`:

```ts
interface ExecutePlanOptions {
    userId: string;
    activeRulesetId?: string;
    activeRulesetName?: string;
    // ... existing fields
}
```

Resolve the ruleset document once at the top of `executePlan` (before the wave loop) and store it in `ExecutionContext`. Each step reads it from context — no per-step Firestore calls.

---

## File Checklist for Implementation

```
NEW:
  src/lib/services/ruleset.service.ts
  src/app/api/rulesets/route.ts
  src/app/api/rulesets/[id]/route.ts
  src/lib/canvas/validation.ts              ← Gemini validation call + retry loop
  src/components/canvas/ruleset-picker.tsx  ← canvas sidebar widget
  src/components/ruleset/ruleset-editor.tsx ← full CRUD editor
  src/components/ruleset/ruleset-list.tsx   ← sidebar library list

MODIFY:
  src/lib/constants.ts                      ← add RULESETS collection
  src/lib/schemas.ts                        ← add Rule, Ruleset schemas
  src/lib/canvas/types.ts                   ← extend StepEvent, add ValidationResult
  src/lib/canvas/generation.ts             ← integrate validation pipeline, pass ruleset context
  src/lib/canvas/agent/canvas-agent.ts     ← inject ruleset into Director system prompt
  src/lib/canvas/agent/prompt-engineer.ts  ← inject ruleset into PE system prompt, accept violation feedback
  src/lib/services/canvas.service.ts       ← handle activeRulesetId/activeRulesetName fields
  src/lib/store/use-canvas-store.ts        ← add activeRulesetId/activeRulesetName to canvas state
  src/components/canvas/canvas-editor.tsx  ← add ruleset picker tab
  src/components/canvas/canvas-chat-panel.tsx ← render failure surface inline
```
