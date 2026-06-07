# Feature Prioritization — Value / Effort Matrix

Classification of the 5 draft specs against the genmedia use-case audit
(top TAM: ad creative, video, e-commerce imagery, gaming, voice/dubbing,
VFX, corporate/L&D, real-estate, music, synthetic data).

## Effort & Value reasoning (per spec)

| Spec                     | Effort drivers                                                                                                                                       | Value drivers (which top-10 use cases it unlocks)                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **01 Compose**           | Big — ffmpeg pipeline, full Compose Studio UI (timeline + layer editor), reducer, preview renders, intent↔timeline resolver                          | Critical — without it, **none** of the top 1/2/7 use cases ship end-to-end. It's the "deliverable" layer.                               |
| **02 Variant fanout**    | Medium — expansion engine is a pure function, but template panel, CSV/LLM-propose, canvas grouping, brand-kit JSON stub all needed                   | Critical — directly serves top-1 (ad DCO), top-3 (e-commerce SKU imagery), top-5 (localization). Largest TAM compounder.                |
| **03 Edit primitives**   | Small-to-medium — wraps existing Gemini edit APIs; mask editor is the only net-new UI; 4 small panels                                                | High — required for top-3 (product retouching), top-8 (virtual staging), and any "post-production" workflow.                            |
| **04 Brand kit**         | Medium — Firestore service + asset upload + Manager UI route + Director context injection; lots of surface, low algorithmic complexity               | High — the _moat_ layer for top-1, top-3, top-7. Multiplies value of every other spec (compose, fanout, avatar all consume it).         |
| **05 Avatar / lip-sync** | Medium-large — Veo+t2s orchestration is small, but stock catalog curation + licensing + user-photo consent flow are real costs; quality risk is high | High but risky — unlocks top-7 (corporate/L&D, the "underrated big market"). Quality of native Veo lip-sync is the existential unknown. |

## Decomposition — finer-grained features

Some specs split cleanly into a cheap core + an expensive UI layer. Splitting reveals quick wins.

| #   | Feature                                                                                                           | Effort                | Value                                     |
| --- | ----------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------- |
| A   | **Compose — engine + Director tool** (timeline schema, ffmpeg service, `plan_compose`, terminal-node integration) | M                     | **Very High**                             |
| B   | **Compose Studio (visual editor)** (preview render, timeline UI, layer panel, undo/redo)                          | **L**                 | M (nice but Director can already deliver) |
| C   | **Variant expansion engine** (`expandVariantTemplate`, `plan_variant_template`, materialization API)              | M                     | **Very High**                             |
| D   | **Variant authoring UI** (panel, CSV import, LLM-propose, canvas grouping)                                        | M                     | M                                         |
| E   | **Edit primitives — backend** (`plan_edit`, EditSpec → Gemini mapping, `edit_of` lineage)                         | **S**                 | **High**                                  |
| F   | **Mask editor + per-primitive panels**                                                                            | S-M                   | M                                         |
| G   | **Brand kit — data + Director injection** (service, schema, summary builder, attachment API)                      | M                     | **High**                                  |
| H   | **Brand Kit Manager UI** (manager route, subject editor, sharing UX)                                              | M                     | M                                         |
| I   | **Avatar — talking-head primitive** (t2s→Veo orchestration, side panel, single source)                            | M                     | High (if quality holds)                   |
| J   | **Stock presenter catalog + licensing + user-photo consent**                                                      | **L** (non-eng heavy) | M                                         |
| K   | **Explainer pattern skill** (Director plans realistic explainer sequences)                                        | XS                    | M                                         |

## Value / Effort plot

```
                        EFFORT →
            LOW                              HIGH
        ┌────────────────────────┬────────────────────────┐
   HIGH │   QUICK WINS           │   BIG PROJECTS         │
    ↑   │                        │                        │
        │   E  Edit backend      │   A  Compose engine    │
   V    │   K  Explainer skill   │   C  Variant engine    │
   A    │                        │   G  Brand kit data    │
   L    │                        │   I  Avatar primitive  │
   U    │                        │                        │
   E    ├────────────────────────┼────────────────────────┤
        │   FILL-INS             │   REJECTS / DEFER      │
   LOW  │                        │                        │
        │   F  Mask + edit panels│   B  Compose Studio UI │
        │   D  Variant UI panel  │   J  Stock presenters  │
        │   H  Brand kit manager │      (licensing-heavy) │
        └────────────────────────┴────────────────────────┘
```

## Recommended sequencing

1. **Ship quick wins first** — `E` (edit backend) and `K` (explainer skill) are days of work and immediately broaden what Director can plan.
2. **Big-project order**:
    - `G` Brand kit data layer first — every later spec (compose fonts, variant locale axis, avatar voice) consumes it. Locking the schema now avoids rework.
    - `A` Compose engine — the "deliverable" gate; nothing else ships finished artifacts without it.
    - `C` Variant engine — biggest TAM unlock (ad DCO + localization + SKU imagery).
    - `I` Avatar — gated on Veo quality test; do a 1-week spike before committing.
3. **Fill-ins** (D, F, H) can land alongside or after their respective backends once user demand validates the UI investment.
4. **Defer**: `B` Compose Studio (Director-driven compose covers ~80% of use cases — full visual editor is a large UI investment that should follow real user usage). `J` Stock presenter curation has non-eng blockers (licensing, legal) — start the procurement track in parallel but don't gate the avatar primitive on it; user-photo + brand-kit subject paths suffice for v1.

**Critical-path summary**: `G → A + C` in parallel → `I` (after Veo spike). Edit primitives (`E`) and explainer skill (`K`) drop in any time as quick wins.

---

## Quick wins — why they qualify

Both are **low effort, high value** because they ride on infrastructure that already exists. No new services, no new UI surfaces of consequence, no external dependencies.

### E — Edit primitives backend (`inpaint`, `outpaint`, `bg_remove`, `upscale`)

**Why low effort:**

- The Gemini image-edit models are already wired through `geminiService` — the four primitives are different **request configs**, not new vendors.
- Only one new Director tool (`plan_edit` with a discriminated-union schema) and one new `GenerationStep` discriminant. The execution path (`generation.ts` → service → `storageService` → signed URL → `StepEvent`) is reused verbatim.
- One new `EdgeRole` (`edit_of`) and 4 entries in `MEDIA_OPERATIONS`. No new database collections, no new API routes per primitive (the existing `execute-plan` route handles single-node plans).
- Deferring the **mask editor UI** and per-primitive side panels (feature F) drops the bulk of the work. Backend-only means the Director can plan edits today via prompts; text-described masks ("the sky", "the trash can") work without any brush UI.

**Why high value:**

- Unlocks **top-3 e-commerce imagery** (background removal/replacement, packshot cleanup) and **top-8 virtual staging** (outpaint to retarget aspect, inpaint to remove clutter).
- Turns the canvas from a **synthesis-only** surface into an **edit surface** — commercial media workflows are 80% edit, 20% generation. Today users have to leave the product for any retouching.
- Composes with everything else: edits work on variant outputs, on talking-head frames, on compose inputs. Force-multiplier across the roadmap.
- The Director can chain `[upscale → inpaint]` as a terminal "finishing pass" before delivery — a workflow users currently can't express at all.

**Ship sequence:** `plan_edit` tool + `editService` + `edit_of` edge + text-mask path. Add the brush mask editor (F) later when usage tells you it's worth the UI investment.

### K — Explainer pattern skill

**Why low effort:**

- It's a **single markdown file** in `src/lib/canvas/adk/skills/patterns/explainer-video/SKILL.md`. No code, no schema, no tests.
- The Director already loads pattern skills automatically (`variant: "b"` path in `runner.ts`). Drop the file in, it's live.
- Pure prompt engineering: encodes the canonical explainer structure (hook → 3–5 points → CTA), VO continuity rules, when to use talking-head vs. B-roll + VO-only, how to plan the compose timeline.

**Why high value:**

- It's the **planning glue** that makes compose + avatar + variant fanout actually produce shippable explainer videos instead of disconnected clips. Without it, the Director plans one monolithic shot or a random sequence.
- Unlocks **top-7 corporate / L&D** — the "quietly enormous" market segment from the audit, where every large company produces training and onboarding content continuously.
- Pays off even before avatar (spec 05) ships: a compose-only explainer with t2s VO + B-roll is a useful deliverable today.
- Costs almost nothing to write and iterate. Easy to A/B different versions against real prompts.

**Ship sequence:** Write the skill, test it against 5–10 representative prompts ("make me a 30s onboarding video for X"), iterate the structure based on what the Director actually produces.

### The common pattern

Both wins exploit the same lever: **the heavy infrastructure (ADK runner, generation pipeline, skill loading) is already built.** What's missing is _capability surface_ — telling the Director it can do more things. Adding capability via tools and skills is dramatically cheaper than adding new UI or new services, and it unlocks user value the day it ships.
