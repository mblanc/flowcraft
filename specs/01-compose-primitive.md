# Spec 01 — Compose Primitive

Status: draft
Gap: #1 from genmedia use-case audit (assembly / final-cut layer)

## 1. Objective

Add a `compose` primitive that turns canvas-resident media nodes (images, video clips, audio tracks) into a single finished deliverable: a rendered video file or a rendered static image layout.

Today the Director can plan and execute generation of individual clips, frames, voiceovers, and music, but the canvas has no way to assemble them into a shippable artifact. Users have to download pieces and finish in external tools. Compose closes that loop so the canvas can deliver ads, trailers, social cuts, and image layouts end-to-end.

Target users: Director agent (auto-planned final-cut node) and human user (manual "compose selection" action on chosen canvas nodes).

## 2. Scope

In scope for v1:

- Video timeline: concatenate / trim video clips, layer audio tracks (VO + music + SFX) with simple volume mixing, burn-in text and image overlays, simple cuts (no transitions beyond hard cut).
- Image layout: composite multiple image nodes onto a canvas with text overlays and logo placement.
- Render engine: server-side `ffmpeg` invoked from a Next.js API route (long renders move to a worker later).
- Director integration: `compose` as a new `MediaOperation` so the Director can plan it as a terminal DAG node depending on upstream generated assets.
- **Compose Studio**: a dedicated visual editor for manual authoring and editing of compose timelines. Opens as a full-screen mode (not a side panel) on a `ComposeNode`, whether that node was Director-planned or user-initiated.

Out of scope for v1 (tracked as follow-ups):

- Transitions beyond hard cut (crossfade, wipe, etc.).
- Variant fanout — one compose call = one output (spec 02 handles fanout).
- Custom font upload — v1 ships a small built-in font set.
- External assets — inputs must be canvas node ids; no arbitrary URLs.
- Color grading / LUTs.
- Per-clip speed ramps.
- Keyframe animation of overlay properties (position, opacity over time).
- Multi-user concurrent editing of a single compose node.

## 3. Spec authoring model (Director ↔ engine contract)

Hybrid: the Director may emit either a fully-resolved timeline JSON or a higher-level intent. A `ComposeResolver` (new agent, single-turn) expands intent → timeline before render.

### 3.1 High-level intent form

```ts
type ComposeIntent = {
    kind: "video" | "image";
    durationSec?: number; // video only; required for intent form
    aspectRatio: AspectRatio;
    inputs: string[]; // canvas node ids in narrative order
    notes?: string; // free text: "hero shot first 5s, logo last 3s"
    overlays?: Array<{
        // optional shortcuts
        text: string;
        when?: "start" | "end" | "throughout";
    }>;
    audio?: {
        voiceover?: string; // canvas node id of t2s output
        music?: string; // canvas node id of t2m output
        sfx?: string[]; // canvas node ids
    };
};
```

### 3.2 Explicit timeline form

```ts
type ComposeTimeline = {
    kind: "video" | "image";
    aspectRatio: AspectRatio;
    durationSec?: number; // video only
    resolution: { w: number; h: number };
    tracks: Track[];
};

type Track = VideoTrack | AudioTrack | OverlayTrack | ImageLayerTrack; // image kind only

type VideoTrack = {
    kind: "video";
    clips: Array<{
        nodeId: string; // must reference an executed canvas video node
        inSec: number; // trim start within the source clip
        outSec: number; // trim end within the source clip
        atSec: number; // placement on the output timeline
    }>;
};

type AudioTrack = {
    kind: "audio";
    role: "voiceover" | "music" | "sfx";
    nodeId: string;
    atSec: number;
    gainDb?: number; // default 0; music defaults to -12 when mixed under VO
    duckUnder?: "voiceover"; // optional sidechain hint
};

type OverlayTrack = {
    kind: "overlay";
    items: Array<{
        type: "text" | "image";
        text?: string;
        nodeId?: string; // for image overlays (logo)
        font?: BuiltinFont; // v1 restricted to allowlist
        sizePx?: number;
        color?: string; // hex
        position: Position; // 9-point grid or {x,y} in 0..1
        fromSec?: number;
        toSec?: number;
    }>;
};

type ImageLayerTrack = {
    // image-kind compositions
    kind: "imageLayer";
    layers: Array<{
        nodeId?: string; // image node
        text?: string;
        position: Position;
        scale?: number;
        rotationDeg?: number;
        opacity?: number;
    }>;
};
```

The Director may emit either `ComposeIntent` or `ComposeTimeline`. The resolver normalizes to `ComposeTimeline` before the executor runs.

## 4. Integration with existing harness

### 4.1 New MediaOperation

Add `"compose"` to `MEDIA_OPERATIONS` in `src/lib/canvas/types.ts`. Add a `CanvasNode` subtype `ComposeNode` whose `data` carries the resolved `ComposeTimeline` plus the rendered output URL.

### 4.2 New Director tool

`plan_compose` registered in `src/lib/canvas/adk/tools.ts`. Parameters accept either intent or timeline (discriminated union). Emitted as part of a `plan_production` call (terminal node) OR as a standalone Director response.

### 4.3 New primitive skill

`src/lib/canvas/adk/skills/primitives/compose/SKILL.md` documenting:

- when to use compose vs leave clips standalone
- intent vs timeline tradeoff
- duration math (sum of trimmed clip lengths must equal `durationSec`)
- audio mixing defaults and ducking guidance
- overlay safe-area rules per aspect ratio

### 4.4 New pattern skill (follow-up, not v1)

`src/lib/canvas/adk/skills/patterns/final-cut/SKILL.md` — composes the typical "multi-shot video → final deliverable" flow. Deferred until v1 stabilizes.

### 4.5 Execution path

- Director plans compose as terminal node →
- `step-mapper.ts` maps to a new `GenerationStep` kind `"compose"` →
- `generation.ts` resolves inputs (canvas node URIs), calls a new `composeService.render(timeline)` →
- service writes timeline to a tmp dir, runs `ffmpeg` with a generated filter graph, uploads result to GCS via `storageService`, returns signed URL →
- standard `StepEvent` stream emits progress and final URL.

### 4.6 User-triggered path

Entry points:

- **From selection**: right-click on a multi-select of canvas nodes → "Open in Compose Studio". Seeds a new `ComposeNode` with a default timeline (clips concatenated in selection order, no audio, no overlays) and opens the Studio.
- **From a Director-planned compose node**: double-click the node to open the Studio with the planned timeline pre-loaded.
- **From scratch**: empty Studio invocation creates a blank `ComposeNode` the user populates by dragging canvas nodes in.

### 4.7 Compose Studio (visual editor)

A dedicated full-screen editor distinct from the freeform canvas. Lives at `src/components/canvas/compose-studio/` and mounts over the canvas route (modal-style) when a compose node is opened.

Layout (three regions):

- **Preview pane** (top): renders the current timeline state. v1 uses a low-res preview render (see §9) refreshed on edit-commit, not real-time scrubbing. Play / pause / scrub controls; scrubbing seeks within the most recent preview render.
- **Asset shelf** (left): lists all canvas nodes available as inputs (video, image, audio). Filterable by type. Drag-to-timeline to add.
- **Timeline** (bottom): horizontally scrolling, multi-track. Tracks correspond to the `Track[]` model:
    - One or more video tracks (drag clips, trim handles on each end, drag-to-reposition).
    - Audio tracks grouped by role (voiceover / music / sfx) with per-clip gain sliders and a ducking toggle.
    - Overlay track with text and image-overlay items; clicking opens an inspector for font / size / color / position / time range.

For image-kind compose, the timeline is replaced by a **Layer panel**: a stacked list of layers with drag-reorder, and a free-positioning preview pane where layers can be moved, scaled, rotated directly.

Editor state:

- The Studio operates on an in-memory `ComposeTimeline` synced to the `ComposeNode.data.timeline` on save (explicit Save button; no autosave in v1 to avoid render-cost surprises).
- "Render" button triggers a full-quality render via the same `composeService` path as the Director-planned flow.
- Undo / redo stack is local to the Studio session (cleared on close).

Director ↔ Studio handoff:

- A user can edit a Director-planned timeline in the Studio, save it, and the canvas node carries the edited timeline. Re-running the Director's plan does NOT overwrite user edits — the node becomes "user-owned" after first Studio save (tracked via `ComposeNode.data.editedByUser: boolean`).

### 4.8 Studio state model

The Studio is a controlled component over a single reducer with the timeline as the source of truth. No mirrored state in child components; everything reads from / dispatches into the reducer.

#### Store shape

```ts
type StudioState = {
    timeline: ComposeTimeline; // canonical, what gets rendered
    selection:
        | { kind: "clip"; trackId: string; clipId: string }
        | { kind: "overlay"; itemId: string }
        | { kind: "layer"; layerId: string } // image-kind only
        | null;
    preview: {
        status: "idle" | "rendering" | "ready" | "stale" | "error";
        proxyUrl?: string; // signed URL of latest low-res render
        timelineHash?: string; // hash the proxy was built from
        error?: string;
    };
    render: {
        status: "idle" | "rendering" | "ready" | "error";
        outputUrl?: string;
        progress?: number; // 0..1
        error?: string;
    };
    history: {
        past: ComposeTimeline[];
        future: ComposeTimeline[];
    };
    dirty: boolean; // timeline diverges from saved node.data.timeline
    editedByUser: boolean; // mirrors ComposeNode.data.editedByUser
};
```

`history` snapshots only `timeline`. Selection, preview, and render statuses are not undoable. History cap: 50 entries; older entries drop off the bottom.

#### Action set

Single discriminated union dispatched from UI handlers. v1 set:

```ts
type StudioAction =
    // clip operations (video-kind tracks)
    | { type: "clip/add"; trackId: string; nodeId: string; atSec: number }
    | { type: "clip/remove"; trackId: string; clipId: string }
    | { type: "clip/move"; trackId: string; clipId: string; atSec: number }
    | {
          type: "clip/trim";
          trackId: string;
          clipId: string;
          inSec: number;
          outSec: number;
      }
    | { type: "clip/reorder"; trackId: string; clipIds: string[] } // explicit new order

    // track operations
    | { type: "track/add"; kind: TrackKind; role?: AudioTrack["role"] }
    | { type: "track/remove"; trackId: string }

    // audio operations
    | { type: "audio/setGain"; trackId: string; gainDb: number }
    | {
          type: "audio/setDucking";
          trackId: string;
          duckUnder: "voiceover" | null;
      }

    // overlay operations
    | { type: "overlay/add"; item: OverlayItem }
    | { type: "overlay/update"; itemId: string; patch: Partial<OverlayItem> }
    | { type: "overlay/remove"; itemId: string }

    // image-kind layer operations
    | { type: "layer/add"; layer: ImageLayer }
    | { type: "layer/update"; layerId: string; patch: Partial<ImageLayer> }
    | { type: "layer/remove"; layerId: string }
    | { type: "layer/reorder"; layerIds: string[] }

    // selection
    | { type: "select"; selection: StudioState["selection"] }

    // timeline-level
    | { type: "timeline/setDuration"; durationSec: number }
    | { type: "timeline/setAspectRatio"; aspectRatio: AspectRatio }

    // history
    | { type: "undo" }
    | { type: "redo" }

    // preview / render lifecycle
    | { type: "preview/start"; timelineHash: string }
    | { type: "preview/ready"; timelineHash: string; proxyUrl: string }
    | { type: "preview/error"; error: string }
    | { type: "preview/markStale" }
    | { type: "render/start" }
    | { type: "render/progress"; progress: number }
    | { type: "render/ready"; outputUrl: string }
    | { type: "render/error"; error: string }

    // persistence
    | { type: "save/commit" } // pushes timeline to node.data, flips dirty=false, editedByUser=true
    | { type: "load"; timeline: ComposeTimeline; editedByUser: boolean };
```

Reducer rules:

- Any action whose `type` starts with `clip/`, `track/`, `audio/`, `overlay/`, `layer/`, or `timeline/` is a **timeline-mutating** action: it pushes the prior `timeline` onto `history.past`, clears `history.future`, sets `dirty = true`, and dispatches a `preview/markStale` as a follow-up effect.
- `undo` / `redo` move snapshots between `past` / `future` without touching `dirty` (so saved state remains the diff baseline).
- `save/commit` is the only action that writes to `ComposeNode.data` and clears `dirty`. It also flips `editedByUser` to `true` if it wasn't already.
- Validation (duration math, residency, font allowlist) runs at preview/render dispatch time, not in the reducer — the reducer permits temporarily invalid states so the user can edit freely.

#### Selectors

A small `selectors.ts` derives:

- `selectClipById(state, clipId)`
- `selectAvailableNodes(state, canvasNodes)` — filters canvas nodes to those legal as inputs (executed media nodes with valid URIs)
- `selectTimelineHash(state)` — stable hash of the timeline used to key the preview cache
- `selectValidationErrors(state)` — array of structured errors for the validation panel

Components subscribe to specific selectors, not the whole store.

### 4.9 Asset shelf filtering model

The asset shelf is a flat, filterable list — no folders in v1.

#### Inputs to the shelf

All canvas nodes whose `data.outputUrl` (or equivalent) is populated and whose type maps to a compose-legal input:

| Canvas node type             | Asset shelf kind | Legal target tracks                                       |
| ---------------------------- | ---------------- | --------------------------------------------------------- |
| `t2i`, `i2i` (image)         | `image`          | video-track clip (still), overlay image, image-kind layer |
| `t2v`, `i2v`, `i2v2` (video) | `video`          | video-track clip                                          |
| `t2s` (voiceover)            | `audio:vo`       | audio track (role=voiceover)                              |
| `t2m` (music)                | `audio:music`    | audio track (role=music)                                  |
| `sfx`                        | `audio:sfx`      | audio track (role=sfx)                                    |
| `text` (canvas text node)    | `text`           | overlay text item                                         |

Image nodes are dual-use: they can be added as still clips on a video track (rendered for a default 3s duration) OR as overlays. The drop target determines the role.

#### Filter UI

A single horizontal segmented control above the list: `All | Video | Image | Audio | Text`. Audio further splits into VO / Music / SFX via a secondary chip row when the Audio segment is active.

A free-text search filters by node `label` (substring, case-insensitive).

A persistent "Used in timeline" toggle dims (but does not hide) assets already referenced by the current timeline. Used assets remain draggable so the same source can be re-used at multiple timeline positions.

#### Drag semantics

- Each shelf item exposes a `dataTransfer` payload of `{ nodeId, kind }`.
- Track drop zones declare which `kind`s they accept; illegal drops snap back.
- Dropping an image asset onto a video track creates a clip with `inSec: 0`, `outSec: 3`, `atSec: <drop x>`; the user can extend via trim handles.
- Dropping any asset onto an empty area of the timeline creates a new track of the appropriate kind and places the clip at `atSec: 0`.

#### Ordering

Default sort: most recently executed first (proxy for "what the user just generated"). Secondary sort: by `label` alphabetically. Sort control deferred to v1.1 — most recent is the right default.

## 5. Acceptance criteria

A1. `MEDIA_OPERATIONS` includes `"compose"`; type-check passes.
A2. `plan_compose` tool registered; Director (variant b) calls it as a terminal node when prompted to deliver a finished cut.
A3. Given a canvas with three video nodes A, B, C of 4s/4s/4s and one t2s VO node, a Director plan that emits a `ComposeIntent` of `inputs:[A,B,C]`, `audio.voiceover:VO`, `durationSec:12`, `aspectRatio:"16:9"` renders a single 12s `mp4` reachable via signed URL.
A4. Image-kind compose with three image inputs + one text overlay renders a single PNG at the requested aspect ratio.
A5. Resolver rejects timelines whose summed clip lengths diverge from `durationSec` by more than 100ms; surfaces a structured error to the Director.
A6. Inputs referencing non-canvas-resident node ids fail validation before ffmpeg is invoked.
A7. Render duration is capped server-side at 60s of output; longer requests are rejected with a clear error.
A8. The Compose Studio can be opened on a multi-selection and produces an identical render to the Director-planned path given the same timeline.
A9. A user can open a Director-planned `ComposeNode` in the Studio, drag a new clip onto a video track, save, and re-render — the new timeline persists on the canvas node and `editedByUser` flips to `true`.
A10. Subsequent Director re-plans of the same node do not overwrite a `editedByUser: true` node without explicit user confirmation.
A11. Image-kind compose nodes open the Layer panel (not the timeline) and support drag-reorder, free-positioning, scale, rotation, opacity edits with a Save→Render cycle.
A12. Every timeline-mutating action pushes the prior timeline onto the undo stack; undo / redo restore the timeline without affecting `dirty` or `editedByUser`.
A13. Asset shelf shows only canvas nodes with populated outputs; filtering by `Video | Image | Audio | Text` and free-text label search returns the expected subsets.
A14. Dragging an image asset onto a video track produces a clip with default `outSec - inSec = 3`; dragging a video asset uses the source duration.
A15. Illegal drops (e.g. video onto audio track) snap back without mutating the timeline.

## 6. Code style

Follows existing canvas module conventions:

- All types in `src/lib/canvas/types.ts`.
- Service in `src/lib/canvas/services/compose.service.ts` (new); pure functions for filter-graph construction, isolated from ffmpeg invocation for unit testing.
- Director tool in `src/lib/canvas/adk/tools.ts` with Zod schema; reuse `EDGE_ROLES` for dependency edges.
- API route: `src/app/api/canvases/[id]/compose/route.ts` (SSE, `maxDuration: 300`).
- No comments unless WHY is non-obvious. No backwards-compat shims.

## 7. Testing strategy

- Unit: filter-graph builder produces expected ffmpeg args for representative timelines (concat, overlay, audio mix, ducking). No ffmpeg invocation in unit tests.
- Unit: resolver validates duration math, input residency, font allowlist, aspect-ratio coherence.
- Unit: Zod schema accepts both intent and timeline forms; rejects malformed inputs.
- Integration (`.integration.test.ts`, opt-in): end-to-end render of a 12s 16:9 video with 3 clips + VO + music; assert output exists, duration within ±100ms, audio track present.
- Integration: image-kind render produces a PNG at requested resolution with overlays at expected pixel positions (sample a few pixels).
- Component tests for the Studio: timeline reducers (add/remove/trim/move clip), layer-panel reducers (reorder/transform), undo-redo stack. UI-rendering tests minimal — focus on state-shape correctness.
- Manual QA checklist for the Studio (drag interactions, scrub seek, render trigger) — UI affordances are not exhaustively covered by unit tests.

## 8. Boundaries

**Always do:**

- Validate that every `nodeId` in a timeline resolves to a canvas-resident executed node before invoking ffmpeg.
- Cap output duration at 60s for v1.
- Restrict fonts to the built-in allowlist.
- Stream progress via `StepEvent` so the user sees per-stage status.
- Reuse `storageService` and `signed-url-cache` for output upload and URL handling.

**Ask first about:**

- Adding transitions beyond hard cut.
- Allowing external URLs as inputs.
- Adding a live preview / scrubbing UI.
- Adding variant fanout to compose (defer to spec 02).
- Adding new MediaOperation values beyond `compose`.

**Never do:**

- Invoke ffmpeg with unsanitized user-supplied filter-graph fragments.
- Accept arbitrary font files from the client in v1.
- Skip duration / residency validation before render.
- Persist tmp render artifacts outside the request-scoped tmp dir.
- Block the Director response on render completion — compose runs in the same SSE stream as other steps and surfaces progress incrementally.

## 9. Open questions

- Where does the worker live when we outgrow the 300s API route limit? (Cloud Run job? Cloud Tasks?) — defer until we hit it.
- Preview render: v1 commits to a low-res preview pass to make the Studio usable. Open question: client-side WebCodecs decoding of source clips for instant scrub vs. server-side proxy renders cached per timeline hash. Leaning server-side proxies first.
- Should the Studio support keyframe animation of overlay properties? Out of v1, but the `Track` model should leave room for it (e.g. `position` could later become `position | KeyframedPosition`).
- Concurrent editing semantics if two browser tabs open the same compose node — v1 last-write-wins, no locking. Revisit if it bites.
- Should "Open in Compose Studio" also be reachable from non-media nodes (e.g. a text node as an overlay source)? Probably yes, but defer the UX to v1.1.
