# Implementation Plan: Add Gemini Nano Banana 2.1 as Default Image Generation Model

## Overview

We will integrate `gemini-nano-banana-2.1` ("Nano Banana 2.1") as the new and default image generation and editing model across FlowCraft — covering both the Flow Editor and Canvas Agents.

## Architecture Decisions

1. **Model Constants & Capabilities (`src/lib/constants.ts`)**:
    - Define `MODELS.IMAGE.GEMINI_NANO_BANANA_2_1 = "gemini-nano-banana-2.1"`.
    - Register `["MINIMAL", "HIGH"]` thinking levels in `MODEL_THINKING_LEVELS`.
    - Register `IMAGE_MODEL_CONFIGS[MODELS.IMAGE.GEMINI_NANO_BANANA_2_1]` with supported aspect ratios (`Auto`, `1:1`, `1:4`, `1:8`, `3:2`, `2:3`, `3:4`, `4:1`, `4:3`, `4:5`, `5:4`, `8:1`, `9:16`, `16:9`, `21:9`, `9:21`), resolutions (`1K`, `2K`, `4K`), and grounding (`google: true, image: true`).
2. **Schemas (`src/lib/schemas.ts`)**:
    - Add `"9:21"` to `ImageDataAspectRatioSchema`.
    - Add `MODELS.IMAGE.GEMINI_NANO_BANANA_2_1` to `ImageDataModelSchema`.
    - Set `GenerateImageSchema` default `model` to `MODELS.IMAGE.GEMINI_NANO_BANANA_2_1`.
3. **Flow Editor & Image Primitive (`src/primitives/image/`)**:
    - Set `MODELS.IMAGE.GEMINI_NANO_BANANA_2_1` as default/fallback in `definition.ts`, `FlowNode.tsx`, and `ConfigPanel.tsx`.
    - Add `Nano Banana 2.1` to the model selector in `FlowNode.tsx` and `ConfigPanel.tsx`.
4. **Canvas Agent & Gemini Service (`src/lib/canvas/`, `src/components/canvas/`, `src/lib/services/gemini.service.ts`)**:
    - Set `MODELS.IMAGE.GEMINI_NANO_BANANA_2_1` as default in `DEFAULT_AGENT_SETTINGS`, `geminiService.generateImage`, `IMAGE_MODELS` in `tools.ts`, and `image-generation/SKILL.md`.
    - Add `9:21` to the valid image aspect ratio options in `DIRECTOR_PROMPT`.

## Task List

### Phase 1: Foundation (Constants & Schemas)

- [ ] **Task 1**: Register `GEMINI_NANO_BANANA_2_1` and `"9:21"` in `src/lib/constants.ts` and `src/lib/schemas.ts`, and update schema unit tests in `src/__tests__/unit/lib/resolution-schemas.test.ts`.

### Phase 2: Gemini Service & Image Primitive (Flow Editor + Server)

- [ ] **Task 2**: Update `src/lib/services/gemini.service.ts`, `src/primitives/image/definition.ts`, `src/primitives/image/FlowNode.tsx`, and `src/primitives/image/ConfigPanel.tsx` to use `GEMINI_NANO_BANANA_2_1` as default and expose it in Flow UI dropdowns. Update unit tests in `gemini.service.test.ts`, `image-node.test.tsx`, and `node-gather-inputs.test.ts`.

### Phase 3: Canvas Agent, Tools, Skills & Settings UI

- [ ] **Task 3**: Update `src/lib/canvas/agent/tools.ts`, `src/lib/canvas/agent/prompts.ts`, `src/lib/canvas/agent/skills/primitives/image-generation/SKILL.md`, and `src/components/canvas/canvas-agent-settings-dialog.tsx`. Update ADK tool unit tests in `src/__tests__/unit/lib/canvas/adk/adk-tools.test.ts`.

### Phase 4: Documentation & Preflight Verification

- [ ] **Task 4**: Update `README.md`, `docs/canvas/adk.mdx`, `AGENTS.md`, and `wiki/architecture/architecture.md`, and run `bun run preflight`.
