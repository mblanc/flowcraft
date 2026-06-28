# Spec: Ruleset Validation & Policy Enforcement

## Objective

Build a first-class "ruleset" library asset that lets users define free-text image validation rules
and attach one ruleset to any canvas. After every image generation step, a single Gemini vision
call validates the output against all active rules, retrying via the Prompt Engineer when configured,
or surfacing failures inline for user action. Preventive injection seeds the Director and Prompt
Engineer system prompts so constraint awareness happens before generation, not only after.

Success looks like:

- Users can create/edit/delete rulesets via the sidebar library (same UX as Styles)
- A canvas picker lets them attach/detach a ruleset
- Every canvas image step auto-validates when a ruleset is active
- Hard-rule failures surface in the chat panel with Accept/Regenerate actions
- Soft-rule failures show a yellow badge; the user can accept without blocking flow

## Tech Stack

Next.js 15 / React 19, TypeScript, Tailwind CSS v4, shadcn/ui, @xyflow/react, Firestore,
@google/genai (Gemini vision), Zustand (canvas store), Zod (schema validation), Vitest + jsdom.

## Commands

```
Dev:      bun run dev
Build:    bun run build
Typecheck: bun run check
Lint:     bun run lint
Format:   bun run format
Test:     bun run test
Preflight: bun run preflight
Single test: bun run test src/__tests__/unit/lib/canvas/validation.test.ts
```

## Project Structure

New files:

```
src/lib/services/ruleset.service.ts          Firestore CRUD + access control
src/app/api/rulesets/route.ts                GET (list) + POST (create)
src/app/api/rulesets/[id]/route.ts           GET + PATCH + DELETE
src/lib/canvas/validation.ts                 Gemini vision call + retry loop
src/components/canvas/ruleset-picker.tsx     Canvas sidebar widget
src/components/ruleset/ruleset-editor.tsx    Full CRUD editor (name, rules list)
src/components/ruleset/ruleset-list.tsx      Sidebar library list (my/shared/community)
```

Modified files:

```
src/lib/constants.ts                         Add RULESETS collection key
src/lib/schemas.ts                           Add Rule, Ruleset, Create/Update schemas
src/lib/canvas/types.ts                      Extend StepEvent, add ValidationResult, extend CanvasDocument
src/lib/canvas/generation.ts                 Integrate validation pipeline; pass ruleset in context
src/lib/canvas/agent/canvas-agent.ts         Inject ruleset into Director system prompt
src/lib/canvas/agent/prompt-engineer.ts      Inject ruleset into PE system prompt + accept violation feedback
src/lib/services/canvas.service.ts           Add activeRulesetId/activeRulesetName to transformDoc + update
src/lib/store/use-canvas-store.ts            Add activeRulesetId/activeRulesetName to canvas state
src/components/canvas/canvas-editor.tsx      Add ruleset picker tab in settings panel
src/components/canvas/canvas-chat-panel.tsx  Render failure surface inline in chat
```

Tests:

```
src/__tests__/unit/lib/canvas/validation.test.ts        Validation engine unit tests
src/__tests__/unit/lib/services/ruleset.service.test.ts Service CRUD + access control tests
src/__tests__/unit/lib/schemas/ruleset.test.ts          Schema validation tests
```

## Code Style

Follow the existing pattern exactly — no deviation:

```ts
// Service: class with private firestore, transformDoc, named export singleton
export class RulesetService {
    private firestore = getFirestore();

    private transformDoc(doc: DocumentSnapshot | QueryDocumentSnapshot): RulesetDocument {
        const data = doc.data();
        return {
            id: doc.id,
            userId: data?.userId as string,
            // ...
        };
    }

    async listRulesets(userId: string, userEmail?: string, tab: RulesetListTab = "my"): Promise<RulesetDocument[]> { ... }
}
export const rulesetService = new RulesetService();

// API route: withAuth wrapper, Zod safeParse, 400/403/404/500 pattern
export const GET = withAuth(async (req, _context, session) => {
    try {
        const rulesets = await rulesetService.listRulesets(session.user!.id!, session.user!.email ?? undefined, tab);
        return NextResponse.json({ rulesets });
    } catch (error) {
        logger.error("Error fetching rulesets:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
});
```

- No barrel re-exports — import from specific paths
- `logger.debug/info/warn/error` with `[ServiceName]` prefix
- `FieldValue.serverTimestamp()` for Firestore timestamps
- `withAuth` from `@/lib/utils/api` for all API routes
- Error classes: `RulesetNotFoundError`, `RulesetForbiddenError` — same pattern as Style\*
- Zod schemas exported from `src/lib/schemas.ts`

## Testing Strategy

Framework: Vitest + jsdom. All unit tests mock Firestore (`vi.hoisted` + `vi.mock("@/lib/db/firestore")`).

Test coverage requirements: 60% lines/statements, 50% functions, 45% branches.

Test levels:

- **Unit tests** for service CRUD (access control: owner vs shared vs public), schema validation,
  validation engine (PASS/FAIL parsing, retry logic, strategy branching)
- **No integration tests** for v1 (no real Gemini calls in CI)

Mirror the test style from `src/__tests__/unit/lib/services/style-sharing.test.ts`:

- `vi.hoisted` mock setup
- Mock `@/lib/db/firestore`, `@google-cloud/firestore`, `@/lib/services/admin`
- `beforeEach` rebuilds mock chains
- Describe blocks per method, `it` blocks per scenario

## Boundaries

**Always:**

- Run `bun run preflight` before marking a task complete
- Validate with Zod at API boundaries (`safeParse`, return 400 on failure)
- Check ownership in every service method that mutates state
- Resolve ruleset document once per `executePlan` call (not per step)
- Skip validation entirely when `activeRulesetId` is absent on the canvas

**Ask first:**

- Any new npm/bun dependency
- Changes to existing Firestore indexes
- UI patterns that deviate significantly from the style-picker component

**Never:**

- Skip `withAuth` on any API route
- Call Firestore per step inside the wave loop (ruleset is pre-loaded once)
- Validate video steps (images only in v1)
- Commit `--no-verify`

## Data Model

### Firestore: `rulesets/{id}`

```ts
interface RulesetDocument {
    id: string;
    userId: string;
    name: string;
    description?: string;
    rules: Rule[];
    visibility: "private" | "public";
    sharedWith: { email: string; role: "view" | "edit" }[];
    sharedWithEmails: string[];
    createdAt: string;
    updatedAt: string;
}

interface Rule {
    id: string;
    description: string;
    severity: "hard" | "soft";
    failureStrategy: "retry" | "surface";
    maxRetries?: number;
}
```

### Canvas document extensions

```ts
activeRulesetId?: string;
activeRulesetName?: string;
```

Added to `CanvasDocument` in `src/lib/canvas/types.ts` and `CanvasUpdateSchema` in `src/lib/schemas.ts`.

### StepEvent extension

```ts
export type ValidationResult = {
  ruleId: string;
  ruleDescription: string;
  severity: "hard" | "soft";
  status: "pass" | "fail";
  reason: string;
};

// step_done extended:
| { type: "step_done"; stepId: string; node: NodePayload; validationResults?: ValidationResult[] }
```

## Validation Pipeline

`src/lib/canvas/validation.ts` exports:

```ts
export async function validateImage(
    imageGcsUri: string,
    ruleset: RulesetDocument,
): Promise<ValidationResult[]>;

export async function runValidationWithRetry(
    step: GenerationStep,
    imageGcsUri: string,
    ruleset: RulesetDocument,
    executeStep: (violationFeedback?: string) => Promise<string>,
): Promise<{ uri: string; results: ValidationResult[] }>;
```

Validation Gemini call uses `MODELS.TEXT.GEMINI_3_5_FLASH` with vision (inline image bytes from
GCS URI fetched via signed URL or inline data). System prompt and response format are fixed as
described in the feature file. Retry appends violation feedback to the Prompt Engineer input.

## Preventive Injection

Both `CanvasAgent.build()` and `PromptEngineer.buildRequest()` accept an optional
`activeRuleset?: { name: string; rules: Rule[] }` parameter. When present, the ruleset block is
appended to the respective system prompt / instruction strings. These are assembled at request time
by the API route after loading the canvas document.

## Success Criteria

- `bun run preflight` passes with no errors
- `RulesetService` CRUD tests cover: create, list (my/shared/community), get (owner/shared/public/forbidden), update (owner/editor/forbidden), delete (owner/forbidden)
- `validateImage` returns correctly parsed `ValidationResult[]` for well-formed Gemini responses
- `runValidationWithRetry` calls `executeStep` at most `maxRetries + 1` times for `retry` rules
- `StepEvent` `step_done` carries `validationResults` only when ruleset is active
- Canvas PATCH API accepts `activeRulesetId` and persists it
- TypeScript type-checks with zero errors (`bun run check`)

## Open Questions

None — the feature file resolves all ambiguities. Proceeding with minimal scope as specified.
