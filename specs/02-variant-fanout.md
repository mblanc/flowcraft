# Spec 02 — Variant Fanout

Status: draft
Gap: #2 from genmedia use-case audit (variant / locale / segment fanout)

## 1. Objective

Make multi-variant generation a first-class primitive of the canvas. One source intent → N materialized variants across aspect ratio, locale, and audience segment, with per-variant overrides for prompt, model, copy, and voiceover.

Today the Director can plan a DAG of media nodes but every output is unique. The use cases with the largest TAM in the genmedia audit (ad creative #1, e-commerce imagery #3, localization #5) all share the same structural need: one source × M aspect ratios × N locales × K segments. Without a first-class abstraction, the Director either (a) emits a giant flat DAG that scales poorly and is unreadable, or (b) silently drops variant axes the user asked for.

Target users:

- Director agent (plans variant fanout as part of a production plan).
- Human user (manual "fanout this node" affordance or template authoring in a side panel).

## 2. Scope

In scope for v1:

- Three fanout axes: **aspect ratio**, **locale** (copy + voiceover), **audience segment** (prompt / model overrides).
- Axes are independently composable (full cartesian product by default, with explicit exclusion support).
- Variant sources: user-authored literal lists, brand-kit-derived (stub until spec #4 lands; v1 reads from a JSON file on the project), LLM-generated proposals, CSV import.
- Authoring model: **template + auto-expand**. A `variant_template` node materializes N child variant nodes on canvas grouping under a collapsible container.
- Variant nodes are addressable individually (each has its own node id and can be referenced by downstream edges).
- Compose interop: **inputs only** in v1. Compose nodes pick a single variant per axis at most. No compose-level fanout.
- Per-axis override hooks: prompt rewriter, copy rewriter, voiceover swap, model swap, aspect-ratio swap.
- Execution: variants run through the existing `executePlan` path with `BATCH_CONCURRENCY` controlling parallelism; failures are isolated per variant.

Out of scope for v1 (tracked as follow-ups):

- Compose-level fanout (one compose definition → N rendered deliverables).
- Custom axes beyond the three named (e.g. "season", "price tier"). The data model supports them; the UI does not.
- Variant-level analytics / winner tracking.
- A/B test infrastructure (impression tracking, variant selection by performance).
- Real-time brand kit binding — v1 reads from a static `project.brandKit.json`; spec #4 makes it dynamic.
- Variant deduplication / cost preview before execution beyond a simple count and rough cost estimate.

## 3. Data model

### 3.1 Axes and variants

```ts
type VariantAxis =
    | { kind: "aspectRatio"; values: AspectRatio[] }
    | { kind: "locale"; values: Locale[] } // { code: "fr-FR", label?: "France" }
    | { kind: "segment"; values: SegmentValue[] }; // { id, label, overrides }

type Locale = {
    code: string; // BCP-47, e.g. "fr-FR"
    label?: string;
    voiceId?: string; // overrides default voice for t2s in this locale
};

type SegmentValue = {
    id: string; // stable id used in node ids
    label: string; // human-readable, e.g. "Gen Z urban"
    promptOverride?: string; // appended/spliced into base prompt
    modelOverride?: string; // pin to a specific model for this segment
};
```

### 3.2 Variant template node

A new `MediaOperation` value `"variant_template"`. The template node `data`:

```ts
type VariantTemplateData = {
    baseNodeId?: string; // optional: a canvas node whose plan is the template
    baseIntent?: PlanNode; // alternative: inline template
    axes: VariantAxis[]; // ordered for display; full cartesian product by default
    exclusions?: VariantKey[]; // explicit cells to skip
    copyByLocale?: Record<string, string>; // locale.code → overlay/script copy
    status: "draft" | "expanded" | "stale"; // stale when source intent edited after expansion
    expandedChildren: string[]; // node ids of materialized variants
    groupingLabel?: string; // for the canvas container chrome
};

type VariantKey = Record<string, string>; // axisKind → value identifier
```

### 3.3 Variant nodes

Materialized child nodes are normal canvas nodes (whatever the base operation was — `t2i`, `t2v`, `compose`, etc.) tagged with:

```ts
type VariantOriginRef = {
    templateId: string;
    variantKey: VariantKey; // e.g. { aspectRatio: "1:1", locale: "fr-FR", segment: "luxury" }
    index: number; // stable ordering within the template
};
```

Stored on `CanvasNode.data.variantOrigin`. Used for:

- Re-running a single cell.
- Re-expanding the template without losing user edits per variant (variants flag `editedByUser` like compose).
- Grouping in the canvas UI.

### 3.4 Edges

Existing `EDGE_ROLES` plus a new role:

```ts
type EdgeRole = "depends_on" | "style_ref" | "subject_ref" | "variant_of";
```

`variant_of` edges from each materialized variant to its template enable canvas-level group rendering and cleanup.

## 4. Integration

### 4.1 New Director tool

`plan_variant_template` in `src/lib/canvas/adk/tools.ts`. Parameters:

```ts
{
  baseIntent?: PlanNodeSchema,         // or baseNodeId
  baseNodeId?: string,
  axes: VariantAxisSchema[],
  exclusions?: VariantKeySchema[],
  copyByLocale?: Record<string, string>,
  groupingLabel?: string,
}
```

The Director calls this when the user asks for "five aspect ratios", "translated into French / German / Japanese", "for three audience segments", or any combination. The tool returns the template payload; expansion happens in a follow-up phase (so the Director can offer the matrix back to the user for approval before materialization).

### 4.2 New primitive skill

`src/lib/canvas/adk/skills/primitives/variant-fanout/SKILL.md`:

- When to fan out vs. emit individual nodes (threshold: ≥2 axes or ≥3 values on one axis → use template).
- How to phrase axes (don't conflate locale with segment).
- Cost calibration: cartesian-product size warning.
- Brand-kit lookup contract (read from `project.brandKit.json` for v1).

### 4.3 New pattern skills (sketch only; not built in v1)

- `ad-creative-dco/SKILL.md` — segment × aspect ratio for ad variants.
- `localization/SKILL.md` — locale-driven copy + voice swaps.

These reference the variant-fanout primitive.

### 4.4 Expansion engine

New module `src/lib/canvas/variant-expansion.ts`:

```ts
export function expandVariantTemplate(
    template: VariantTemplateData,
    brandKit: BrandKit | null,
): {
    variants: Array<{
        key: VariantKey;
        node: PlanNode; // fully resolved plan node, prompt engineered with overrides
    }>;
    warnings: string[]; // axis count too large, missing locale copy, etc.
};
```

Responsibilities:

1. Compute cartesian product of `axes.values`, minus `exclusions`.
2. For each cell, clone `baseIntent` and apply per-axis overrides in deterministic order: `aspectRatio` → `segment` → `locale`.
3. Resolve prompts through `PromptEngineer` with axis context appended (e.g. "Render at 9:16 portrait. Audience: Gen Z urban. Copy in French.").
4. Resolve locale-driven copy from `copyByLocale` or fall back to the base copy.
5. For audio nodes downstream of a locale axis, swap `voiceId` based on `Locale.voiceId`.
6. Emit warnings for cell counts > 24, missing copy strings, and axis combinations the model card flags as unsupported (e.g. an image model that doesn't support 9:16).

Pure function; no I/O. Easy to unit test.

### 4.5 Materialization

A new API route `POST /api/canvases/[id]/variant-templates/[templateId]/expand`:

- Resolves brand kit (file read for v1).
- Calls `expandVariantTemplate`.
- Writes materialized nodes via `canvas.service`, attaches `variant_of` edges, marks template `status: "expanded"`.
- Streams progress as SSE so large expansions don't block the UI.

User can then trigger a "Run all variants" action that submits each materialized node through `executePlan`. Failures isolate per variant.

### 4.6 UI affordances

- **Template authoring panel**: opens on selecting a `variant_template` node. Three tabs (one per axis), each with:
    - Add / remove / reorder values.
    - Source picker: literal list, brand kit, LLM propose, CSV upload.
    - Locale tab additionally shows a per-locale copy editor.
- **Cartesian preview**: a count badge ("3 × 4 × 2 = 24 variants — est. cost X credits"); exclusion checkboxes in a small matrix preview.
- **Canvas container**: variants render inside a labeled collapsed group by default. Expanded shows all children. Single-cell re-run available from the group context menu.
- **LLM-propose modal**: invokes a single-turn agent (`VariantProposer`) that returns a draft `axes` payload; user edits before applying.
- **CSV import**: drag-drop CSV onto the panel. Headers map to axis kinds (`aspect_ratio,locale,segment_id,segment_label,prompt_override,model_override,copy`). Unknown columns surface a warning.

### 4.7 Compose interop (v1)

A compose node may reference variant nodes as inputs but cannot itself be a variant template. To produce one compose per variant, the user duplicates the compose node manually or the Director plans separate compose nodes per variant. This is intentional v1 scope; revisited in a follow-up.

A variant node referenced by a compose timeline carries its `variantOrigin` metadata so the compose UI can show "Hero shot (FR, 1:1)" in the asset shelf instead of a bare label.

## 5. Acceptance criteria

A1. `MEDIA_OPERATIONS` includes `"variant_template"`; `EDGE_ROLES` includes `"variant_of"`; type-check passes.
A2. `plan_variant_template` tool registered and invoked by Director when user prompts a fanout request.
A3. `expandVariantTemplate({ axes: [{kind:"aspectRatio",values:["1:1","9:16","16:9"]}, {kind:"locale",values:[fr,de]}, {kind:"segment",values:[A,B]}], baseIntent: t2iIntent }, null)` returns 12 plan nodes with deterministic ids, each carrying its `variantKey`.
A4. Exclusions are honored: an excluded `{aspectRatio:"9:16", locale:"de-DE"}` cell drops from the output.
A5. Per-locale `copyByLocale` is applied to overlay/script text on the materialized plan node.
A6. Materialized variant nodes carry `variantOrigin.templateId`, `variantKey`, `index`.
A7. Re-expanding a template preserves nodes flagged `editedByUser: true` and only regenerates the rest.
A8. Cost preview shows the cartesian count (post-exclusion) before materialization.
A9. CSV import with headers `aspect_ratio,locale,segment_id,segment_label,copy` materializes axes matching the spreadsheet; unknown columns produce a warning, not a hard error.
A10. LLM-proposed axes are editable before apply.
A11. Per-variant execution failure does not block sibling variants.
A12. The canvas UI groups variants under a collapsible container with `variant_of` edges hidden by default.
A13. A compose node referencing a variant node shows the variant key in its asset shelf label.

## 6. Code style

- Types in `src/lib/canvas/types.ts` co-located with existing `MediaOperation` and `EdgeRole`.
- Expansion engine in `src/lib/canvas/variant-expansion.ts` — pure, no I/O, full unit coverage.
- Director tool in `src/lib/canvas/adk/tools.ts` with Zod schema; cartesian preview computed client-side.
- UI in `src/components/canvas/variant-template-panel/` with a single reducer (mirrors compose Studio approach in spec 01).
- API route: `src/app/api/canvases/[id]/variant-templates/[templateId]/expand/route.ts`.
- No comments unless WHY is non-obvious. No backwards-compat shims.

## 7. Testing strategy

- Unit: `expandVariantTemplate` — cartesian math, exclusions, override application order, deterministic id generation, locale-driven overrides, warning emission.
- Unit: CSV parser — header detection, unknown columns, malformed rows.
- Unit: cartesian count selector and cost estimator.
- Unit: template reducer (add / remove / reorder values per axis; exclusion toggle; locale copy edits).
- Integration: end-to-end materialization of a 2×2 template against a test canvas; verify node count, edges, `variantOrigin`.
- Integration: per-variant execution isolates failures (mocked `executePlan` rejects one cell, others complete).
- No tests for LLM-propose modal content quality (covered by Director-level integration if at all).

## 8. Boundaries

**Always do:**

- Cap cartesian product at 100 variants per template; reject beyond that with a clear error.
- Validate axis values against existing constants (`IMAGE_ASPECT_RATIOS`, `VIDEO_ASPECT_RATIOS`, supported locales list).
- Preserve `editedByUser` variants across re-expansion.
- Use deterministic node ids (`${templateId}__${axisHash}`) so re-expansion is idempotent.
- Isolate per-variant execution failures.
- Stream expansion progress for templates > 12 cells.

**Ask first about:**

- Adding new axes beyond aspect ratio / locale / segment.
- Enabling compose-level fanout.
- Tying variant_template to a live brand-kit subscription (defer to spec #4).
- Auto-running materialized variants on expansion (default is materialize → user confirms run).
- Cost-gating expansion behind a credit check.

**Never do:**

- Materialize a template with > 100 cells in v1.
- Silently drop axes the Director requested — surface a warning and proceed with what's supported.
- Mutate child variant nodes when the user only re-edits the template's non-overridden fields (e.g. changing `groupingLabel` should not rerun variants).
- Conflate locale with segment (locale is text + voice; segment is prompt + model).
- Persist CSV uploads beyond the expansion call (no project-level CSV storage in v1).

## 9. Open questions

- Brand kit coupling: v1 reads from a static JSON; spec #4 needs to decide schema before that file shape is locked in.
- LLM-proposed segment quality: the `VariantProposer` agent's prompt is unstated; treat as a follow-up.
- Should the variant container be a single canvas node with rendered child previews, or true child nodes laid out in a grid? Leaning child nodes for addressability, but the canvas layout cost may push us to virtualized children.
- How do we surface model-card aspect-ratio support mismatches in the UI without blocking valid use cases?
- Per-variant cost preview vs. flat estimate — the latter is cheap; the former needs per-model pricing wired in.
