- app mode
- Saving system copy canvas for flows

- List selector
- Painter / Annotate
- Video Concatenate
- Extract Frame

- Image Editor
    - Resizing (https://sharp.pixelplumbing.com/api-resize/)
    - Technical change
        1. Tonal Adjustments (Light & Contrast)
            - Exposure: Scales the overall light level (affects every pixel).
            - Brightness: Similar to exposure but often weighted toward the mid-tones.
            - Contrast: The gap between the lightest and darkest parts.
            - Highlights: Targets only the brightest areas (useful for recovering "blown out" skies).
            - Shadows: Targets only the darkest areas (useful for "lifting" details in the darks).
            - Whites: Sets the absolute "white point" of the image.
            - Blacks: Sets the absolute "black point" of the image.
            - Gamma: Adjusts the mid-tone curve without moving the black or white points.
            - Tone Curve: Precise control over specific brightness ranges (Deep Shadows, Midtones, etc.).

        2. Color Adjustments
            - Hue: Shifts the actual color (e.g., turning a blue shirt purple).
            - Saturation: Controls the intensity of all colors equally.
            - Vibrance: "Smart" saturation—it boosts muted colors while protecting skin tones and already-vibrant colors.
            - Temperature (Kelvin): Makes the image warmer (Yellow) or cooler (Blue).
            - Tint: Corrects for Green or Magenta color casts (common in artificial lighting).
            - Color Balance: Shifts the tint of Shadows, Midtones, and Highlights independently (e.g., blue shadows, orange highlights).
            - HSL / Color Mixer: Allows you to adjust Hue, Saturation, and Luminance of a single color channel (e.g., only making the Reds brighter).

        3. Detail & Texture
            - Clarity: Increases mid-tone contrast to make textures "pop."
            - Texture: Enhances or smooths small-scale details (like skin pores).
            - Dehaze: Removes or adds atmospheric "fog" or "haze."
            - Sharpening: Enhances the edges of objects to make them appear more in-focus.
            - Noise Reduction: Smooths out grain (Luminance noise) or color splotches (Color noise).

        4. Effects & Style
            - Vignette: Darkens or lightens the edges of the frame to draw focus to the center.
            - Film Grain: Adds artificial texture to simulate analog film.
            - Split Toning (Color Grading): Adds a specific color to highlights and a different one to shadows.
            - LUT (Lookup Table): A "pre-set" map that instantly transforms colors into a specific style.

        5. Geometry & Correction
            - Crop & Aspect Ratio: Changing the frame size.
            - Lens Correction: Fixes distortion (fish-eye effect) or vignetting caused by specific lenses.
            - Chromatic Aberration: Removes "purple fringing" seen on high-contrast edges.
            - Perspective / Warp: Straightens leaning buildings or tilted horizons.

- TTS
- Lyria
- Notes/Sticker

NTA

- api mode
- cost details

- Group
- Formated text (Markdown editor)
- remove/hide json output

# UI

# Nodes

- Video Stitch
- Ease Curve
- Image Compare
- Processing Nodes (One Image Editor Node?):
    - inpaint
    - outpaint
    - create mask
    - color grading (levels)
    - Painter (annotation)
    - Crop
    - Resize
    - Extract Video Frame
    - Split Grid?
- Output Nodes? : To save the generated images and videos to a user's gallery or download them directly., integration with 3p?
- Logic Nodes : branch, merge
- Lyria/Chirp/Gemini 2.5 TTS

- VFX: opentimeline.io

# Custom Nodes

Sharing

# Compete

https://studio.morphic.com/

# Agent Sessions Refactoring

**Goal:** Persistent, resumable Director sessions per canvas with a history UI.

## Context

- Chat messages are already persisted to Firestore as part of the canvas document (auto-saved on every change via `use-canvas-persistence.ts`).
- ADK sessions are currently held in `InMemorySessionService` — lost on every server restart, no TTL, no eviction, unbounded memory growth.
- Each canvas currently has one active session ID (a UUID, stored in the Zustand store and rotated on "Clear chat").

## Tasks

- [ ] Replace `InMemorySessionService` with a Firestore-backed implementation
    - Implement a `FirestoreSessionService` extending `BaseSessionService` from `@google/adk`
    - Store sessions under `canvases/{canvasId}/adk_sessions/{sessionId}`
    - Add TTL-based eviction (e.g. delete sessions older than 30 days)
    - Wire it in via `CanvasAgentRunnerConfig.sessionService` — the injection seam is already in place

- [ ] Persist session metadata alongside messages
    - When a new session starts, write a session record: `{ id, canvasId, createdAt, firstMessagePreview }`
    - Store under `canvases/{canvasId}/sessions/{sessionId}` in Firestore
    - Update the record with `lastMessageAt` and `messageCount` on each turn

- [ ] Session history UI
    - Add a history drawer/panel to the canvas chat header
    - List past sessions ordered by `lastMessageAt`, showing date + first message preview
    - "Resume" loads the session's messages into the store and sets the `sessionId` so the next message continues in that ADK session
    - "New session" button (the existing `+`) rotates the `sessionId` and clears messages (already implemented)

- [ ] ADK context replay on resume _(stretch)_
    - Replay stored messages back into the ADK session so the Director remembers the conversation
    - Alternative: include recent message history in the system prompt context (simpler, already partially done via `canvas.messages` passed to the runner)

## Notes

- The current `sessionId` namespacing (`${userId}:${clientSessionId}`) already prevents cross-user session access.
- Per-canvas session cap (e.g. 20 sessions max) should be enforced to avoid unbounded Firestore growth.

## Agent & Prompt Engineering Refactoring

- [ ] Standardize `PromptEngineer` as a proper ADK Agent
    - Convert `PromptEngineer` from a stateless helper class into a first-class `@google/adk` agent.
    - Register primitive skills (`image-generation`, `video-generation`) as standard ADK skills.
    - This will allow the prompt engineer to utilize standard tools (e.g., search, file analysis, or tone evaluation tools) to build better prompts.
