# Spec 05 — Avatar + Lip-Sync

Status: draft
Gap: #5 from genmedia use-case audit (presenter / talking-head / lip-sync)

## 1. Objective

Add a first-class **talking-head presenter** primitive to the canvas. One node takes a script, a presenter reference, and a voice — emits a lip-synced clip ready to interleave with B-roll. Together with compose (spec 01) this unlocks explainer videos, corporate training, internal comms, faceless-channel content, and news-style bulletins end-to-end on the canvas.

Today we have `t2v` (no human focus, no lip-sync) and `t2s` (no video). A user wanting a talking-head explainer has to leave the product. Closing that gap opens the largest underrated market segment in the genmedia audit (corporate / e-learning, #7).

Target users:

- Director (plans talking-head shots and B-roll cuts in the same DAG; selects a presenter from available sources).
- Human user (right-click → "Create talking-head"; picks presenter + script + voice; renders).

## 2. Scope

In scope for v1:

- **Talking-head node**: single canvas node that takes `{ presenterRef, script, voice, durationHint?, aspectRatio }` and produces a lip-synced clip.
- **B-roll interleave**: the Director can plan a sequence of talking-head + B-roll (`t2v` / `i2v`) nodes feeding a compose timeline (spec 01) for the final explainer cut. Talking-head is a generation primitive; the cut is compose's responsibility.
- **Three presenter sources** (in priority order):
    1. **Brand kit subject** (spec 04): any subject with `kind: "character"` and at least one front / three-quarter reference can be used as a presenter.
    2. **Stock presenter library**: a curated, licensed catalog shipped with the product (~20 presenters, diverse, named).
    3. **User photo clone**: user uploads a portrait → a one-time presenter asset is created (lives on the canvas; opt-in to promote into the user's brand kit subject library).
- **Provider strategy**: native Veo + t2s. The talking-head primitive issues a Veo generation conditioned on the presenter reference image with the t2s audio as a driver. We accept that quality may be the weakest link and ship a clear "preview, then commit" flow so users can re-roll cheaply. A specialized lip-sync vendor remains a hot upgrade path.
- **Authoring shape**: single node taking script + presenter. Internally the executor calls t2s → Veo; the user sees one node.
- **Voice resolution order**: explicit `voiceId` on the node → brand kit `voice.voiceIds[locale].defaultVoiceId` → product-default voice for the locale.
- Director tool `plan_talking_head` and (separately) chained-shot helper for explainer sequences.
- New primitive skill `avatar/SKILL.md`. New pattern skill `explainer-video/SKILL.md` covering the typical explainer structure (hook → 3–5 points → CTA) so the Director plans realistic sequences instead of one giant monolithic shot.

Out of scope for v1 (tracked as follow-ups):

- Full presenter scenes with body motion / gestures / framing variation beyond head-and-shoulders.
- Real-time avatar puppeteering / live-streaming (creator economy, VTubers).
- Stand-alone lip-sync pass on user-uploaded video (we generate the video here; we don't re-lip-sync arbitrary clips).
- Multiple presenters in the same shot.
- Specialized lip-sync vendor integration.
- Emotion / delivery style controls beyond what t2s exposes natively.
- Reading-from-document presenter mode (e.g. presenter pointing at slide content).
- Translation of script across languages (spec 02 variant fanout handles localization once it lands; this spec assumes the script is already in the target language).

## 3. Data model

### 3.1 New MediaOperation

Add to `MEDIA_OPERATIONS`:

```ts
"talking_head";
```

### 3.2 Node data

```ts
type TalkingHeadSpec = {
    script: string; // VO copy, target language
    locale?: string; // BCP-47; defaults to brand kit default
    presenter:
        | { kind: "subject"; subjectId: string } // brand kit subject (spec 04)
        | { kind: "stock"; presenterId: StockPresenterId } // shipped catalog
        | { kind: "userPhoto"; assetUri: string }; // one-off upload, canvas-scoped
    voice?:
        | { kind: "explicit"; voiceId: string }
        | { kind: "kitNamed"; name: string }; // resolves via brand kit voice.namedVoices
    aspectRatio: "9:16" | "16:9" | "1:1";
    durationSec?: number; // hint only; final length driven by VO
    model?: VideoModel; // defaults to canvas default video model
    generateCaptions?: boolean; // optional burn-in captions; defaults to off
};
```

Stored on `CanvasNode.data.talkingHead`.

### 3.3 Stock presenter catalog

```ts
type StockPresenter = {
    id: StockPresenterId; // e.g. "stock_olivia_warm_studio"
    displayName: string;
    description: string; // age range, vibe, framing
    thumbnailUri: string;
    referenceUri: string; // canonical reference image for Veo conditioning
    defaultVoiceIds?: Record<string, string>; // locale → default voice id
    tags: string[]; // "corporate", "casual", "news", "warm", "energetic"
    licensing: { source: string; usageScope: string };
};
```

Ships as a static catalog in `src/lib/canvas/stock-presenters/catalog.ts` (data) + `public/stock-presenters/...` (assets). No Firestore write path for stock presenters in v1; they're build-time content.

### 3.4 User-photo clone

A user-photo presenter creates a canvas-scoped asset:

```ts
type UserPhotoPresenter = {
    assetUri: string; // GCS uri of the source portrait
    promotedSubjectId?: string; // set if user promoted to brand kit
    conditioningRefs?: string[]; // future: derived multi-angle refs
};
```

v1 stores only the source portrait; no offline multi-angle synthesis. Veo gets the single portrait as the conditioning reference.

### 3.5 Promotion path

A "Save to brand kit" action on a user-photo presenter calls `brand-kit.service.createSubject` with `kind: "character"` and writes the promoted `subjectId` back to the canvas asset. From that point the canvas node may switch to `presenter.kind: "subject"`.

## 4. Integration

### 4.1 Director tool

`plan_talking_head` in `src/lib/canvas/adk/tools.ts`:

```ts
parameters: z.object({
    shots: z.array(
        z.object({
            id: z.string(),
            script: z.string(),
            presenter: presenterSchema, // discriminated union of the three sources
            voice: voiceSchema.optional(),
            aspectRatio: z.enum(["9:16", "16:9", "1:1"]),
            durationHint: z.number().optional(),
            generateCaptions: z.boolean().optional(),
            dependsOn: z.array(z.string()).optional(),
        }),
    ),
});
```

Director can emit multiple shots in one call for explainer sequences. Each shot materializes as a `talking_head` node. B-roll shots stay on the existing `plan_production` tool — Director composes both into a final compose timeline (spec 01) when asked for a finished video.

### 4.2 Primitive skill

`src/lib/canvas/adk/skills/primitives/avatar/SKILL.md` documents:

- When to use talking-head vs. plain t2v with a person prompt (rule of thumb: any synchronized speech → talking-head).
- Presenter source picking: prefer brand kit subject → stock → user photo. Never invent a presenter when the user has a kit attached.
- Script writing: short clauses, 110–150 wpm for natural delivery, avoid acronyms that require pronunciation hints, parenthetical asides break lip-sync — strip them.
- Aspect ratio guidance: 9:16 for vertical/social, 16:9 for landscape/embed, 1:1 for feed.
- Duration math: estimate ~150 wpm + 0.5s lead/trail.
- Caveat banner: native Veo lip-sync quality varies; v1 ships preview-first flow.

### 4.3 Pattern skill

`src/lib/canvas/adk/skills/patterns/explainer-video/SKILL.md`:

- Canonical explainer structure: 3–8s hook (often talking-head) → 3–5 main points (mix of talking-head + B-roll) → 5–10s CTA (talking-head).
- When to use talking-head for a beat vs. delegate to B-roll + VO-only.
- How to plan a compose timeline that interleaves talking-head + B-roll shots without abrupt audio cuts (VO continuity matters; ducking music under all VO regions).
- Linkage to brand kit voice and locale defaults.

### 4.4 Execution path

`step-mapper.ts` maps a `talking_head` plan node to a new `GenerationStep` discriminant `"talking_head"`. `generation.ts` invokes a new `avatarService`:

1. Resolve presenter reference:
    - `subject` → fetch reference image from brand kit subject (front or three-quarter preferred).
    - `stock` → catalog lookup.
    - `userPhoto` → fetch from canvas asset.
2. Resolve voice id (resolution order from §2).
3. Run `t2s` with the resolved voice id and the script. Emit progress event "Generating voiceover".
4. Run Veo with the presenter reference + audio as conditioning. Emit progress event "Animating presenter". Use a `talking-head` Veo config (head-and-shoulders framing, neutral background unless overridden).
5. If `generateCaptions`, run caption extraction from the TTS timestamps and burn into the output via the existing video post-step (or feed timestamps into a compose overlay track when the node is fed into a compose timeline; v1 ships burn-in only).
6. Upload via `storageService`; signed URL cached.

Step events surface the two underlying calls so the user understands cost / progress.

### 4.5 User affordances

- Canvas: right-click → "Create talking-head". Opens a side panel:
    - Presenter source picker (tabs: My subjects (kit) / Stock / Upload).
    - Script textarea with live word + duration estimate.
    - Voice picker (defaults from kit / locale; explicit override).
    - Aspect ratio + captions toggle.
    - "Generate" produces a node and streams progress.
- Stock presenter grid: searchable by tags ("corporate", "warm", "news"), preview clip + thumbnail.
- User-photo upload: drag-drop a portrait, alignment + framing guide overlay, "Save to brand kit" promotion CTA after the first successful generation.
- Preview-first: each talking-head node generation produces a preview at lower video model tier when available; user clicks "Re-render at full quality" to commit. Defaults to full-quality direct on Director-planned nodes; preview-first only for user-initiated UI flow.

### 4.6 Compose interop

A talking-head node feeds compose timelines like any other video node. Compose-specific niceties:

- Talking-head nodes carry VO audio inside the rendered clip. Compose treats it as a single video track unless the user explicitly extracts the VO for ducking — provide an "Extract VO track" action on the talking-head node that emits a sibling `t2s`-equivalent audio node sharing the same source.
- The explainer pattern skill instructs the Director to extract VO when it wants ducked background music under the talking-head — otherwise we double-stack audio.

### 4.7 Brand kit interop (spec 04)

- Presenter `kind: "subject"` reads from the canvas's attached brand kit.
- Voice `kind: "kitNamed"` resolves through brand kit `voice.namedVoices`.
- Default locale and tone surface in the Director system prompt so script-writing assistants honor brand voice. Script itself is user / Director-authored, not auto-rewritten in v1.
- Stock presenter use does not promote into the kit unless the user explicitly saves.

### 4.8 Variant fanout interop (spec 02)

A talking-head node materialized under a variant template with a `locale` axis swaps:

- Script: `copyByLocale[locale]` overrides the base script when present.
- Voice id: kit `voice.voiceIds[locale].defaultVoiceId`.
- Presenter: unchanged unless the segment axis overrides it (e.g. region-specific presenter).

Fanout cap applies (≤100 cells). Generation cost in talking-head fanout is the highest in the product — surface a clearer cost preview at expansion time than for image-only fanouts.

## 5. Acceptance criteria

A1. `MEDIA_OPERATIONS` includes `"talking_head"`; type-check passes.
A2. `plan_talking_head` registered; Director invokes it when asked for an explainer, training video, presenter clip, or announcement video.
A3. Given a presenter (any of the three sources) + a 20-second script + a voice id, the executor produces a lip-synced video node reachable via signed URL.
A4. Subject-sourced presenter resolves to a brand-kit reference image at execution time (not duplicated onto the node).
A5. Stock presenter resolves via the static catalog; failed catalog lookup yields a structured error before any model call.
A6. User-photo presenter produces a canvas-scoped asset; "Save to brand kit" creates a subject via `brand-kit.service.createSubject` and rewires the node's presenter to `kind: "subject"`.
A7. Voice resolution order is honored: node `voice` > kit default for locale > product default.
A8. Director can emit a multi-shot explainer plan (e.g. `talking_head[A] → t2v[B] → talking_head[C]`) feeding a compose node; the compose render concatenates them in order with VO continuity preserved.
A9. "Extract VO track" on a talking-head node emits a sibling audio node carrying the same VO; compose timelines can duck music under that audio track.
A10. Captions toggle produces burn-in subtitles synced to the VO; absence leaves the clip unsubtitled.
A11. Failure of the t2s stage surfaces a clear error before any Veo invocation (no wasted video spend).
A12. Variant fanout with a `locale` axis on a talking-head node swaps script + voice id per cell; presenter stays constant unless overridden.

## 6. Code style

- Types in `src/lib/canvas/types.ts` co-located with existing `MediaOperation` discriminants and brand kit subject types.
- Stock presenter catalog in `src/lib/canvas/stock-presenters/catalog.ts` (data) + `public/stock-presenters/` (assets); no service layer.
- `avatarService` in `src/lib/canvas/services/avatar.service.ts` — orchestrates t2s → Veo; pure on inputs.
- Director tool in `src/lib/canvas/adk/tools.ts` with Zod schema reusing presenter discriminated union.
- UI in `src/components/canvas/talking-head-panel/`; reducer-driven mirroring spec 01 / 02 patterns.
- No comments unless WHY is non-obvious. No backwards-compat shims.

## 7. Testing strategy

- Unit: presenter resolver — subject id → kit reference; stock id → catalog entry; userPhoto uri pass-through; missing inputs produce structured errors.
- Unit: voice resolution order — node > kit > product default; locale fallback; named-voice lookup.
- Unit: Zod schema rejects cross-source field leakage (e.g. `subjectId` on a `userPhoto` payload).
- Unit: explainer pattern skill linkage — Director plan with talking-head + B-roll + compose materializes the expected DAG structure.
- Unit: "Extract VO track" action produces a sibling audio node with stable id derived from the source talking-head node.
- Integration (`.integration.test.ts`, opt-in): end-to-end talking-head generation with a stock presenter and a 10s script; assert a video output exists with non-empty audio track of approximately the expected duration (±300ms).
- Integration: variant fanout `locale` axis on a talking-head node materializes per-locale scripts and voice ids.
- No quality assertions on lip-sync accuracy (Veo-dependent); structural / metadata assertions only.

## 8. Boundaries

**Always do:**

- Resolve presenter and voice references at execution time so brand kit edits propagate to unexecuted nodes.
- Emit two-stage progress (`t2s` then Veo) so user understands cost.
- Cap script length per node at 90 seconds of estimated VO; reject beyond with a clear error (forces explainer pattern, prevents runaway costs).
- Strip parenthetical asides and bracketed stage directions from the script before t2s and before Veo conditioning.
- Validate stock catalog lookups before any model call.
- Honor brand kit defaults whenever the canvas has one attached.

**Ask first about:**

- Specialized lip-sync vendor integration (HeyGen / Synthesia / D-ID / Wav2Lip-class).
- Body / gesture / scene framing beyond head-and-shoulders.
- Re-lip-syncing arbitrary user-uploaded video.
- Multi-presenter shots.
- Translation / dubbing as part of this node (defer to spec 02 + a future dubbing primitive).
- Real-time / streaming avatar use cases.

**Never do:**

- Generate a talking-head node without a resolved voice id — every shot has audio.
- Embed user-uploaded portraits anywhere except the canvas asset store; never inline into the Director prompt.
- Run Veo before t2s succeeds.
- Auto-promote a user photo into the brand kit without an explicit action.
- Bypass licensing on stock presenters — every stock entry carries a `licensing` block that the Director skill references.
- Use a user-photo clone for a third party without the explicit upload action (no scraping subject ids into presenter sources).

## 9. Open questions

- Native Veo lip-sync quality is the existential question for this spec. v1 ships with a "preview, then commit" loop and the clear caveat that specialized vendors are the upgrade path. We need a quality bar test plan before broad rollout.
- Stock presenter catalog size (~20) and licensing source: open. Picking the catalog provider is its own follow-up.
- User-photo consent flow: legal needs to weigh in before we ship user-photo cloning.
- Caption styling (font, color, position): v1 uses kit display font + primary color when a kit is attached; otherwise a neutral default. Detailed styling controls deferred.
- Multi-angle presenter conditioning: future feature; the schema reserves `conditioningRefs` but v1 sends one reference.
- Voice naming collisions in the brand kit (e.g. two locales with a `Narrator` named voice): document precedence — locale-scoped names take priority over a global name pool.
- Cost preview: talking-head is the most expensive primitive in the product. UI should show estimated cost before generation. Pricing inputs depend on Veo + t2s billing — open until we expose per-model pricing data.
