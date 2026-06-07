# Spec 03 — Edit Primitives

Status: draft
Gap: #3 from genmedia use-case audit (post-production / editing primitives)

## 1. Objective

Make the canvas an edit surface, not just a synthesis surface. Today every output is generated from scratch; commercial workflows (retouching, virtual staging, packshot cleanup, finishing) are edit-heavy. Add four primitives — **inpaint**, **outpaint**, **background remove / replace**, **upscale / restore** — exposed both as Director-callable tools and as user-triggered canvas actions on any image node.

Target users:

- Director (plans an edit primitive when the user describes a localized change, scene extension, background swap, or finishing pass).
- Human user (right-click an image node → "Inpaint" / "Outpaint" / "Remove background" / "Upscale"; opens the appropriate editor and writes a new child node).

## 2. Scope

In scope for v1:

- Four primitives: `inpaint`, `outpaint`, `bg_remove`, `upscale`. (`bg_replace` is `bg_remove` + a generation step composed into one user action; under the hood it's a two-node flow.)
- Backed by **Gemini image edit** modes (`MODELS.IMAGE.GEMINI_2_5_FLASH_IMAGE` / `GEMINI_3_PRO_IMAGE` / `GEMINI_3_1_FLASH_IMAGE`). Upscale uses the same family — no specialized vendor in v1.
- Mask input via two channels:
    - **Brush mask editor**: a modal mask painter mounted on the source image. Bitmap output.
    - **Text-described region**: free-text "the sky", "the product label" — passed to the model as a region hint. v1 sends both prompt and bitmap mask when available; text-only is supported but quality varies.
- Edit topology: **new node per edit**. Each edit creates a child node carrying an `editLineage` reference to its parent. Lineage edges use a new `EdgeRole`.
- Director integration: a single `plan_edit` tool covers all four primitives (operation discriminator), so the Director can plan multi-step edit chains.
- Per-primitive primitive skills under `src/lib/canvas/adk/skills/primitives/`.

Out of scope for v1 (tracked as follow-ups):

- Specialized vendors (SAM for masks, Real-ESRGAN for upscale, rembg for bg-remove). Hold these as an upgrade path if Gemini quality falls short on specific primitives.
- Relight (lighting-aware re-render). Defer until inpaint quality is stable.
- Color grading / LUTs.
- Mutate-in-place with per-node version history. Always-new-node keeps the lineage explicit in v1.
- Edit primitives on video frames. Image-only in v1.
- Auto-mask refinement (matting / edge feathering controls beyond a single softness slider).
- Multi-region edits in one call (one mask per edit in v1).

## 3. Data model

### 3.1 New MediaOperations

Add to `MEDIA_OPERATIONS` in `src/lib/canvas/types.ts`:

```ts
"inpaint" | "outpaint" | "bg_remove" | "upscale";
```

### 3.2 New EdgeRole

```ts
type EdgeRole =
    | "depends_on"
    | "style_ref"
    | "subject_ref"
    | "variant_of" // spec 02
    | "edit_of"; // new: child edit node points at the source image node
```

`edit_of` edges are 1:1 (edit child → single source parent) and rendered as a subtle lineage indicator on the canvas (not a hard dependency arrow).

### 3.3 Node data

Each edit primitive node carries an `editSpec` on `data`:

```ts
type EditSpec =
    | {
          kind: "inpaint";
          sourceNodeId: string;
          prompt: string; // the change to apply within the masked region
          mask:
              | { kind: "bitmap"; uri: string; softnessPx?: number }
              | { kind: "text"; description: string };
          model?: ImageModel; // inherits canvas default
      }
    | {
          kind: "outpaint";
          sourceNodeId: string;
          prompt: string; // describes the extension
          direction: "all" | "left" | "right" | "top" | "bottom" | "custom";
          targetAspectRatio?: AspectRatio; // for aspect-retarget cases
          paddingPx?: {
              left: number;
              right: number;
              top: number;
              bottom: number;
          };
          model?: ImageModel;
      }
    | {
          kind: "bg_remove";
          sourceNodeId: string;
          replacement?:
              | { kind: "transparent" }
              | { kind: "color"; hex: string }
              | { kind: "generated"; prompt: string }; // triggers a second-stage generation
          model?: ImageModel;
      }
    | {
          kind: "upscale";
          sourceNodeId: string;
          factor: 2 | 4;
          denoise?: "off" | "light" | "strong";
          preserveDetails?: boolean;
          model?: ImageModel;
      };
```

All four kinds share `sourceNodeId` so a single resolver can fetch the input bytes for any primitive.

### 3.4 Output node type

All four produce an image node (same `CanvasNode` image variant the existing image generators emit). The distinguishing metadata is `data.editSpec` and the `edit_of` edge. No new visual node type.

## 4. Integration

### 4.1 Director tool

A single `plan_edit` FunctionTool in `src/lib/canvas/adk/tools.ts`:

```ts
parameters: z.object({
    edits: z.array(
        z.discriminatedUnion("kind", [
            inpaintSchema,
            outpaintSchema,
            bgRemoveSchema,
            upscaleSchema,
        ]),
    ),
});
```

Each entry resolves to one new canvas node with an `edit_of` edge to its `sourceNodeId`. Edits can chain (Director can emit `[upscale → inpaint]` as two entries referencing each other by id) — the chain materializes as a linear lineage of nodes.

`plan_edit` lives alongside `plan_image_generation` / `plan_video_generation` / `plan_production`. Director's prompt is updated so it picks `plan_edit` when the user references an existing canvas node and asks for a modification rather than a new generation.

### 4.2 Primitive skills

Four new skills under `src/lib/canvas/adk/skills/primitives/`:

- `inpaint/SKILL.md` — when to use vs. regenerate; mask vs text-region tradeoff; prompt phrasing for localized edits (describe target state, not transformation verb).
- `outpaint/SKILL.md` — direction + aspect retarget vs. padding; common pitfalls (subject anchoring, seam visibility).
- `bg-remove/SKILL.md` — three replacement modes; when to chain into generation vs. picking a flat color.
- `upscale/SKILL.md` — when to upscale (terminal step before delivery, not mid-pipeline); factor choice; denoise tradeoffs.

Each skill links to relevant pattern skills (e.g. inpaint → `virtual-tryon`, bg-remove → future `product-photography`).

### 4.3 Execution path

Edit primitives go through the existing `generation.ts` `executePlan` path:

1. `step-mapper.ts` maps each `editSpec` to a new `GenerationStep` discriminant `"edit"`.
2. `generation.ts` resolves `sourceNodeId` → signed URL of the source image; resolves bitmap mask URI if present.
3. Calls a new `editService` (extends `geminiService`) with primitive-specific Gemini config:
    - `inpaint`: edit mode + mask + prompt.
    - `outpaint`: edit mode + extended canvas with transparent padding as the implicit mask + prompt.
    - `bg_remove`: edit mode with "remove background; alpha channel" prompt; if `replacement.kind === "generated"`, the service makes a second call composing the masked subject onto a generated background.
    - `upscale`: dedicated upscale Gemini config (factor + denoise).
4. Output uploaded via `storageService`; signed URL cached.
5. `StepEvent` stream emits standard progress + completion events.

### 4.4 Mask editor (brush)

New component `src/components/canvas/mask-editor/`:

- Modal overlay on a single source image node.
- Canvas-based brush with size + softness controls; eraser; clear; invert.
- Output: PNG with alpha. Uploaded to GCS via `storageService` with TTL (mask is cheap to regenerate; do not bloat permanent storage).
- Returns `{ uri, softnessPx }` to the calling editor.
- Reused by `inpaint` and (optionally) by future `bg_replace` for manual subject correction.

Brush editor is **not** a free-standing route; it's invoked from a per-primitive edit panel.

### 4.5 Per-primitive edit panels

Each primitive has a small dedicated panel mounted as a side panel on the canvas:

- **Inpaint panel**: prompt textarea; mask source toggle (Brush ↔ Text); "Open mask editor" launches §4.4; model picker; submit.
- **Outpaint panel**: direction picker; target aspect ratio picker (when "aspect retarget" preset selected); padding sliders for "custom"; prompt textarea; model picker.
- **Bg-remove panel**: replacement radio (transparent / color / generated); color picker or prompt textarea; model picker.
- **Upscale panel**: factor (2× / 4×); denoise radio; preserve-details toggle.

Each panel calls the same downstream API (`POST /api/canvases/[id]/execute-plan` with a single-node plan) — no new route per primitive.

### 4.6 Canvas affordances

- Right-click on an image node → submenu "Edit" → four primitives.
- Drag-from-handle gesture on an image node spawns a "What edit?" picker.
- Director-planned edits appear as new image nodes with a subtle `edit_of` lineage line to the source.

## 5. Acceptance criteria

A1. `MEDIA_OPERATIONS` includes the four new values; `EDGE_ROLES` includes `edit_of`; type-check passes.
A2. `plan_edit` tool registered; Director invokes it for "remove the trash can from this photo" / "extend this to 16:9" / "give me a transparent cutout" / "upscale to 4×" prompts that reference an existing canvas node id.
A3. Inpaint with bitmap mask and prompt produces a new image node with `editSpec.kind === "inpaint"`, an `edit_of` edge to the source, and a rendered result reachable via signed URL.
A4. Inpaint with text-described region (no bitmap) executes against the Gemini edit API with the region description in the prompt; returns a result; surfaces a warning that quality varies.
A5. Outpaint with `direction: "all"` and `targetAspectRatio: "16:9"` produces an image at the target aspect ratio with the source content centered and extensions generated to match.
A6. Bg-remove with `replacement.kind === "transparent"` produces a PNG with alpha; `replacement.kind === "color"` produces a flat-background composite; `replacement.kind === "generated"` triggers a two-stage flow whose final node also carries `editSpec.kind === "bg_remove"`.
A7. Upscale 2× / 4× produces an image whose pixel dimensions match the factor (±1px tolerance for odd dims).
A8. Mask editor produces a PNG with alpha; uploaded with TTL metadata; the URI is consumable by inpaint.
A9. Director can chain edits: `plan_edit([{ inpaint on node A → node B }, { upscale on node B → node C }])` materializes two child nodes with correct lineage.
A10. Per-primitive panel from the right-click menu produces an identical result to a Director-planned edit given the same parameters.
A11. Failures of one edit in a multi-edit `plan_edit` call do not block siblings; failed nodes carry a structured error in `data`.

## 6. Code style

- Types in `src/lib/canvas/types.ts` co-located with existing `MediaOperation` / `EdgeRole`.
- `editService` in `src/lib/canvas/services/edit.service.ts` — thin wrapper over the existing `geminiService` image-edit calls; pure mapping from `EditSpec` → Gemini request config.
- `plan_edit` tool in `src/lib/canvas/adk/tools.ts` with a discriminated-union Zod schema; reject malformed combinations (e.g. `bg_remove` with `mask`).
- Mask editor: stateless React component over a single reducer.
- Per-primitive panels: shared layout primitives in `src/components/canvas/edit-panels/`; each panel a small file.
- No comments unless WHY is non-obvious. No backwards-compat shims.

## 7. Testing strategy

- Unit: `EditSpec → Gemini request config` mapping for each primitive; reject malformed combinations.
- Unit: outpaint padding-resolver math (direction + target aspect → padding rectangle).
- Unit: `plan_edit` Zod schema accepts each discriminant; rejects cross-kind field leakage (e.g. `factor` on an inpaint entry).
- Unit: mask editor reducer (brush stroke append, undo / redo, clear, invert, softness).
- Unit: chain materialization — `plan_edit` with two entries where the second references the first produces two nodes with correct `edit_of` edges and execution order.
- Integration (`.integration.test.ts`, opt-in): end-to-end inpaint with a fixture mask; upscale 2×; bg-remove transparent.
- No quality assertions on output pixels (Gemini-dependent); structural assertions only (dimensions, alpha presence, lineage).

## 8. Boundaries

**Always do:**

- Validate `sourceNodeId` resolves to an image node before issuing the request.
- Strip masks from output node metadata after execution — masks are intermediate, do not persist on the canvas node forever.
- Emit `edit_of` edges so lineage is queryable.
- Cap individual edit input dimensions at the Gemini API limit; reject larger sources with a clear error.
- Preserve the source node — edits never mutate the parent.

**Ask first about:**

- Adding specialized vendors per primitive (SAM, rembg, Real-ESRGAN).
- Mutating in-place with version history.
- Video-frame editing.
- Multi-region masks in a single inpaint call.
- Adding `relight` or `color_grade` primitives.
- Persisting masks as first-class canvas assets.

**Never do:**

- Send the bitmap mask to clients other than the editService; it's a temporary artifact.
- Allow `plan_edit` entries to reference a `sourceNodeId` that isn't an image node (no video inpaint in v1).
- Skip lineage edges — every edit must carry `edit_of`.
- Run upscale on an already-upscaled chain beyond 16× total (cumulative cap; reject beyond).
- Stage a bg-remove `generated` replacement without showing the user the masked intermediate first when invoked from the UI path (Director path skips the confirmation).

## 9. Open questions

- Should `bg_replace` be its own MediaOperation, or stay as `bg_remove` with `replacement.kind === "generated"`? Leaning latter for v1 simplicity; revisit if the agent struggles to plan it.
- Text-described masks: do we send the description as a prompt-prefix or as a structured region hint? Depends on Gemini API; verify and lock in.
- Mask asset TTL: 24h vs 7 days vs lifetime-of-edit-node. Leaning 7 days for re-editability.
- How do we communicate per-primitive quality bars in the UI without overwhelming the user? (e.g. "text-described masks are best-effort.")
- Cumulative upscale cap is arbitrary at 16× — revisit once we see real usage.
- When the Director chains `bg_remove → inpaint`, the inpaint's `sourceNodeId` is the transparent PNG — masking on an alpha image needs verification.
