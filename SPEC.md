# Spec: Canvas Agent Extensibility — Dimension 2: User Pattern Skills

## Objective

The goal is to allow users to create, customize, share, and run their own custom **pattern skills** on the Flowcraft Canvas.

Currently, the Canvas Agent (Director) is limited to a hardcoded set of pattern skills (e.g., `character-generation`, `multi-shot-video`, `storyboard`, `virtual-tryon`) loaded from the server's filesystem.
This feature will enable users to:

1. Define custom multi-phase creation workflows as pattern skills (with trigger phrases, a description, and structured phases with rules).
2. Store these skills in a Firestore database under `user_skills`.
3. Dynamically inject these user-defined skills into the `@google/adk` agent runner at chat-request time.
4. Manage their custom skills via a dedicated **Skills Library Panel** and a step-by-step **Skill Editor Wizard** in the UI (supporting creation, editing, deletion, and cloning from built-in or public community templates).

---

## Tech Stack

- **Framework**: Next.js 15.5.4 (App Router)
- **Language**: TypeScript 5
- **State Management**: Zustand 5 (Canvas Store)
- **AI SDK**: `@google/adk` 1.1.0 & `@google/genai` 1.45.0
- **Database**: Firestore (`@google-cloud/firestore` 8.3.0)
- **Styling & UI**: Tailwind CSS v4, Radix UI (shadcn/ui), Lucide icons
- **Testing**: Vitest 4.1.0 with `jsdom`

---

## Commands

All commands should be executed from the project root using `bun`:

- **Development Server**:
    ```bash
    bun run dev
    ```
- **Production Build**:
    ```bash
    bun run build
    ```
- **TypeScript Type-Check**:
    ```bash
    bun run check
    ```
- **ESLint Linting**:
    ```bash
    bun run lint
    ```
- **Code Formatting (Prettier)**:
    ```bash
    bun run format
    ```
- **Run Unit Tests**:
    ```bash
    bun run test
    ```
- **Run Preflight Gate (Format + Check + Lint + Test)**:
    ```bash
    bun run preflight
    ```
    _(Note: This preflight script must pass with zero errors before merging code)._

---

## Project Structure

We will add and modify the following files:

```
src/
├── app/
│   └── api/
│       ├── canvases/
│       │   └── [id]/
│       │       └── chat/
│       │           └── route.ts         # [MODIFY] Fetch and inject user skills into agent stream
│       └── skills/
│           ├── route.ts                 # [NEW] GET list skills, POST create skill
│           └── [id]/
│               ├── route.ts             # [NEW] GET single skill, PATCH update, DELETE
│               └── clone/
│                   └── route.ts         # [NEW] POST clone/fork skill
├── components/
│   └── canvas/                          # [NEW] UI Components for skill management
│       ├── skill-editor.tsx             # [NEW] Structured form wizard to create/edit skills
│       └── skills-library.tsx           # [NEW] Sidebar panel listing my/built-in/community skills
├── lib/
│   ├── constants.ts                     # [MODIFY] Add USER_SKILLS collection name constant
│   ├── services/
│   │   └── skill.service.ts             # [NEW] Firestore CRUD, cloning, and templates logic
│   └── canvas/
│       └── agent/
│           ├── canvas-agent.ts          # [MODIFY] Merge dynamic user skills into SkillToolset
│           └── skills/
│               └── skill-types.ts       # [NEW] TS interfaces for UserSkillDocument and SkillPhase
└── __tests__/
    └── unit/
        └── lib/
            ├── canvas/
            │   └── adk/
            │       └── canvas-agent-dynamic.test.ts # [NEW] Test dynamic skill injection into ADK
            └── services/
                └── skill.service.test.ts             # [NEW] Mocked Firestore tests for CRUD
```

---

## Code Style

The following example shows our pattern for services, error handling, and Zod validation:

```typescript
// src/lib/canvas/agent/skills/skill-types.ts
export interface SkillPhase {
    title: string;
    rules: string;
}

export interface UserSkillDocument {
    id: string;
    userId: string;
    name: string;
    description: string;
    triggerHints: string[];
    phases: SkillPhase[];
    visibility: "private" | "public";
    sharedWith: { email: string; role: "view" | "edit" }[];
    sharedWithEmails: string[];
    isTemplate: boolean;
    createdAt: string;
    updatedAt: string;
}

// Example service method with custom error handling
export class SkillNotFoundError extends Error {
    constructor(id: string) {
        super(`Skill not found: ${id}`);
        this.name = "SkillNotFoundError";
    }
}

// Zod validation in API routes
import { z } from "zod";

export const CreateSkillSchema = z.object({
    name: z
        .string()
        .min(2)
        .max(64)
        .regex(/^[a-z0-9-]+$/, "Must be snake-case or kebab-case"),
    description: z.string().min(10).max(1024),
    triggerHints: z.array(z.string()).min(1),
    phases: z
        .array(
            z.object({
                title: z.string().min(2),
                rules: z.string().min(10),
            }),
        )
        .min(1),
});
```

---

## Testing Strategy

We will use **Vitest** for testing, following the existing mocked Firestore patterns to keep tests fast and side-effect free.

1. **`skill.service.test.ts`**:
    - Verify `listSkills` filters by owner, community templates, and shared permissions.
    - Verify `getSkill` enforces proper ownership and visibility guards (throws `SkillForbiddenError`).
    - Verify `createSkill`, `updateSkill`, and `deleteSkill` update Firestore correctly.
    - Verify `cloneSkill` copies fields and appends `"Copy of"` to the name.

2. **`canvas-agent-dynamic.test.ts`**:
    - Verify that dynamic skill objects (constructed from `UserSkillDocument` data) are correctly serialized to the `@google/adk` `Skill` format.
    - Verify that they are successfully loaded into `SkillToolset` and merged with built-in skills.
    - Verify that `ListSkillsTool` is correctly filtered out to prevent leaking details.

---

## Boundaries

- **Always do**:
    - Run `bun run preflight` to run type-checking, linting, and all tests before submitting code.
    - Convert Firestore timestamps using `formatFirestoreTimestamp` for consistency.
    - Enforce strict typing in all TypeScript files.
    - Use camelCase for TypeScript variables/methods and snake-case or kebab-case for skill IDs/names.
- **Ask first**:
    - Making changes to the Vertex AI config or global NextAuth config.
    - Creating any new global database indexes on Firestore.
- **Never do**:
    - Commit any `.env.local` files, service account keys, or secrets to Git.
    - Skip the git pre-commit hook with `--no-verify`.
    - Modify vendor code inside `node_modules`.
    - Disable or remove failing tests without explicit approval.

---

## Success Criteria

1. **CRUD Validation**: Users can successfully create, edit, delete, and clone skills via REST endpoints, with full validation coverage.
2. **Dynamic Serialization**: Firestore-stored user skills are seamlessly converted to `@google/adk` `Skill` interfaces in memory.
3. **Agent Integration**: The Canvas Agent (Director) successfully matches prompts against custom skill trigger hints and follows the phase rules during execution.
4. **Skills UI**: The **Skills Library Panel** and **Skill Editor Wizard** display correctly on the Canvas page, allowing creators to fork built-ins and build custom workflows.
5. **No regressions**: `bun run preflight` passes with 100% success across the entire test suite.

---

## Open Questions

- **Dynamic Merging Scope**: Should we load _all_ active user skills (plus community/template skills) into the agent's memory for every canvas chat request, or should we filter/query them based on the prompt?
    - _Our Recommendation_: Load all active/public skills (typically < 50 items per user) and let ADK's `SkillToolset` handle matching. It is extremely fast and robust since it runs entirely in memory.
- **UI Implementation Strategy**: Do we build the complete frontend React components (Wizard & Library Panel) in this phase, or do we focus on backend CRUD, Firestore service, ADK integration, and comprehensive tests first, followed by the UI?
    - _Our Recommendation_: Implement the backend service, ADK engine integration, API routes, and unit tests first. Once the backend is fully verified and tests pass, we will build the UI components to hook into those APIs.
- **Validation on Skill Name**: ADK requires skill names to match a snake_case or kebab-case pattern to be used as tools/commands. Should the UI automatically convert user-entered titles (e.g., "Logo Campaign") to kebab-case (e.g., "logo-campaign") during creation, or reject invalid formats with validation errors?
    - _Our Recommendation_: Auto-kebab-case the name in the background for the ID/frontmatter, but preserve the friendly display name for the UI.
