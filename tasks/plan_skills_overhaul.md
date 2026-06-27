# Implementation Plan: Skills Overhaul & Dashboard Management

This plan outlines the steps to align FlowCraft's custom pattern skills with the [Agent Skills Specification](http://agentskills.io/specification), simplify parameters to **Name**, **Description**, and **Instructions (Markdown)**, add **Import/Export (`SKILL.md`)** support, and relocate skill management to a dedicated dashboard page `/skills`.

---

## Architectural Decisions

1. **Schema Simplification**: Remove `triggerHints` (Keywords) and `phases` (Phases/Rules list) from the database schema and Zod validation. Instead, use a single `instructions: string` field which holds the full Markdown body of the skill.
2. **Dedicated Page Route (`/skills`)**: Relocate the CRUD and management workflows from the floating Canvas sidebar to a full-sized, premium dashboard page accessible via the main sidebar navigation.
3. **Import/Export (`SKILL.md`)**:
    - **Export**: Generate a standard markdown file with YAML frontmatter containing the `name` and `description` followed by the markdown `instructions` body.
    - **Import**: Parse the uploaded `.md` file, extract frontmatter fields, validate, and save directly to the Firestore collection.
4. **Agent Integration**: Dynamically pass the `instructions` field directly to the `@google/adk` `Skill` object, eliminating the need to serialize phases on the fly.
5. **Canvas UI Polish**: Remove the creation/edit dialogues from the Canvas sidebar, transforming it into a clean, read-only list of toggle switches that links back to the dashboard for management.

---

## Task List

### Phase 1: Foundations & Schema Migration

- [x] **Task 1: Update TypeScript Types & Zod Schemas**
    - **Files**:
        - `src/lib/canvas/agent/skills/skill-types.ts`
        - `src/lib/schemas.ts`
        - `src/lib/services/skill.service.ts`
    - **Acceptance Criteria**:
        - `UserSkillDocument` contains `id`, `userId`, `name`, `description`, `instructions`, `visibility`, `sharedWith`, `sharedWithEmails`, `isTemplate`, `createdAt`, `updatedAt`.
        - `CreateSkillSchema` validates `name`, `description`, and `instructions`.
- [x] **Task 2: Refactor SkillService & Tests**
    - **Files**:
        - `src/lib/services/skill.service.ts`
        - `src/__tests__/unit/lib/services/skill.service.test.ts`
    - **Acceptance Criteria**:
        - `createSkill`, `updateSkill`, and `cloneSkill` handle `instructions` correctly.
        - `toKebabCase` name normalization is preserved.
        - All unit tests pass.
- [x] **Task 3: Refactor API Endpoints & Route Tests**
    - **Files**:
        - `src/app/api/skills/route.ts`
        - `src/app/api/skills/[id]/route.ts`
        - `src/__tests__/unit/app/api/skills/route.test.ts`
    - **Acceptance Criteria**:
        - REST endpoints accept and return the simplified schema.
        - Invalid schemas return 400 Bad Request.

### Checkpoint: Backend Foundations

- [x] Build compiles and all backend tests pass (`bun run test`)

---

### Phase 2: AI Engine Integration

- [x] **Task 4: Simplify CanvasAgent Serializer & Tests**
    - **Files**:
        - `src/lib/canvas/agent/canvas-agent.ts`
        - `src/lib/canvas/agent/agent-runner.ts`
        - `src/__tests__/unit/lib/canvas/adk/canvas-agent-dynamic.test.ts`
        - `src/__tests__/unit/lib/canvas/adk/agent-runner-slash-commands.test.ts`
    - **Acceptance Criteria**:
        - ADK serialization passes the raw markdown `instructions` directly.
        - Command triggers work perfectly.
        - Slash command tests pass.

---

### Phase 3: Dashboard UI & Import/Export

- [x] **Task 5: Add Sidebar Item & Create Dashboard `/skills` Page**
    - **Files**:
        - `src/components/sidebar.tsx`
        - `src/app/(dashboard)/skills/page.tsx` [NEW]
    - **Acceptance Criteria**:
        - "Skills" appears in the sidebar with a Sparkles icon.
        - The page lists "My Skills" and "Templates" with a premium search layout.
        - Implement **Export** button: downloads `<name>.md` with frontmatter and instructions.
        - Implement **Import** button: uploads file, parses frontmatter and instructions, saves to DB.
- [x] **Task 6: Overhaul SkillEditor Component to Markdown Editor**
    - **Files**:
        - `src/components/canvas/skill-editor.tsx`
    - **Acceptance Criteria**:
        - Shows title, description, and instructions fields.
        - Instructions field uses a side-by-side split screen showing a real-time markdown HTML preview.
- [x] **Task 7: Refactor Canvas Sidebar UI**
    - **Files**:
        - `src/components/canvas/canvas-chat-panel.tsx`
        - `src/components/canvas/skills-library.tsx`
    - **Acceptance Criteria**:
        - Remove the editor modals and CRUD buttons from the canvas page.
        - Retain the toggles for enabling/disabling skills per canvas, with a link: _"Manage Skills in Dashboard"_.

---

### Checkpoint: Complete Overhaul

- [x] Entire test suite (790+ tests) passes
- [x] Clean build and format (`bun run preflight`)
- [x] End-to-end import, edit, export, and execution works flawlessly

---

## Risks and Mitigations

| Risk                              | Impact | Mitigation                                                                                                                                                                          |
| --------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **YAML Parsing Errors on Import** | Medium | Implement robust regex/split fallback that gracefully parses files even if YAML syntax has missing quotes or spacing, defaulting the rest of the file to instructions.              |
| **Markdown Preview XSS**          | High   | Use safe rendering or standard escaping for the split-screen HTML preview, avoiding `dangerouslySetInnerHTML` without sanitation.                                                   |
| **Stale Database Records**        | Low    | Custom skills created in previous turns will be missing `instructions`. Add a fallback in `transformDoc` that combines `phases` into `instructions` if `instructions` is undefined. |

---

## Open Questions

- **Do you have a specific styling choice for the Markdown Editor?** (Recommended: a clean, tabbed editor with "Write" and "Preview" sub-tabs or a beautiful side-by-side split panel).
