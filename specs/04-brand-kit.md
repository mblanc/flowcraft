# Spec 04 — Brand Kit / Style Memory

Status: draft
Gap: #4 from genmedia use-case audit (persistent brand identity & style memory)

## 1. Objective

Give the canvas a persistent notion of identity. A user-owned **Brand Kit** stores visual identity (logo, palette, type), style references, recurring subjects (characters, products, mascots), and voice/tone guidelines. Once a kit is attached to a canvas, every generation implicitly inherits it — overlays use the right colors and logo, voiceovers use the right voice ID, subjects render consistently across sessions, copy carries the brand tone.

Today every canvas starts identity-blank. Character sheets are a one-off per canvas. There is no cross-canvas reuse, no project-level style memory, no auto-application — every prompt has to spell out "use our blue, our typeface, our spokesperson." This is the moat for ad creative (#1), product imagery (#3), corporate (#7), and creator brand work.

Target users:

- Human user (creates and curates kits in a dedicated manager; attaches kits to canvases).
- Director (consumes kit context implicitly on every plan; never asked to author kit content).

## 2. Scope

In scope for v1:

- Four kit sections, all optional but unified under one resource:
    - **Visual identity**: logo files (up to 4 variants — primary / inverted / icon / wordmark), color palette (named swatches), type stack (display / body / mono with allowlist resolution against the compose font allowlist from spec 01).
    - **Style references**: image references with role tags (mood / lighting / composition / texture).
    - **Subject library**: persistent named subjects with reference images and a description; each subject has a stable id reusable across canvases.
    - **Voice & tone**: written tone guide (markdown), default locale, voice IDs per locale (BCP-47 keys; one default voice + optional named voices), forbidden phrasings list.
- **Ownership**: kits are user-owned. A user can have many kits. Each kit has an `id`, owner, and metadata.
- **Sharing**: kits are shareable to other users by id with a read-only / editor role split (auth gated). Attached canvases see the kit as it exists at attach time + live updates.
- **Attachment**: a canvas can attach **at most one** kit at a time. Attaching is a canvas-level action; switching kits prompts the user to confirm because in-flight plans may reference kit assets by id.
- **Application**: implicit on every generation. Director receives a compact kit summary in its system prompt; primitives consume kit-derived overrides during prompt engineering.
- **Per-node override**: the canvas-level "kit on" default can be opted out per node via a `brandKit: "off" | "default"` field on plan nodes (kept narrow in v1 — no per-section override; it's all-or-nothing per node).
- A **Brand Kit Manager** UI: create / edit / delete kits; manage subjects; upload references; preview application against a sample prompt.
- Persistence: kits stored in Firestore via a new `brandKit.service`. Binary assets (logos, reference images) in GCS, served via the signed-URL cache.

Out of scope for v1 (tracked as follow-ups):

- Per-section kit overrides on plan nodes (e.g. "keep colors but ignore the subject library for this node").
- Project / workspace tier above user (the long-term right answer; v1 stops at user-owned).
- Real-time multi-user kit editing.
- Versioning / history of kit edits (a kit is mutable; older outputs may diverge from current kit state — acceptable in v1).
- Auto-curation of subjects from past canvas outputs (would be lovely; defer).
- Brand-kit-driven A/B testing (which palette wins). Out.
- LLM-assisted kit extraction from existing brand guidelines docs / websites. Defer.
- Kit-aware compose (compose timeline reads kit colors automatically) — v1 surfaces the palette but compose still requires explicit color hex from the Director / user.

## 3. Data model

### 3.1 Brand kit shape

```ts
type BrandKitId = string;

type BrandKit = {
    id: BrandKitId;
    ownerId: string; // auth user id
    name: string;
    description?: string;
    createdAt: number;
    updatedAt: number;

    identity?: {
        logos?: Array<{
            role: "primary" | "inverted" | "icon" | "wordmark";
            assetUri: string; // GCS uri
            svg?: boolean; // hint for compose to prefer SVG
        }>;
        palette?: Array<{
            name: string; // "Primary Blue", "Surface 50"
            hex: string;
            role?: "primary" | "secondary" | "accent" | "neutral" | "semantic";
        }>;
        type?: {
            display?: FontRef;
            body?: FontRef;
            mono?: FontRef;
        };
    };

    styleRefs?: Array<{
        id: string;
        assetUri: string;
        tags: Array<"mood" | "lighting" | "composition" | "texture" | "color">;
        notes?: string;
    }>;

    subjects?: Array<{
        id: string; // stable across sessions; referenced by subject_ref edges
        name: string; // "Lumino the mascot", "Model A"
        kind: "character" | "product" | "mascot" | "location" | "other";
        description: string; // canonical description used in prompts
        references: Array<{
            // reference images for subject_ref edges
            assetUri: string;
            angle?: "front" | "three-quarter" | "side" | "back" | "detail";
        }>;
    }>;

    voice?: {
        toneGuide?: string; // markdown
        defaultLocale?: string; // BCP-47
        voiceIds?: Record<
            string,
            {
                // locale code → voice spec
                defaultVoiceId: string;
                namedVoices?: Record<string, string>; // "Narrator" → voiceId
            }
        >;
        forbiddenPhrases?: string[];
    };

    shares?: Array<{
        userId: string;
        role: "viewer" | "editor";
    }>;
};

type FontRef =
    | { kind: "builtin"; family: BuiltinFont } // shared allowlist with spec 01
    | { kind: "uri"; family: string; assetUri: string }; // user-uploaded; gated until type-handling lands
```

v1 ships only `kind: "builtin"` until the compose font upload story lands; the schema reserves room for uploaded fonts.

### 3.2 Attachment on the canvas

```ts
type CanvasBrandKitAttachment = {
    kitId: BrandKitId;
    attachedAt: number;
    // optional pinned subjects/refs the canvas explicitly uses (informational only in v1)
    pinnedSubjectIds?: string[];
};
```

Stored on the canvas document as `canvas.brandKit`. Absence means no kit applied.

### 3.3 Per-node override

```ts
// addition to PlanNode in src/lib/canvas/types.ts
brandKit?: "default" | "off";
```

Default behavior is `"default"` (apply attached kit). `"off"` skips kit application entirely for that node.

## 4. Integration

### 4.1 Service layer

New `src/lib/services/brand-kit.service.ts`:

- `createKit(ownerId, payload)`
- `getKit(id, viewerId)` — enforces ownership / share rules
- `listKits(viewerId)` — own + shared
- `updateKit(id, patch, editorId)`
- `deleteKit(id, ownerId)`
- `shareKit(id, targetUserId, role, ownerId)`
- `revokeShare(id, targetUserId, ownerId)`

Firestore collection `brandKits/{id}`; binary assets under `gs://<bucket>/brand-kits/{kitId}/...`.

### 4.2 Director context injection

`runner.ts` constructs the Director system prompt. v1 adds a compact kit summary block when a canvas has a kit attached:

```
## Brand Kit (auto-applied)

Name: <kit.name>
Palette: <named hex list, max 8 entries>
Type: <display / body / mono families>
Default locale: <code>; voices: <locale → voiceId list>
Tone: <first 280 chars of toneGuide; truncated with ellipsis>
Subjects: <id — name — kind — one-line description; up to 12 entries>
Logos: <available roles list, NOT data>
Style references: <count by tag>; refs available via subject_ref / style_ref edges by id

Always honor this kit unless a node explicitly opts out (`brandKit: "off"`).
```

Hard caps on entry counts above prevent context bloat. If a kit exceeds caps, the summary lists totals + ids; primitives can still resolve full data via the service.

### 4.3 Primitive consumption

- **Image / video prompt nodes**: PromptEngineer (`prompt-engineer.ts`) accepts an optional `brandKitContext`. When set, it appends palette references (named, not raw hex unless the prompt needs hex), subject descriptions for any referenced subject id, and style notes from referenced style refs. It also prepends a brand-consistency directive.
- **Subject reference edges**: a `subject_ref` edge from a plan node to a subject id resolves to the subject's reference image(s) — fetched from kit at execution time, not duplicated onto the node.
- **t2s nodes**: locale defaults pulled from `voice.defaultLocale`; voice id resolved by locale; named voices accessible by name.
- **Compose overlays (spec 01)**: text overlays default to the kit's display font and primary palette color when `brandKit !== "off"`. Logo overlays accept a `kitLogoRole` shortcut that resolves at render time.

### 4.4 Attachment UX

Canvas-level affordance:

- Top-bar pill: "No brand kit" → click to attach. Shows current kit name when one is attached.
- Attach dialog: lists user's kits + shared kits; preview pane shows palette / logos / subject thumbnails.
- Switch dialog: warns "in-flight plans may reference kit assets; switching does not retroactively rerun them".

### 4.5 Brand Kit Manager

Dedicated route `src/app/(app)/brand-kits/page.tsx`:

- Grid of kits (own + shared).
- Create-new flow: empty kit → user fills sections progressively.
- Per-kit editor with tabs: Identity / Style refs / Subjects / Voice / Sharing.
- Subject editor: name, kind, description, drag-drop reference images, angle tagging.
- Preview pane: a sample prompt ("hero shot of <subject>") rendered against the current kit; shows what the Director would receive in its system prompt for that kit.

### 4.6 API routes

- `POST /api/brand-kits` — create
- `GET /api/brand-kits` — list
- `GET /api/brand-kits/[id]` — read
- `PATCH /api/brand-kits/[id]` — update
- `DELETE /api/brand-kits/[id]` — delete
- `POST /api/brand-kits/[id]/share` — share
- `DELETE /api/brand-kits/[id]/share/[userId]` — revoke

Asset upload via signed URL flow consistent with existing canvas asset uploads.

Canvas-level attachment:

- `POST /api/canvases/[id]/brand-kit` — attach `{ kitId }`
- `DELETE /api/canvases/[id]/brand-kit` — detach

### 4.7 Spec interop

- **Spec 01 (compose)**: compose overlays read kit fonts + palette; logos by role. Font allowlist shared with `BuiltinFont`.
- **Spec 02 (variant fanout)**: brand kit is the canonical source for locale lists, voice IDs, and (eventually) segment definitions. v1 spec 02 reads `voice.voiceIds` keys for locale axis defaults. Lock the `BrandKit.voice` shape now so the spec-02 brand-kit JSON stub aligns.
- **Spec 03 (edit primitives)**: edits inherit the kit on the source node by default; bg-remove `generated` replacement gets a kit-style-conditioned prompt.

## 5. Acceptance criteria

A1. A user can create a brand kit with name + at least one section populated; it persists across sessions.
A2. Listing returns kits owned by the user plus kits shared with them; non-owners cannot read kits not shared with them.
A3. Attaching a kit to a canvas writes `canvas.brandKit.kitId`; the Director's next plan receives the kit summary in its system prompt.
A4. With a kit attached and `brandKit: "default"`, an image generation node's engineered prompt references kit palette names and (when relevant) subject descriptions.
A5. Setting `brandKit: "off"` on a node skips all kit application for that node and produces output identical to an unattached canvas (deterministic prompt, same model/seed).
A6. A `subject_ref` edge from a plan node to a kit subject id resolves at execution time to the subject's reference image(s); the source kit asset, not a node-local copy.
A7. A t2s node on a canvas with an attached kit defaults to the kit's locale + voice id when none is specified on the node.
A8. Compose overlays (spec 01) default to the kit's display font and primary palette color when `brandKit !== "off"`.
A9. The kit summary block fits the documented caps (≤8 palette, ≤12 subjects, ≤280 chars tone); larger kits are surfaced by id list with full resolution available via the service.
A10. Sharing a kit to another user (`role: "viewer"`) lets that user list and attach the kit but not edit it; `role: "editor"` allows edits but not delete or re-share.
A11. Deleting a kit detaches it from any canvases that referenced it; existing materialized outputs remain intact; in-flight plans referencing kit-resolved assets continue to completion using the resolved values.
A12. Switching a canvas's attached kit prompts confirmation and writes the new attachment; previously generated nodes are unchanged.

## 6. Code style

- Types co-located in `src/lib/services/brand-kit.types.ts` (new) to avoid bloating `canvas/types.ts`; re-exported where needed.
- Service in `src/lib/services/brand-kit.service.ts` mirroring existing service shape (`flow.service`, `canvas.service`).
- Director summary builder in `src/lib/canvas/adk/brand-kit-context.ts` — pure function, fully unit-tested.
- API routes follow the existing `[id]/route.ts` pattern; auth via `auth()` at top of every handler.
- Manager UI under `src/app/(app)/brand-kits/` and `src/components/brand-kits/`.
- No comments unless WHY is non-obvious. No backwards-compat shims.

## 7. Testing strategy

- Unit: kit summary builder — caps enforcement, deterministic ordering, locale default selection, no PII leak.
- Unit: PromptEngineer with `brandKitContext` set — palette name resolution, subject description inlining, opt-out behavior.
- Unit: subject_ref resolver — kit subject id → reference asset URIs at execution time.
- Unit: access control — owner / viewer / editor matrix on `getKit`, `updateKit`, `shareKit`, `deleteKit`.
- Unit: attachment lifecycle — attach / switch / detach state transitions.
- Integration: end-to-end image generation with attached kit; prompt-engineered output references kit palette name.
- Integration: t2s with kit-resolved locale + voice id; assert the voice id passed to the model matches the kit value.
- Integration: kit deletion detaches from canvas without orphaning existing rendered outputs.

## 8. Boundaries

**Always do:**

- Apply auth on every kit read / write; never trust client-provided owner ids.
- Resolve kit assets via service at execution time, not at plan emission, so kit edits propagate to in-flight nodes that haven't executed yet.
- Cap Director summary block to keep context cost predictable.
- Surface a clear UI indicator on the canvas that a kit is attached.
- Reuse signed-URL cache for kit asset reads.

**Ask first about:**

- Project / workspace tier (the right next move; needs its own spec).
- Per-section kit overrides on plan nodes.
- Real-time multi-user kit editing.
- LLM-assisted kit extraction from external brand guidelines docs.
- Versioned / immutable kit snapshots for reproducibility.
- Auto-promotion of generated subjects into the subject library.

**Never do:**

- Embed binary kit assets directly in the Director system prompt — references / ids only.
- Allow a non-owner editor to delete or re-share a kit.
- Mutate previously generated canvas outputs when a kit is edited (history stays as-rendered).
- Persist a kit asset under a canvas — assets live in the kit; canvases reference by id.
- Apply kit to nodes with `brandKit: "off"` under any circumstance, including Director "helpfulness".

## 9. Open questions

- Workspace tier: v1 stops at user-owned + shareable. The right long-term answer is a workspace tier. Hold this spec to user-only and design v2 once workspace usage shows up.
- Versioning: do we need immutable snapshots for ad campaigns ("render with kit-v3, not current")? Likely yes; v1 ships mutable.
- Subject reference dedup: a kit can have many subjects with overlapping ref images. No dedup in v1; revisit if storage cost matters.
- Voice id portability: voice IDs are vendor-specific. Locking to the current t2s vendor is acceptable in v1; multi-vendor later.
- "Tone" application: today PromptEngineer doesn't have a tone-aware pass for text overlays / VO scripts. v1 surfaces the tone in the Director prompt; a real tone-conditioned rewriter is a follow-up.
- Sharing UX: how do users discover other users to share with? v1 stub: paste user email; lookup via auth user service. Real picker is a follow-up.
