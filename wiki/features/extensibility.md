Here is a draft plan to refine:

# Canvas Agent Extensibility — Brainstorm

## Context

The canvas agent (Director) is currently extensible only via `style.md` — a per-canvas markdown file injected into the Director prompt. Everything else — pattern skills, primitive skills, tools, and the Director prompt itself — is hardcoded in the codebase.

The goal is to let users modify agent behavior, add capabilities, and define reusable workflows without touching code. This maps directly to what tools like Claude Code, Cursor, and LangGraph have solved with different tradeoffs.

---

## Current Extensibility Points

| What                           | Where                             | Dynamic?     | User-accessible?    |
| ------------------------------ | --------------------------------- | ------------ | ------------------- |
| Style                          | Firestore `styles` collection     | ✓ per canvas | ✓ (already shipped) |
| Pattern skills                 | `skills/patterns/` (filesystem)   | ✗ build-time | ✗ dev-only          |
| Primitive skills               | `skills/primitives/` (filesystem) | ✗ build-time | ✗ dev-only          |
| Director prompt rules          | `prompts.ts` hardcoded            | ✗            | ✗                   |
| Tools exposed to Director      | `tools.ts` hardcoded              | ✗            | ✗                   |
| Canvas defaults (model, ratio) | Firestore per canvas              | ✓            | ✓ (UI exists)       |

---

## Three Extensibility Dimensions (SOTA-derived)

### Dimension 1 — Behavioral Injection ("Canvas Instructions")

**SOTA analogue**: Cursor `.cursorrules`, `CLAUDE.md`, OpenAI custom instructions

**Idea**: A free-form markdown field per canvas (or global per user) injected verbatim into the Director's system prompt — like a `.cursorrules` for the canvas.

**What users write in it**:

- Tone/communication style ("never ask for clarification, always infer")
- Creative constraints ("only use black and white imagery")
- Domain context ("this is for a luxury fashion brand")
- Generation biases ("prefer cinematic 16:9 aspect ratios")
- Per-project vocabulary ("when I say 'hero shot' use the subject-on-white-bg template")

**Implementation**: Nearly identical to `style.md` injection. Add an `instructionsId` field (or just an `instructions` text field) to the canvas Firestore document. Append to `buildDirectorInstruction()` after the style block.

**UI/UX**:

- Tab in canvas settings panel: **Style | Instructions**
- Textarea with placeholder examples
- "Test" button to show the full system prompt (dev mode)
- Scope: per-canvas today, global user setting later

**Effort**: Very low — style injection is already wired, this is a parallel slot.

---

### Dimension 2 — User Pattern Skills

**SOTA analogue**: Claude Code slash commands / skills, MCP prompt templates

**Idea**: Users can create, clone, and share pattern SKILL.md files. These get loaded alongside built-in patterns and become callable by the Director (`list_skills` → `load_skill`).

**What a user-pattern looks like**:

```markdown
---
name: my-brand-campaign
description: Generate a 3-shot campaign with brand logo placement
---

## Rules

Phase 0: Always generate a hero product shot first.
Phase 1: Add 2 lifestyle shots with brand in top-right corner.
Phase 2: Suggest social crop variants.
```

**Implementation path**:

1. Store user patterns in Firestore `canvasSkills` (or `userSkills`) collection as `{ name, description, content, userId, isPublic }`
2. Load user patterns at chat-request time alongside built-in filesystem patterns
3. Inject them into ADK's skill registry before the agent runs (need to check if ADK supports dynamic skill addition post-init, or if we need to convert them to SkillTools manually)

**Two creation modes**:

- **Clone & Customize**: fork a built-in pattern (character-generation, multi-shot-video, etc.) and edit it
- **Create from scratch**: blank template wizard with guided fields (name, trigger condition, phases)

**UI/UX**:

- Skills library panel (like the styles panel today)
- "My Skills" section alongside "Built-in Skills"
- "Clone" button on built-in skills
- Markdown editor for skill content
- Skills can be scoped: private / shared with canvas / public

**Effort**: Medium — requires Firestore collection + skill injection at runtime + skill editor UI.

---

### Dimension 3 — Flows as Agent Tools

**SOTA analogue**: MCP servers, LangGraph custom tool nodes, CrewAI `@tool` decorator

**Idea**: A flow defined in the Flow Editor can be toggled as a canvas tool. The Director can call this flow by name, pass inputs, and receive the output as a new canvas node.

**Concrete example**:

- User builds a flow: `[text input] → [LLM rewriter] → [image generation]` — a "brand copywriter" pipeline
- User clicks "Expose as canvas tool" on that flow
- Canvas agent can now invoke this flow: `"Generate a campaign headline and image for summer"` → Director calls `brandCopywriterTool(brief)` → flow runs → output lands on canvas

**What this unlocks**:

- Users compose LLM chains, conditional logic, upscale sequences in the visual editor
- Then use them as first-class operations in the canvas agent
- Bridges the two product surfaces (Flow Editor ↔ Canvas)

**Implementation path**:

1. Add `exposeAsCanvasTool: boolean` + `toolDescription: string` to Flow Firestore document
2. At chat-request time, load user's "exposed" flows → synthesize ADK tool definitions from flow metadata
3. Add a `planFlowExecutionTool` (or per-flow dynamic tools) to the Director's tool set
4. When Director calls a flow tool, POST to `/api/flows/[id]/execute` with inputs
5. Flow result → `canvas-node` with reference to the flow execution

**UI/UX**:

- Toggle in flow settings: "Make available to canvas agent"
- Description field: "What does this flow do?" (used by Director to decide when to call it)
- In canvas sidebar: "Custom Tools" section listing exposed flows
- Agent mentions tool by name when using it: "I'll use your Brand Copywriter flow for this"

**Effort**: High — requires new API surface, flow executor integration, and dynamic tool synthesis.

---

## Comparison Matrix

| Dimension           | User effort to create      | Agent capability gain    | Implementation effort | Discovery in UI |
| ------------------- | -------------------------- | ------------------------ | --------------------- | --------------- |
| Canvas Instructions | Low (write markdown)       | Behavior/style tuning    | Very low              | Settings panel  |
| User Pattern Skills | Medium (write SKILL.md)    | New multi-step workflows | Medium                | Skills library  |
| Flows as Tools      | Low (build in flow editor) | Custom operations/chains | High                  | Sidebar widget  |

---

## Decided Approach

**All three phases, A → B → C.** User confirmed.

---

### Phase A — Canvas Instructions _(1-2 days)_

**Scope**: Global user default + per-canvas override. Like `.cursorrules` at global vs. project level.

**Data model**:

- `users/{userId}` → add `defaultInstructions: string` field
- `canvases/{id}` → add `instructionsOverride: string` field (empty = inherit global)

**Runtime**: At chat-request time, merge `defaultInstructions` + `instructionsOverride` → inject into `buildDirectorInstruction()` after the style block.

**UI**:

- Canvas settings panel: new "Instructions" tab (alongside existing "Style" tab)
- Global user settings: "Default Agent Instructions" textarea
- Clear indication of scope: "These apply to all canvases unless overridden"

**Files to touch**:

- `src/lib/canvas/agent/prompts.ts` — `buildDirectorInstruction()` add instructions param
- `src/app/api/canvases/[id]/chat/route.ts` — load + merge instructions, pass to runner
- `src/lib/services/canvas.service.ts` — add instructions fields
- Canvas settings UI component (wherever style tab lives today)

---

### Phase B — User Pattern Skills _(1-2 weeks)_

**Target**: All users via guided wizard UI. Markdown under the hood, abstracted away.

**Data model** in Firestore:

```
userSkills/{skillId}:
  userId, name, description, triggerHints, phases[{ title, rules }],
  scope: "private" | "public", createdAt, updatedAt
```

**Runtime**: At chat-request time, load user's skills from Firestore → serialize to SKILL.md format → inject into ADK alongside built-in pattern skills.

**Key open question**: ADK's `loadAllSkillsInDir()` reads from filesystem. Need to either:
a) Materialize user skills to a temp directory per-request (simplest)
b) Implement a custom `SkillLoader` that reads from Firestore (cleaner, more work)
c) Convert user skills to `SkillTool` objects manually (best, requires ADK internals knowledge)

**UI wizard**:

1. Name + description (what triggers this skill)
2. Phase builder: add phases with title + rules textarea
3. Preview: shows the raw SKILL.md it will generate
4. Save → appears in "My Skills" library

**Skills library panel**: Tabs for Built-in / My Skills / Public. Clone button on built-ins.

**Files to add/touch**:

- `src/lib/services/skill.service.ts` (new — Firestore CRUD for user skills)
- `src/lib/canvas/agent/canvas-agent.ts` — accept + inject dynamic skills
- Skill editor UI + skills library panel component
- Chat API route — load user skills before building agent

---

### Phase C — Flows as Tools _(3-4 weeks)_

**Concept**: "Expose as canvas tool" toggle on a flow. Director can call it by name.

**Data model**: Add `canvasTool: { enabled: boolean, description: string, inputSchema }` to Flow Firestore document.

**Runtime**:

1. Load user's "exposed" flows at chat-request time
2. Synthesize ADK `FunctionTool` definitions from flow metadata + input/output node schemas
3. Add to Director tool set
4. When Director calls a flow tool → POST to `/api/flows/[id]/execute` → result becomes canvas node

**UI**:

- Flow settings: "Canvas Tool" toggle + description field
- Canvas sidebar "Custom Tools" widget listing exposed flows
- Agent references tool by name in its chat responses

**Files to add/touch**:

- `src/app/api/flows/[id]/execute/route.ts` (new)
- `src/lib/canvas/agent/tools.ts` — dynamic tool synthesis from flow definitions
- Flow settings UI
- Canvas agent runner — load + inject flow tools

---

## Verification Plan

**Phase A**: Open a canvas → set global instructions "always use square crops" → make an image request → confirm Director applies square aspect ratio without being asked. Check canvas override overrides global.

**Phase B**: Create a skill "Logo Placement Campaign" → trigger via chat → confirm Director loads and follows the skill's phases. Clone a built-in → modify rules → verify modified version is used.

**Phase C**: Build a simple flow (text → LLM → image) → expose as tool → open canvas → ask agent to use it → confirm flow runs and output appears on canvas.
