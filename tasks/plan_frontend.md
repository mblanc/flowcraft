# Implementation Plan: Canvas Agent Extensibility — Step 2: Frontend UI

This document breaks down the frontend implementation of **Dimension 2: User Pattern Skills & Slash Commands** into vertical, verifiable, and styled tasks.

---

## 1. Task List

### Phase 4: State & Library Panel

#### Task F1: Zustand Store Extension

- **Description**: Add `disabledSkills` state and actions to `use-canvas-store.ts` to manage canvas-specific skill toggles.
- **Acceptance criteria**:
    - [ ] `disabledSkills: string[]` is added to the `CanvasStore` state (defaults to `[]`).
    - [ ] `setCanvas` sets `disabledSkills: canvas.disabledSkills ?? []`.
    - [ ] Action `toggleDisabledSkill(skillName: string)` is implemented to optimistically add/remove the skill name from the local array.
- **Verification**:
    - [ ] Compile check passes: `bun run check`
- **Files likely touched**:
    - `src/lib/store/use-canvas-store.ts`

#### Task F2: Skills Library Component

- **Description**: Create `src/components/canvas/skills-library.tsx` to list and manage all skills (built-in, custom, and templates).
- **Acceptance criteria**:
    - [ ] Fetches user's custom skills and community templates from `GET /api/skills`.
    - [ ] Merges with built-in skills (statically imported or loaded via component logic).
    - [ ] Lists skills in three groups: "My Skills", "Built-in", and "Templates".
    - [ ] Renders a toggle Switch (`@/components/ui/switch`) for each skill showing its active state (checked if NOT in `disabledSkills`).
    - [ ] Toggling a skill calls `toggleDisabledSkill` in the store and fires a background `POST /api/canvases/[id]/toggle-skill` request.
    - [ ] Displays "Edit", "Delete", and "Clone" buttons on eligible cards.
- **Verification**:
    - [ ] Component compiles cleanly and passes type check.
- **Files likely touched**:
    - `src/components/canvas/skills-library.tsx` [NEW]

---

### Phase 5: Skill Editor & Chat Panel Integration

#### Task F3: Skill Editor Wizard

- **Description**: Create `src/components/canvas/skill-editor.tsx` providing a multi-phase wizard/form inside a Modal Dialog to create or edit pattern skills.
- **Acceptance criteria**:
    - [ ] Accessible via a "+ New Skill" button in the library or "Edit" on custom skill cards.
    - [ ] Fields:
        - **Name**: auto kebab-case on input (e.g. typing "Social Campaign" becomes "social-campaign"), constrained to `^[a-z0-9-]+$`.
        - **Description**: text area.
        - **Trigger Hints**: tag input or comma-separated list of keywords.
        - **Phases**: dynamic list (add/remove) where each phase has a **Title** and **Rules** text box.
    - [ ] Submitting calls `POST /api/skills` (for creation) or `PATCH /api/skills/[id]` (for updates) and refreshes the library list.
- **Verification**:
    - [ ] Form validation triggers on empty fields, short descriptions, or invalid names.
- **Files likely touched**:
    - `src/components/canvas/skill-editor.tsx` [NEW]

#### Task F4: Chat Panel Integration

- **Description**: Add a Tabs interface to the `CanvasChatPanel` to let users toggle between "Chat" and "Skills Library".
- **Acceptance criteria**:
    - [ ] Renders a segment control or tabs header at the top of the panel using shadcn Tabs components.
    - [ ] "Chat" tab shows the message list and chat input (default).
    - [ ] "Skills" tab shows the `<SkillsLibrary />` panel.
- **Verification**:
    - [ ] Switch between tabs is smooth, maintaining chat session state.
- **Files likely touched**:
    - `src/components/canvas/canvas-chat-panel.tsx`

---

### Phase 6: Polish & Verification

#### Task F5: Preflight & Visual Polish

- **Description**: Polish UI components to fit Flowcraft's high-end dark glassmorphism theme, and run the full CI gate.
- **Acceptance criteria**:
    - [ ] Card designs use modern border gradients, glass backdrops, and elegant micro-animations.
    - [ ] `bun run preflight` passes with zero linting, compilation, or test errors.
- **Verification**:
    - [ ] Verified clean builds.
