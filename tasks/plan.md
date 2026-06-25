# Implementation Plan: Canvas Agent Extensibility — User Pattern Skills & Slash Commands

This document breaks down the backend implementation of **Dimension 2: User Pattern Skills & Slash Commands** into vertical, verifiable, and dependency-ordered tasks.

---

## 1. Dependency Graph

```
[Constants & Type Definitions] (Task 1)
           │
           ▼
   [SkillService CRUD] (Task 2) ──► [Service Unit Tests] (Task 3)
           │
           ├──► [CRUD API Routes] (Task 4)
           │          │
           │          ▼
           └──► [Toggle Skill API Route] (Task 5)
                      │
                      ▼
       [Dynamic Skill Merging] (Task 6)
                      │
                      ▼
     [Slash Command Agent Interception] (Task 7)
                      │
                      ▼
     [Integration & Runner Tests] (Task 8)
```

---

## 2. Task List

### Phase 1: Database & Services (Foundation)

#### Task 1: Constants & Type Definitions

- **Description**: Register the new `user_skills` collection name and define TypeScript interfaces for the skills database schemas.
- **Acceptance criteria**:
    - [ ] `COLLECTIONS.USER_SKILLS` is defined as `"user_skills"` in `src/lib/constants.ts`.
    - [ ] `CanvasDocument` in `src/lib/canvas/types.ts` is updated to include `disabledSkills?: string[]`.
    - [ ] `UserSkillDocument` and `SkillPhase` interfaces are defined in `src/lib/canvas/agent/skills/skill-types.ts` with correct typings (matching owner, visibility, and sharing controls).
- **Verification**:
    - [ ] Compile check passes: `bun run check`
- **Dependencies**: None
- **Files likely touched**:
    - `src/lib/constants.ts`
    - `src/lib/canvas/types.ts`
    - `src/lib/canvas/agent/skills/skill-types.ts` [NEW]
- **Estimated scope**: XS (1-2 files changed, 1 new)

#### Task 2: Skill CRUD Service

- **Description**: Implement a service class `SkillService` to perform Firestore database operations (create, read, update, delete, list, clone) with visibility and ownership checks.
- **Acceptance criteria**:
    - [ ] `listSkills` supports filtering by tab: `"my"` (user's skills) and `"community"` (public templates).
    - [ ] `getSkill` throws `SkillNotFoundError` if it doesn't exist, and `SkillForbiddenError` if the user lacks access.
    - [ ] `createSkill` converts any name to kebab-case before writing to Firestore.
    - [ ] `cloneSkill` fetches a skill, prepends `"copy-of-"` to the name, and writes a new document.
- **Verification**:
    - [ ] Compile check passes: `bun run check`
- **Dependencies**: Task 1
- **Files likely touched**:
    - `src/lib/services/skill.service.ts` [NEW]
- **Estimated scope**: S (1 new file)

#### Task 3: Service Unit Tests

- **Description**: Write unit tests for `SkillService` utilizing the existing Vitest Firestore mocking pattern to verify database CRUD and access guards.
- **Acceptance criteria**:
    - [ ] Mock Firestore mock setup handles queries, filters, updates, and deletions cleanly.
    - [ ] Tests verify that users cannot view/edit private skills owned by others.
    - [ ] Tests verify cloning creates a new document with `"copy-of-"` prefix.
- **Verification**:
    - [ ] Run tests successfully: `bun run test src/__tests__/unit/lib/services/skill.service.test.ts`
- **Dependencies**: Task 2
- **Files likely touched**:
    - `src/__tests__/unit/lib/services/skill.service.test.ts` [NEW]
- **Estimated scope**: S (1 new file)

### Checkpoint: Foundation

- [ ] TypeScript type-checking compiles clean with no errors (`bun run check`).
- [ ] All new `SkillService` unit tests pass successfully (`bun run test`).

---

### Phase 2: API Endpoints

#### Task 4: CRUD API Routes

- **Description**: Implement Next.js App Router API routes to handle REST operations for user skills.
- **Acceptance criteria**:
    - [ ] `GET /api/skills` returns the list of skills for the authenticated user.
    - [ ] `POST /api/skills` validates the request body using Zod schema, forces kebab-case on name, and creates the skill.
    - [ ] `GET /api/skills/[id]`, `PATCH /api/skills/[id]`, and `DELETE /api/skills/[id]` are implemented with proper authentication checks.
    - [ ] `POST /api/skills/[id]/clone` clones the target skill.
- **Verification**:
    - [ ] Compile check passes: `bun run check`
- **Dependencies**: Task 3
- **Files likely touched**:
    - `src/app/api/skills/route.ts` [NEW]
    - `src/app/api/skills/[id]/route.ts` [NEW]
    - `src/app/api/skills/[id]/clone/route.ts` [NEW]
- **Estimated scope**: S (3 new files)

#### Task 5: Canvas Skill Toggle API Route

- **Description**: Create a dedicated API route to toggle (enable/disable) a skill for a specific canvas by updating the `disabledSkills` array in Firestore.
- **Acceptance criteria**:
    - [ ] `POST /api/canvases/[id]/toggle-skill` accepts a body `{ skillName: string, enabled: boolean }`.
    - [ ] It adds the skill name to `disabledSkills` if `enabled` is false, and removes it if `enabled` is true.
- **Verification**:
    - [ ] Compile check passes: `bun run check`
- **Dependencies**: Task 4
- **Files likely touched**:
    - `src/app/api/canvases/[id]/toggle-skill/route.ts` [NEW]
- **Estimated scope**: S (1 new file)

### Checkpoint: API Layer

- [ ] All Next.js route handlers compile clean.
- [ ] No regressions: All pre-existing unit tests pass.

---

### Phase 3: ADK Agent & Slash Commands Integration

#### Task 6: Dynamic Skill Merging in CanvasAgent

- **Description**: Update `CanvasAgent.build` to fetch, merge, and filter user-created and built-in skills, and write corresponding tests.
- **Acceptance criteria**:
    - [ ] `CanvasAgent.build()` takes `userSkills: Skill[]` and `disabledSkills: string[]` as parameters.
    - [ ] It merges the user skills with the loaded built-in pattern skills.
    - [ ] It filters out any skill whose name/ID is in `disabledSkills`.
    - [ ] It creates `SkillToolset` using the final combined set of active skills.
- **Verification**:
    - [ ] Compile check passes: `bun run check`
    - [ ] Run tests successfully: `bun run test src/__tests__/unit/lib/canvas/adk/canvas-agent-dynamic.test.ts`
- **Dependencies**: Task 5
- **Files likely touched**:
    - `src/lib/canvas/agent/canvas-agent.ts`
    - `src/__tests__/unit/lib/canvas/adk/canvas-agent-dynamic.test.ts` [NEW]
- **Estimated scope**: S (1 modified, 1 new)

#### Task 7: Slash Command Agent Interception

- **Description**: Update the `CanvasAgentRunner.stream` execution pipeline to intercept and process `/skills` and `/[name-of-a-skill]` commands.
- **Acceptance criteria**:
    - [ ] Intercepts message if it starts with `/`.
    - [ ] **Interception 1: `/skills`**: Bypasses the ADK runner entirely. Fetches all built-in and user skills, formats a structured text message showing their status (enabled/disabled based on `canvas.disabledSkills`), and yields it as a streaming text event.
    - [ ] **Interception 2: `/[name-of-a-skill]`**: Parses the skill name, checks if it is active and enabled, strips the command prefix from the prompt, and appends a high-priority forcing instruction to the system prompt.
- **Verification**:
    - [ ] Compile check passes: `bun run check`
- **Dependencies**: Task 6
- **Files likely touched**:
    - `src/lib/canvas/agent/agent-runner.ts`
- **Estimated scope**: S (1 modified file)

#### Task 8: Integration Tests for Agent Runner & Commands

- **Description**: Implement comprehensive unit and integration tests to verify the slash command interception and prompt forcing behavior in `CanvasAgentRunner`.
- **Acceptance criteria**:
    - [ ] Tests verify `/skills` yields a list of all skills (enabled/disabled state).
    - [ ] Tests verify that typing a valid `/[name-of-a-skill]` strips the prefix and injects the force-execute instructions into the system prompt.
    - [ ] Tests verify that typing an invalid skill name (or a disabled skill) handles the error gracefully.
- **Verification**:
    - [ ] Run tests successfully: `bun run test src/__tests__/unit/lib/canvas/adk/agent-runner-slash-commands.test.ts`
- **Dependencies**: Task 7
- **Files likely touched**:
    - `src/__tests__/unit/lib/canvas/adk/agent-runner-slash-commands.test.ts` [NEW]
- **Estimated scope**: S (1 new file)

---

### Checkpoint: Backend Complete

- [ ] All unit and integration tests pass successfully (`bun run test`).
- [ ] Run preflight checks with zero errors: `bun run preflight`.
- [ ] Ready for human review before proceeding to the frontend implementation (Phase C).

---

## 3. Risks & Mitigations

| Risk                                               | Impact | Mitigation                                                                                                                                      |
| -------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Dynamic merging increases Vertex AI prompt latency | Low    | Dynamic skills are merged in-memory and represent simple text blocks. Latency impact is minimal.                                                |
| Forcing prompt injection is bypassed by the LLM    | Medium | Use aggressive formatting (e.g., `CRITICAL: You MUST use the skill...`) in the system instruction. This is extremely reliable in Gemini models. |
| Kebab-case validation fails on special characters  | Low    | Use strict Zod regex validation (`/^[a-z0-9-]+$/`) on creation, forcing clean naming conventions from the start.                                |
