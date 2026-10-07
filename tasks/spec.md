# Spec: Add Gemini Nano Banana 2.1 as Default Image Generation Model

## Objective

Integrate **Gemini Nano Banana 2.1** (`gemini-nano-banana-2.1`) as a new and default image generation and editing model across FlowCraft — covering both the **Flow Editor** (`/flow/[id]`) and **Canvas Agents** (`/canvas/[id]`).

Per the [Google Cloud Gemini Nano Banana 2.1 documentation](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/nano-banana-2-1):

- **Model ID**: `gemini-nano-banana-2.1`
- **Launch stage**: GA
- **Supported aspect ratios**: `1:1`, `3:2`, `2:3`, `3:4`, `1:4`, `4:1`, `4:3`, `4:5`, `5:4`, `1:8`, `8:1`, `9:16`, `16:9`, `21:9`, `9:21` (plus `"Auto"` in Flow/Canvas config)
- **Supported resolutions (`imageSize`)**: `1K`, `2K`, `4K`
- **Capabilities**: Thinking (`MINIMAL`, `HIGH`), System instructions, Google Search grounding, Image Search grounding, multimodal image generation & editing (up to 14 input images, video/text/PDF inputs)
- **Unsupported parameters**: `seed`, `topK`, `logprobs`, `temperature`, `topP` (must not be sent)

## Tech Stack

- **Framework/Language**: Next.js 16 (App Router), React 19, TypeScript
- **Validation**: Zod (`src/lib/schemas.ts`)
- **AI SDK**: `@google/genai` (Vertex AI) & `@google/adk` (Canvas Agent)
- **Testing**: Vitest with `jsdom`

## Commands

- **Dev**: `bun run dev`
- **Build**: `bun run build`
- **Type Check**: `bun run check`
- **Lint**: `bun run lint`
- **Format**: `bun run format`
- **Test**: `bun run test`
- **Preflight**: `bun run preflight`

## Project Structure

- `src/lib/constants.ts`:
    - Add `GEMINI_NANO_BANANA_2_1: "gemini-nano-banana-2.1"` to `MODELS.IMAGE`.
    - Add `[MODELS.IMAGE.GEMINI_NANO_BANANA_2_1]: ["MINIMAL", "HIGH"]` to `MODEL_THINKING_LEVELS`.
    - Add `[MODELS.IMAGE.GEMINI_NANO_BANANA_2_1]` entry to `IMAGE_MODEL_CONFIGS` with ratios (`Auto`, `1:1`, `1:4`, `1:8`, `3:2`, `2:3`, `3:4`, `4:1`, `4:3`, `4:5`, `5:4`, `8:1`, `9:16`, `16:9`, `21:9`, `9:21`), `imageSizes: ["1K", "2K", "4K"]`, and `grounding: { google: true, image: true }`.
- `src/lib/schemas.ts`:
    - Add `"9:21"` to `ImageDataAspectRatioSchema`.
    - Add `MODELS.IMAGE.GEMINI_NANO_BANANA_2_1` to `ImageDataModelSchema`.
    - Update `GenerateImageSchema` default `model` to `MODELS.IMAGE.GEMINI_NANO_BANANA_2_1`.
- `src/primitives/image/definition.ts`:
    - Update `flow.gatherInputs` fallback model to `MODELS.IMAGE.GEMINI_NANO_BANANA_2_1`.
    - Update `flow.defaultData.model` to `MODELS.IMAGE.GEMINI_NANO_BANANA_2_1`.
    - Update `canvas.toRequest` fallback model to `MODELS.IMAGE.GEMINI_NANO_BANANA_2_1`.
- `src/primitives/image/FlowNode.tsx`:
    - Update fallback model and `useEffect` auto-correction to `MODELS.IMAGE.GEMINI_NANO_BANANA_2_1`.
    - Add `Nano Banana 2.1` (`MODELS.IMAGE.GEMINI_NANO_BANANA_2_1`) option to the model selector dropdown.
- `src/primitives/image/ConfigPanel.tsx`:
    - Update fallback model and `useEffect` auto-correction to `MODELS.IMAGE.GEMINI_NANO_BANANA_2_1`.
    - Add `Nano Banana 2.1 (Gemini Nano Banana 2.1)` (`MODELS.IMAGE.GEMINI_NANO_BANANA_2_1`) option to the model selector dropdown.
- `src/lib/services/gemini.service.ts`:
    - Update `generateImage` default `selectedModel` fallback to `MODELS.IMAGE.GEMINI_NANO_BANANA_2_1`.
- `src/components/canvas/canvas-agent-settings-dialog.tsx`:
    - Update `DEFAULT_AGENT_SETTINGS.imageModel` to `MODELS.IMAGE.GEMINI_NANO_BANANA_2_1`.
    - Add `{ id: MODELS.IMAGE.GEMINI_NANO_BANANA_2_1, label: "Nano Banana 2.1" }` to `IMAGE_MODELS`.
    - Update `imageModelConfig` fallback to `IMAGE_MODEL_CONFIGS[MODELS.IMAGE.GEMINI_NANO_BANANA_2_1]`.
- `src/lib/canvas/agent/tools.ts`:
    - Add `MODELS.IMAGE.GEMINI_NANO_BANANA_2_1` to `IMAGE_MODELS` (which also automatically propagates `"9:21"` into `IMAGE_ASPECT_RATIOS` and `ALL_ASPECT_RATIOS`).
- `src/lib/canvas/agent/prompts.ts`:
    - Include `9:21` in the `VALID OPTION VALUES for ask_user` image aspect ratio list.
- `src/lib/canvas/agent/skills/primitives/image-generation/SKILL.md`:
    - Update `## Model hints` to list `gemini-nano-banana-2.1` as the **default** image model and retain `gemini-3.1-flash-image` as an available alternative.
- `README.md` & `docs/canvas/adk.mdx`:
    - Document `gemini-nano-banana-2.1` (Nano Banana 2.1) as the default image model.
- `src/__tests__/`:
    - Update and add unit tests covering `GenerateImageSchema` defaults, `9:21` aspect ratio, `IMAGE_MODELS` in ADK tools, `geminiService.generateImage` default model, and `ImageNode` rendering.

## Code Style

Follow existing codebase conventions:

- Centralize model identifiers and capability matrices in `src/lib/constants.ts`.
- Derive Zod enums and ADK tool schemas from `MODELS` and `IMAGE_MODEL_CONFIGS`.

```typescript
// src/lib/constants.ts
export const MODELS = {
    // ...
    IMAGE: {
        GEMINI_2_5_FLASH_IMAGE: "gemini-2.5-flash-image",
        GEMINI_3_PRO_IMAGE: "gemini-3-pro-image",
        GEMINI_3_1_FLASH_IMAGE: "gemini-3.1-flash-image",
        GEMINI_3_1_FLASH_LITE_IMAGE: "gemini-3.1-flash-lite-image",
        GEMINI_NANO_BANANA_2_1: "gemini-nano-banana-2.1",
        IMAGEN_4_0_UPSCALE: "imagen-4.0-upscale-preview",
    },
    // ...
} as const;
```

## Testing Strategy

- **Framework**: Vitest (`bun run test`)
- **Unit Tests**:
    - `src/__tests__/unit/lib/resolution-schemas.test.ts`: Verify `GenerateImageSchema` defaults to `gemini-nano-banana-2.1`, accepts `gemini-nano-banana-2.1`, and accepts `9:21` aspect ratio.
    - `src/__tests__/unit/lib/canvas/adk/adk-tools.test.ts`: Verify `planImageGenerationTool` and `planProductionTool` accept `gemini-nano-banana-2.1` and `9:21`.
    - `src/__tests__/unit/lib/services/gemini.service.test.ts`: Verify `geminiService.generateImage` uses `gemini-nano-banana-2.1` when no model is specified.
    - `src/__tests__/unit/lib/primitives/image-node.test.tsx` & `src/__tests__/unit/lib/nodes/node-gather-inputs.test.ts`: Verify Flow Image node defaults and input gathering fallback to `gemini-nano-banana-2.1`.

## Boundaries

- **Always do**:
    - Keep existing image models (`gemini-2.5-flash-image`, `gemini-3-pro-image`, `gemini-3.1-flash-image`, `gemini-3.1-flash-lite-image`) valid in schemas and UI dropdowns so existing saved Flows and Canvases continue to work without breaking.
    - Run `bun run preflight` before finishing.
- **Ask first**:
    - Removing or migrating existing persisted nodes that explicitly selected an older valid model (`gemini-3.1-flash-image`, etc.).
- **Never do**:
    - Pass unsupported parameters (`seed`, `topK`, `logprobs`, `temperature`, `topP`) to `gemini-nano-banana-2.1`.
    - Enable `512` resolution on `gemini-nano-banana-2.1` (only `1K`, `2K`, `4K` are supported per the official spec).

## Success Criteria

1. `MODELS.IMAGE.GEMINI_NANO_BANANA_2_1` (`"gemini-nano-banana-2.1"`) is defined in `src/lib/constants.ts` with its supported ratios (including `9:21`), resolutions (`1K`, `2K`, `4K`), thinking levels (`MINIMAL`, `HIGH`), and grounding (`google: true, image: true`).
2. Every new Image node in the Flow Editor defaults to `gemini-nano-banana-2.1` ("Nano Banana 2.1"), and both `FlowNode.tsx` and `ConfigPanel.tsx` allow selecting it.
3. Canvas Agent settings (`DEFAULT_AGENT_SETTINGS`), ADK tools (`IMAGE_MODELS`), skill hints (`image-generation/SKILL.md`), image primitive `canvas.toRequest`, and `geminiService.generateImage` all default to `gemini-nano-banana-2.1`.
4. `GenerateImageSchema` and `ImageDataSchema` validate `gemini-nano-banana-2.1` and aspect ratio `9:21`, with `GenerateImageSchema` defaulting to `gemini-nano-banana-2.1`.
5. `bun run preflight` (format, typecheck, lint, unit tests) passes with zero errors.

## Open Questions

None — requirements and model specifications from the Google Cloud documentation are unambiguous.
