# Spec: Vox Director Pattern Skill Adaptation for Canvas Director Agent

## Objective

Adapt the **Vox Director** automated paper-collage video creation workflow into a native **Canvas Agent Pattern Skill** (`vox-director`) within Flowcraft.

When a user requests a Vox-style paper-collage video (or invokes `/vox-director`), the Canvas Director Agent (Agent B) will:

1. Leverage the active Canvas `STYLE.md` (`activeStyle`) or load one of the Vox style presets (`american-retro`, `swiss-modern`, `punk-zine`, etc.) to define the visual identity.
2. Present a structured beat map in chat (narrative script, beat breakdown, shot list with 2 shots per beat: wide + detail cut-in).
3. Generate a multi-step `ProductionPlan` DAG containing:
    - **Narration Audio (`t2s`)**: Text-to-Speech nodes generated for each beat narration using **`gemini-3.1-flash-tts-preview`**.
    - **Music Track (`music`)**: Background music generation node covering the total sequence length using **`lyria-3-clip-preview`**.
    - **Keyframe Posters (`t2i`)**: Text-to-Image nodes producing paper-collage posters using Vox 5-part prompt structures (medium, era, palette, typography, finish) via **`imagen-4.0`** / **`gemini-3.1-flash-image`**.
    - **Living Poster Motion (`i2v`)**: Image-to-Video nodes animating each poster with varied camera moves and rich element motion via **`veo-3.1-fast-generate-001`** / **`gemini-omni-flash-preview`**, linked via node dependencies (`depends_on`) to their keyframe images.
4. Orchestrate DAG execution on the canvas via `executePlan`.

---

## Technical Audit & System Integration

### 1. `t2s` Primitive & Model Selection

- **ADK / Director Agent Level**: `t2s` is defined in `MEDIA_OPERATIONS` (`src/lib/canvas/types.ts`), documented in `prompts.ts`, and has a primitive skill instruction (`src/lib/canvas/agent/skills/primitives/t2s/SKILL.md`).
- **Model Choice**: **`gemini-3.1-flash-tts-preview`** (`MODELS.AUDIO.GEMINI_3_1_FLASH_TTS_PREVIEW`) via `@google/genai`.
- **Action**: Build `src/primitives/t2s/` execution primitive in `src/primitives/t2s/execute.ts` using `geminiService.generateSpeech()` and register it in `server-registry.ts` and `component-registry.ts`.

### 2. Prompt Engineer Integration for Vox 5-Part Keyframe Prompts

`PromptEngineer` (`src/lib/canvas/agent/prompt-engineer.ts`) enriches raw `promptIntent` from Director Agent into final model prompts using primitive skill specifications:

1. **Director Agent Output**: Generates `t2i` step `promptIntent` tagged with `"VOX PAPER COLLAGE KEYFRAME POSTER:"` outlining the 5 core Vox elements (Medium, Era/Style, Color Palette, Headline Typography, Finish).
2. **Primitive Skill Spec Extension**: Add `src/lib/canvas/agent/skills/primitives/image-generation/references/vox-collage.md`. `PromptEngineer` automatically loads all `references/*.md` files inside `image-generation/`.
3. **Prompt Engineer Transformation**: `PromptEngineer` reads `vox-collage.md` and maps the 5 Vox collage pillars into the canonical `[GENERAL DESCRIPTION]` + `[STRUCTURED FEATURES]` format (SUBJECT, ENVIRONMENT, STYLE & MEDIUM, FORBIDDEN) expected by Imagen 4.

---

## Assumptions & Alignment

1. **Style System**: Integrates natively with Flowcraft's existing `activeStyle` (`STYLE.md`) feature. The user's attached `STYLE.md` (or a selected Vox style preset) provides the Creative Direction Tokens for image generation.
2. **Audio Generation**: Always includes full audio generation: beat narrations (`t2s`) using `gemini-3.1-flash-tts-preview` and background music (`music`) using `lyria-3-clip-preview`.
3. **Motion Method**: Uses **Living Poster Motion (`i2v`)** as the standard generation path. Each full collage poster is animated by AI video models (Veo 3.1 / Gemini Omni Video) with specified camera moves and element activity.
4. **Execution Engine**: Utilizes existing Flowcraft Canvas infrastructure (ADK Agent Runner, `planProductionTool`, `topology.ts`, `generation.ts`, Gemini / Vertex AI models).

---

## Tech Stack & Model Roster

- **Framework**: Next.js 16 / React 19 (App Router)
- **Language**: TypeScript 5
- **Agent Framework**: `@google/adk` 1.1.0 (CanvasAgentRunner with `LlmAgent` & `SkillToolset`)
- **State Management**: Zustand 5 (`use-canvas-store.ts`)
- **AI Model Matrix**:
    - **Director Agent**: `gemini-2.5-flash` (ADK Orchestrator)
    - **Prompt Engineer**: `gemini-3.5-flash`
    - **Keyframe Generation (`t2i`)**: `gemini-3.1-flash-image` / Imagen 4.0
    - **Motion Generation (`i2v`)**: `veo-3.1-fast-generate-001` / `gemini-omni-flash-preview`
    - **Narration Generation (`t2s`)**: `gemini-3.1-flash-tts-preview`
    - **Music Generation (`music`)**: `lyria-3-clip-preview`

---

## Commands

All commands run via `bun` from project root:

```bash
bun run dev           # Start Next.js development server
bun run check         # TypeScript type-checking
bun run lint          # ESLint static analysis
bun run format        # Prettier formatting
bun run test          # Vitest unit & integration tests
bun run test:eval     # Canvas Agent evaluation tests
bun run preflight     # Full pre-merge quality gate
```

---

## Project Structure

```
src/primitives/t2s/                   # NEW: Text-to-Speech Primitive
├── definition.ts                     # Schema & node definition
├── execute.ts                        # Backend execution handler (Gemini TTS)
└── index.ts

src/lib/canvas/agent/skills/primitives/image-generation/references/
└── vox-collage.md                    # NEW: Vox Collage Prompt Specification for PromptEngineer

src/lib/canvas/agent/skills/patterns/vox-director/
├── SKILL.md                          # Primary ADK pattern skill instruction for Director Agent
├── references/                       # Domain knowledge references for LLM prompting
│   ├── beat-layer.md                 # Narrative arcs (timeline, pas, bab, how_it_works, etc.)
│   ├── prompt-guide.md               # 5-part Vox prompt formula & visual theme presets
│   ├── voices.md                     # Voice selection matrix by language and topic tone
│   └── motion-guide.md               # Camera move catalog & element motion rules
specs/
└── vox-director-pattern-skill.md     # Specification file in repository
```

---

## Phase 2: Technical Implementation Plan

### Dependencies & Order of Execution

1. **Foundation (Primitive Engine)**: Implement `t2s` primitive in `src/primitives/t2s/` and register in `server-registry.ts`. _Dependency for executing narration audio._
2. **Prompt Engineering (Keyframe Prompts)**: Add `vox-collage.md` in `src/lib/canvas/agent/skills/primitives/image-generation/references/`. _Dependency for PromptEngineer Vox collage enrichment._
3. **Pattern Skill (Director Agent Knowledge)**: Create `vox-director` pattern skill directory and references (`SKILL.md`, `beat-layer.md`, `prompt-guide.md`, `voices.md`, `motion-guide.md`).
4. **Agent Integration & Routing**: Verify `/vox-director` pattern skill loading in `CanvasAgent` and `agent-runner.ts`.
5. **Verification & Eval**: Write unit tests, ADK integration tests, and agent planning evaluation tests.

---

## Phase 3: Tasks Checklist

- [ ] **Task 1: Implement `t2s` (Text-to-Speech) Primitive**
    - **Acceptance**: `src/primitives/t2s` is created with `definition.ts` and `execute.ts` using `gemini-3.1-flash-tts-preview`, registered in `server-registry.ts` and `component-registry.ts`.
    - **Verify**: `bun run test src/__tests__/unit/primitives/t2s.test.ts` passes.
    - **Files**: `src/primitives/t2s/definition.ts`, `src/primitives/t2s/execute.ts`, `src/primitives/server-registry.ts`, `src/primitives/component-registry.ts`.

- [ ] **Task 2: Add `vox-collage.md` Prompt Engineer Reference**
    - **Acceptance**: `vox-collage.md` is added to `src/lib/canvas/agent/skills/primitives/image-generation/references/`. `PromptEngineer` formats Vox collage keyframe intents into canonical Imagen 4 prompts.
    - **Verify**: `bun run test src/__tests__/unit/lib/canvas/prompt-engineer.test.ts` passes.
    - **Files**: `src/lib/canvas/agent/skills/primitives/image-generation/references/vox-collage.md`.

- [ ] **Task 3: Create `vox-director` Pattern Skill & Reference Files**
    - **Acceptance**: Directory `src/lib/canvas/agent/skills/patterns/vox-director/` created with `SKILL.md`, `references/beat-layer.md`, `references/prompt-guide.md`, `references/voices.md`, and `references/motion-guide.md`.
    - **Verify**: `bun run test src/__tests__/unit/lib/canvas/adk/adk-skills.test.ts` passes.
    - **Files**: `src/lib/canvas/agent/skills/patterns/vox-director/*`.

- [ ] **Task 4: Integrate `/vox-director` in Director Agent & ADK Runner**
    - **Acceptance**: `CanvasAgent` loads `vox-director` pattern skill, and `/vox-director` command triggers skill instruction forcing in `agent-runner.ts`.
    - **Verify**: `bun run test src/__tests__/unit/lib/canvas/adk/adk-director.test.ts` passes.
    - **Files**: `src/lib/canvas/agent/canvas-agent.ts`, `src/lib/canvas/agent/agent-runner.ts`.

- [ ] **Task 5: Add Agent Evaluation Tests & Run Preflight Gate**
    - **Acceptance**: Agent evaluation test created in `src/__tests__/eval/vox-director.eval.test.ts` verifying Director Agent's beat map and DAG production plan for Vox video requests.
    - **Verify**: `bun run check && bun run lint && bun run test` pass clean.
    - **Files**: `src/__tests__/eval/vox-director.eval.test.ts`.

---

## Boundaries

- **Always do**:
    - Implement and register the `t2s` primitive in `src/primitives/server-registry.ts` using `gemini-3.1-flash-tts-preview`.
    - Add `vox-collage.md` reference to `image-generation` primitive skill so `PromptEngineer` formats Vox collage keyframe prompts correctly.
    - Integrate Canvas `activeStyle` (`STYLE.md`) into keyframe prompt intent.
    - Generate both narration TTS (`t2s`) and background music (`music`) nodes for every Vox video request.
    - Split beats into 2 shots (wide + detail cut-in) to maintain 3–5s shot cadence.
    - Link `i2v` nodes to their parent `t2i` nodes via `depends_on` DAG edges.
- **Never do**:
    - Skip `t2s` node execution in `generation.ts`.
    - Bypassing `PromptEngineer` during plan execution.
    - Ignore the active Canvas `STYLE.md` if present.
    - Exceed 7 seconds per video shot.

---

## Success Criteria

1. **`t2s` Primitive Implementation**: `src/primitives/t2s` is fully defined, registered in `server-registry.ts`, and executes audio synthesis using `gemini-3.1-flash-tts-preview`.
2. **Prompt Engineer Integration**: `PromptEngineer` transforms Vox keyframe intents into structured Imagen prompts using `vox-collage.md` and `activeStyle`.
3. **Skill Loading & Command Response**: Director Agent loads `vox-director` pattern skill and responds to `/vox-director` or natural language requests.
4. **Complete Production Plan**: Plan contains narration nodes (`t2s`), music node (`music`), keyframe image nodes (`t2i`), and dependent video motion nodes (`i2v`).
5. **Preflight Compliance**: All tests, type checks, and preflight gates (`bun run preflight`) pass clean.
