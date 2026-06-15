# Todo``

## Critical

- [ ] Custom Node Redesign

## High Priority

- [ ] App mode

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
- [ ] Undo / redo — Zustand store has no history stack; node deletions and edge changes are irreversible

### Canvas / Agent

- [ ] Standardize `PromptEngineer` as a proper `@google/adk` Agent
    - Register primitive skills (`image-generation`, `video-generation`) as standard ADK skills
    - Unlocks use of standard tools (search, file analysis, tone evaluation) for richer prompt building
- [ ] Canvas sharing UI — `visibility` / `sharedWith` / `sharedWithEmails` fields exist in the data model and service but there is no sharing modal, no permissions enforcement in API routes, and no invite flow
- [ ] Canvas export / download — no way to download generated output; no export dialog
- [ ] Canvas versioning — messages are persisted but there is no timeline, no rollback to a prior canvas state
- [ ] Plan approval / editing UI — plans emit `planStatus: "pending_approval"` events but there is no panel to review or edit a plan before executing it
- [ ] Canvas templates — `isTemplate` flag exists in the data model; no gallery or clone-from-template flow
- [ ] Canvas audio generation — `canvas-audio` CanvasNode type is defined in `src/lib/canvas/types.ts` but has no executor, no generation path in `generation.ts`, and no UI component; implement or remove the dead type
- [ ] Brand Validation & Policy Enforcement — post-generation rule checking pipeline (see `wiki/validation.md`)
    - [ ] Brand profile data model in Firestore (`brandProfiles` collection) with color palette, safe zones, logo rules, mood keywords
    - [ ] Built-in channel presets (X.com banner, Instagram, YouTube thumbnail) with dimension + safe-zone specs
    - [ ] Validation pipeline in `generation.ts`: programmatic checks (dimensions, safe zones, delta-E color distance) + vision model checks + LLM-as-judge for qualitative rules
    - [ ] Failure handling: auto-correct for dimensional rules, silent retry with feedback for visual/qualitative, surface to user after N retries
    - [ ] Brand panel in canvas sidebar (profile selector, channel preset picker, per-node pass/fail badges)
    - [ ] Canvas Instructions layer — free-form markdown per canvas + global user default, injected into Director prompt (preventive enforcement)

### App Shell

- [ ] Settings page — currently a "Coming soon" stub; needs account management, preferences, etc.

### Sharing

- [ ] Custom Nodes sharing

## Code Quality

- [ ] **[ISP] Narrow `NodeInputs` interface** — `src/lib/types.ts:55`
      The `[key: string]: unknown` index signature defeats type safety. Most `gatherInputs` implementations use only 2–3 fields. Remove the index signature and narrow per-node via the typed `I` parameter that `NodeDefinition<T, I>` already supports.
- [ ] Shared error boundary component — loading and error states are inconsistent across pages (Library is polished; flow/canvas pages are minimal); add a reusable `<ErrorBoundary>` and skeleton pattern

## Nice to Have

- [ ] Node palette search / filter — 13+ node types with no way to filter the palette
- [ ] API mode
- [ ] Cost details per run
- [ ] Remove / hide raw JSON output
- [ ] VFX integration (opentimeline.io)
