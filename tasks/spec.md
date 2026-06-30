# Spec: Gemini Omni Video Generation & Editing

## Objective

Integrate Gemini Omni Flash (`gemini-omni-flash-preview`) as the default video generation and editing model across FlowCraft (Flow Editor and Agent Canvas). This enables high-speed, high-quality video generation from multimodal inputs (text, image, audio) and stateful, conversational video editing using the Gemini Interactions API.

## Tech Stack

- **Framework/Language**: Next.js 16 (App Router), React 19, TypeScript
- **AI SDK**: `@google/genai` (v1.25.0), using Vertex AI configuration
- **Database/Storage**: Firestore (for state/metadata persistence), Google Cloud Storage (for media asset hosting)

## Commands

- **Dev**: `bun run dev`
- **Build**: `bun run build`
- **Type Check**: `bun run check`
- **Lint**: `bun run lint`
- **Format**: `bun run format`
- **Test**: `bun run test`
- **Preflight**: `bun run preflight`

## Project Structure

- `src/lib/constants.ts`: Add `GEMINI_OMNI_FLASH` to `MODELS.VIDEO`. Update defaults.
- `src/lib/schemas.ts`: Add `GEMINI_OMNI_FLASH` to `GenerateVideoSchema` and set as default.
- `src/lib/canvas/types.ts`: Update `CanvasVideoData` and `CanvasNode` metadata to support `interactionId` and `previous_interaction_id`.
- `src/lib/canvas/agent/tools.ts`: Add `GEMINI_OMNI_FLASH` to `VIDEO_MODELS` enum.
- `src/lib/services/gemini.service.ts`: Implement `generateVideo` branch for `gemini-omni-flash-preview` using `ai.interactions.create`, handling polling for URI delivery, downloading, and GCS uploading.
- `src/primitives/video/definition.ts`: Update default model, input gathering (support audio, firstFrame, reference images), and UI configuration constraints (disable duration/lastFrame, restrict resolution to 720p).
- `src/lib/canvas/generation.ts`: Propagate `interactionId` and detect edits to set `previous_interaction_id`.
- `src/lib/canvas/agent/prompts.ts` & `src/lib/canvas/agent/skills/primitives/video-generation/SKILL.md`: Update Agent B (Director) prompts and skills to make it aware of conversational editing.

## Code Style

Follow the existing codebase conventions:

- Strict TypeScript type safety.
- Use Zod schemas in `src/lib/schemas.ts` as the single source of truth.
- Follow the clean architecture using primitives in `src/primitives/`.
- Use the `@google/genai` SDK for Vertex AI interactions.
- Logging via `src/app/logger.ts`.

Example of calling the Interactions API in `gemini.service.ts`:

```typescript
const interaction = await this.ai.interactions.create({
    model: "gemini-omni-flash-preview",
    input: [
        { type: "image", data: "base64_data", mime_type: "image/jpeg" },
        { type: "text", text: "prompt..." },
    ],
    response_format: {
        type: "video",
        aspect_ratio: "16:9",
        delivery: "uri",
    },
});
```

## Testing Strategy

- **Framework**: Vitest with `jsdom`
- **Unit Tests**:
    - `src/__tests__/unit/lib/services/gemini.service.test.ts`: Test the `gemini-omni-flash-preview` path in `generateVideo` (mocking `ai.interactions.create` and GCS upload).
    - `src/__tests__/unit/lib/canvas/`: Test conversational editing, ensuring `previous_interaction_id` is propagated when a video step depends on a previous video node.
    - Test resolution/schema migrations in `src/__tests__/unit/lib/resolution-schemas.test.ts`.

## Boundaries

- **Always do**:
    - Run `bun run preflight` and ensure 100% pass before completing.
    - Handle GCS upload of the generated video bytes cleanly.
    - Limit Gemini Omni video resolution to `720p`.
    - Disable duration slider and last frame input in the UI when Omni is selected.
- **Ask first**:
    - None (autonomous mode per `/mb-implement`).
- **Never do**:
    - Hardcode GCS buckets or API keys.
    - Bypass lint/format checks.
    - Remove existing Veo 3.1 support.

## Success Criteria

1. `gemini-omni-flash-preview` is the default video model for Flow Editor and Canvas.
2. Generating a video with Omni correctly uses the Interactions API, polls the resulting URI (if delivery is URI), downloads the video, uploads it to the project's GCS bucket, and returns the GCS URI.
3. The Video primitive UI correctly hides/disables duration/lastFrame and restricts resolution to 720p when Omni is selected.
4. Canvas video editing propagates `interactionId` to Firestore and passes `previous_interaction_id` to subsequent edit steps.
5. All unit tests pass and `bun run preflight` runs successfully.
