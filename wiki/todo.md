# Todo

## Critical

- [x] Fix Run Flow and Run Selected — both are currently broken

## High Priority

- [ ] App mode
- [x] Saving system: copy canvas / duplicate flows

### Agent Sessions Refactoring

Persistent, resumable Director sessions per canvas with a history UI.

- [ ] Replace `InMemorySessionService` with a Firestore-backed implementation
    - Extend `BaseSessionService` from `@google/adk`
    - Store sessions under `canvases/{canvasId}/adk_sessions/{sessionId}`
    - 30-day TTL eviction, per-canvas cap (e.g. 20 sessions) to bound Firestore growth
    - Wire in via `CanvasAgentRunnerConfig.sessionService` (injection seam already in place)
- [ ] Persist session metadata alongside messages
    - On session start: write `{ id, canvasId, createdAt, firstMessagePreview }` to `canvases/{canvasId}/sessions/{sessionId}`
    - Update `lastMessageAt` and `messageCount` on each turn
- [ ] Session history UI
    - Drawer/panel in the canvas chat header
    - List past sessions ordered by `lastMessageAt`, showing date + first message preview
    - Resume: loads messages into the store and sets `sessionId` so next message continues in that ADK session
    - New session button (existing `+`) already implemented
- [ ] (stretch) ADK context replay on resume — replay stored messages back into the ADK session, or include recent history in the system prompt context

### Multi-Node Selection

- [x] Suppress node context menus when multiple nodes are selected

## Medium Priority

### Flow Nodes

- [ ] List selector node
- [ ] Video Stitch / Concatenate node
- [ ] Image Editor node (unified processing node)
    - [ ] Tonal adjustments: exposure, brightness, contrast, highlights, shadows, whites, blacks, gamma, tone curve
    - [ ] Color adjustments: hue, saturation, vibrance, temperature/tint, color balance, HSL mixer
    - [ ] Detail & texture: clarity, texture, dehaze, sharpening, noise reduction
    - [ ] Effects & style: vignette, film grain, split toning, LUT
    - [ ] Geometry: crop/aspect ratio, resize (sharp.js), lens correction, chromatic aberration, perspective/warp
    - [ ] Inpaint / outpaint
    - [ ] Create mask
    - [ ] Painter / annotation
    - [ ] Split grid
- [ ] Extract Video Frame node
- [ ] TTS node (Lyria / Chirp / Gemini 2.5 TTS)
- [ ] Notes / Sticker node
- [ ] Logic Nodes: branch, merge
- [ ] Output Nodes — save to gallery, direct download, optional 3rd-party integration
- [ ] Group node
- [ ] Formatted text node (Markdown editor)
- [ ] Ease Curve node
- [ ] Image Compare node

### Canvas / Agent

- [ ] Standardize `PromptEngineer` as a proper `@google/adk` Agent
    - Register primitive skills (`image-generation`, `video-generation`) as standard ADK skills
    - Unlocks use of standard tools (search, file analysis, tone evaluation) for richer prompt building

### Sharing

- [ ] Custom Nodes sharing

## Code Quality

- [ ] **[ISP] Narrow `NodeInputs` interface** — `src/lib/types.ts:55`
      The `[key: string]: unknown` index signature defeats type safety. Most `gatherInputs` implementations use only 2–3 fields. Remove the index signature and narrow per-node via the typed `I` parameter that `NodeDefinition<T, I>` already supports.

## Nice to Have

- [ ] API mode
- [ ] Cost details per run
- [ ] Remove / hide raw JSON output
- [ ] VFX integration (opentimeline.io)
