# Implementation Plan: Gemini Omni Video Generation & Editing

## Overview

We will integrate `gemini-omni-flash-preview` as the default video model in FlowCraft. This involves updating the constants, Zod schemas, the Video primitive (both definition and UI components), the Gemini Service (to call the new Interactions API, poll, download, and upload the video), and the Canvas execution engine to support stateful conversational editing.

## Architecture Decisions

1. **Model Constants & Schema Defaults**: Set `gemini-omni-flash-preview` as the default video model. Since it does not support explicit duration, we will ignore the duration parameter when calling the Interactions API.
2. **Interactions API for Omni**: For the `gemini-omni-flash-preview` model, we will branch in `gemini.service.ts` to use `ai.interactions.create`.
3. **Download and GCS Upload**: Since Omni returns either inline base64 or a Google-hosted file URI, we will handle both. For URIs, we will poll `ai.files.get` until the file is `ACTIVE`, download the bytes using `fetch` authorized via `google-auth-library`, and upload them to our GCS bucket using `storageService.uploadFile`.
4. **Conversational Editing on Canvas**: We will store `interactionId` in the canvas node metadata. When executing a plan, if a video step depends on a previous video node, we will retrieve its `interactionId` and pass it as `previous_interaction_id` to the Interactions API, setting the task to `edit`.
5. **UI Customizations**:
    - Hide the duration selector and "Last Frame" input handle when Omni is selected.
    - Restrict resolution choices to `720p` when Omni is selected.
    - Enable the `audio-input` socket on the FlowNode and gather audio references when Omni is selected.

## Task List

### Phase 1: Foundation (Constants, Schemas, & Types)

- [ ] **Task 1**: Update constants, schemas, and types.
    - Register `GEMINI_OMNI_FLASH` in `src/lib/constants.ts`.
    - Update `GenerateVideoSchema` and `VideoDataSchema` in `src/lib/schemas.ts` to include the new model and set it as the default.
    - Update `CanvasVideoData` in `src/lib/canvas/types.ts` to include `interactionId` and `previous_interaction_id`.
    - Verify: Run schema unit tests.

### Phase 2: Gemini Service & Interactions API (Core Backend)

- [ ] **Task 2**: Implement the Interactions API path in `GeminiService`.
    - Update `GenerateVideoOptions` to support `audio` and `previousInteractionId`.
    - In `generateVideo`, branch if the model is `gemini-omni-flash-preview`.
    - Call `ai.interactions.create` with mapped inputs.
    - If output is inline base64, convert to Buffer. If it's a URI, poll `ai.files.get` until `ACTIVE`, download the bytes via `google-auth-library` authorized `fetch`, and upload to GCS.
    - Verify: Write unit tests in `gemini.service.test.ts` mocking `ai.interactions.create` and GCS upload.

### Phase 3: Video Primitive & UI Updates (Flow Editor)

- [ ] **Task 3**: Update Video Primitive definition and FlowNode/ConfigPanel UI.
    - Update `src/primitives/video/definition.ts` to set Omni as default, add `audio-input` socket, and gather audio inputs.
    - Update `src/primitives/video/FlowNode.tsx` to hide duration selector and `last-frame-input` handle, and show `audio-input` handle when Omni is selected.
    - Update `src/primitives/video/ConfigPanel.tsx` to hide duration and restrict resolution to `720p` when Omni is selected.
    - Verify: Open Flow Editor, add a Video node, select Omni, and verify UI elements show/hide correctly.

### Phase 4: Canvas Conversational Editing (Canvas Engine)

- [ ] **Task 4**: Implement stateful video editing in the Canvas agent and execution engine.
    - Update `src/lib/canvas/generation.ts` to detect video-to-video edits, resolve the parent node's `interactionId`, and pass it as `previousInteractionId` to `geminiService.generateVideo`.
    - Save the returned `interactionId` to the canvas node metadata.
    - Update the Director's system prompt in `src/lib/canvas/agent/prompts.ts` and the video-generation skill doc in `src/lib/canvas/agent/skills/primitives/video-generation/SKILL.md`.
    - Verify: Write unit tests in `src/__tests__/unit/lib/canvas/` to verify `previous_interaction_id` propagation.

## Risks and Mitigations

| Risk                                         | Impact | Mitigation                                                                                                                 |
| -------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| Google Files API download requires auth      | High   | Use `google-auth-library` to get the access token from ADC and pass it in the `fetch` Authorization header.                |
| Polling takes too long and times out         | Med    | Set a reasonable timeout (e.g. 2 minutes) and ensure the serverless function `maxDuration` is sufficient.                  |
| Type errors in `@google/genai` preview types | Med    | Cast to `any` where necessary if the preview types are not fully aligned, but prefer using the correct types from the SDK. |
