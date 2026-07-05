---
name: multi-shot-video
description: Multi-shot video production. Composes a video from a sequence of distinct shots. Trigger ONLY when the user explicitly asks to generate a video longer than 10 seconds (duration > 10s). DO NOT trigger if the requested video is 10 seconds or less.
metadata:
    type: pattern
---

## Trigger condition

Use this pattern ONLY when the user explicitly asks to generate a video longer than 10 seconds (duration > 10s).

Do **not** use this pattern if:

- The requested video is 10 seconds or less (duration <= 10s). E.g. 4s, 6s, 8s videos. In those cases, use a single video generation step/operation directly.
- The request is for a single animated image or a single clip — use `i2v` directly instead.

---

## Pre-production: scenario document

**Before planning any nodes, call `plan_text_nodes` to emit a scenario document.** This externalizes the script breakdown so the user can review and edit it before media generation begins.

The scenario document MUST contain:

1. **Visual style anchor** — physical description of the world: palette, light quality, surface textures, atmosphere. No mood words — translate everything to observable facts.
2. **Shot list** — one entry per shot, each with:
    - **Scene** — location, time of day, physical environment facts.
    - **Subject** — who or what is in frame and what they do (one verb, one motion arc).
    - **Camera** — one move, one rhythm word.
    - **Duration** — 4, 6, or 8 seconds only.
    - **Audio** — ambient, SFX, music cue, dialogue, or explicit silence.
3. **Structure** — label each shot by phase:

| Phase      | Role                                    | Typical duration |
| ---------- | --------------------------------------- | ---------------- |
| Hook       | Capture attention — striking visual     | 4–6s             |
| Build      | 1–3 scenes that establish context/story | 4–6s each        |
| Climax     | The emotional or product peak           | 6–8s             |
| Resolution | Logo, tagline, CTA, or lingering image  | 4–6s             |

Use `format: "scenario"` and a descriptive title (e.g. `"Lumino — Trailer Architecture"`).

After emitting the scenario, proceed directly to `plan_production`. Reference each shot's scene description in the corresponding `promptIntent` fields — do not re-derive them from the original user message.

If a canvas text node with `format: scenario` already exists, read its content from the canvas context and use it as the grounding source. Do NOT emit a new scenario.

Adjust shot count to fit the brief: a 15-second ad needs 3–4 shots, a 30-second film needs 5–7.

---

## Mandatory node order — no exceptions

Every shot in a multi-shot production follows this fixed sequence:

```
Phase 0: t2i reference nodes   (characters, hero props, settings — generated first, in parallel)
Phase 1: t2i keyframe          (one per shot — always generated, never skipped)
Phase 2: i2v animation         (depends_on the keyframe from Phase 1 — always)
Phase 3: concat                (assembles all i2v nodes — always last)
```

**t2v is forbidden in multi-shot production.** Use `t2i → i2v` for every shot, always. `t2v` skips the keyframe and produces subjects that drift across shots.

**Existing canvas nodes are forbidden as direct input to `i2v`.** A product photo, reference image, or any node already on the canvas must never be wired directly into an `i2v`. It may be used as `subject_ref` or `style_ref` on a `t2i` keyframe — but generating the keyframe is mandatory regardless.

---

## Phase 0: Reference generation

Generate these **before any shot keyframe**. They anchor visual identity across shots. Skip none that apply.

**Character reference** (one per human subject appearing in more than one shot):

```
operation: t2i
promptIntent: "Full-body neutral-pose reference of [description]. Front-facing, clean background, even lighting. No action, no set."
label: "Ref — [Name / role]"
```

**Hero prop reference** (one per object that must look consistent across shots — product, vehicle, garment, tool):

```
operation: t2i
promptIntent: "Isolated [prop description] on neutral background, lit to reveal shape, texture, and material. No hands. No scene."
label: "Ref — [Prop name]"
```

**Setting reference** (one per location used in more than one shot):

```
operation: t2i
promptIntent: "Wide establishing shot of [location]. [Physical facts: architecture, surfaces, light quality, time of day]. No people."
label: "Ref — [Location]"
```

These nodes have no `depends_on` edges. They run in parallel.

---

## Phase 1–2: Shot keyframe + animation (repeat per shot)

For every shot, generate the keyframe first, then animate it:

```
t2i keyframe:
  operation: t2i
  promptIntent: "[Scene physical facts]. [Subject pose and position in frame]. [Lens, focal length, lighting facts]."
  edges:
    subject_ref: character or hero prop reference (if applicable)
    style_ref: setting reference (if applicable)
  label: "Shot N — [descriptor] keyframe"

i2v animation:
  operation: i2v
  promptIntent: "[ACTION: one verb, one motion arc]. [CAMERA: one move + rhythm word]. [AUDIO: ambient / SFX / music / dialogue / explicit silence]. Duration: [4|6|8]s."
  edges:
    depends_on: the t2i keyframe above — mandatory
    subject_ref: character or hero prop reference (if applicable)
  duration: 4 | 6 | 8
  label: "Shot N — animated"
```

---

## Phase 3: Concat

```
concat:
  operation: concat
  promptIntent: "Assemble shots in narrative order. No transition effects unless user specified."
  edges: depends_on from each i2v node, in sequence order
  label: "Final cut"
```

---

## Edge rules

- `i2v` depends on its `t2i` keyframe. Always. No direct wire from any canvas node or reference to `i2v`.
- Character/prop references → `subject_ref` on every `t2i` and `i2v` featuring them.
- Setting references → `style_ref` on every `t2i` set in that location.
- `concat` depends on all `i2v` nodes in shot order. Never depends on `t2i` nodes directly.

---

## Model selection

Always use the canvas default model for every node unless the user explicitly names a model in their request. Do not upgrade to `veo-3.1-generate-001` because the output is "an ad" or "final quality" — that is the user's decision to make, not yours.

---

## Pacing rules

- Keep each `i2v` at 4s unless the shot has complex action or camera movement — then use 6s or 8s.
- The total assembled duration is the sum of all `i2v` durations. Check it against the user's stated length before committing.
- A 30-second spot = roughly 5–7 shots averaging 5s each. A 15-second ad = 3–4 shots.
- Resist stacking every shot at 8s — the edit will feel slow. Vary rhythm: short punchy cuts (4s) followed by a longer breathing shot (6–8s).

---

## Audio continuity

Treat audio as a separate layer with its own continuity:

- **NO PARALLEL AUDIO NODES:** The `concat` primitive only joins video clips; it does **not** support overlaying or mixing separate audio tracks. Never plan separate `t2s` or `t2m` nodes and connect them to video or `concat` nodes.
- **WRITE AUDIO IN VIDEO PROMPTS:** Instead, specify all shot-specific dialogue, music, or room tone directly in the individual shot (`i2v`) prompts' `[AUDIO]` section. The video model will generate the audio track natively within each clip.
- If music and ambient coexist, note the balance: "Coffee shop murmur at -28dB beneath slow piano at -18dB."

---

## Worked example — 2-shot UGC product ad, 8s, 9:16

**Brief:** "Make a short UGC ad for this skincare product, 8 seconds, 9:16." User has a product photo on the canvas.

**Script breakdown:**

- Shot 1 (4s): Creator in bathroom, holds product up, speaks to camera.
- Shot 2 (4s): Close-up of glowing skin the morning after, natural light.

**Correct plan — 6 nodes total:**

```
Node 1 — Phase 0: product reference
  operation: t2i
  promptIntent: "Isolated [product name] tube on a clean white background. Front-facing, even studio lighting, sharp focus on label and packaging texture. No hands. No scene."
  label: "Ref — Product"
  edges: none

Node 2 — Phase 0: character reference
  operation: t2i
  promptIntent: "Full-body neutral-pose reference of young woman, late 20s, natural makeup, light hair. Front-facing, clean white background, soft even lighting. No action, no props."
  label: "Ref — Creator"
  edges: none

Node 3 — Phase 1: Shot 1 keyframe
  operation: t2i
  promptIntent: "Young woman in white-tiled bathroom, holding skincare tube up at chest height toward camera. Slight forward lean. Warm ring-light directly behind camera. Shallow depth of field, background softly defocused. 9:16 vertical frame."
  edges:
    subject_ref: Node 1 (product ref)
    subject_ref: Node 2 (character ref)
  label: "Shot 1 — bathroom intro keyframe"

Node 4 — Phase 2: Shot 1 animation
  operation: i2v
  promptIntent: "ACTION: She rotates the product slightly toward lens, eyebrows raise, lips part into a wide smile. CAMERA: Gentle handheld sway, slow push-in. AUDIO: Dialogue — 'You guys, I am obsessed with this.' Room tone at -30dB. No music. Duration: 4s."
  edges:
    depends_on: Node 3 (Shot 1 keyframe)
    subject_ref: Node 2 (character ref)
  duration: 4
  label: "Shot 1 — animated"

Node 5 — Phase 1: Shot 2 keyframe
  operation: t2i
  promptIntent: "Close-up of young woman's face, right cheek in sharp focus. Morning light from window at 45-degree angle from upper left. Visible skin texture, soft natural glow. No product in frame. 9:16 vertical."
  edges:
    subject_ref: Node 2 (character ref)
  label: "Shot 2 — morning skin keyframe"

Node 6 — Phase 2: Shot 2 animation
  operation: i2v
  promptIntent: "ACTION: She presses fingertips gently to cheekbone, skin rebounds to show elasticity. CAMERA: Organic handheld sway. AUDIO: Soft morning birdsong at low volume, no dialogue, no music. Duration: 4s."
  edges:
    depends_on: Node 5 (Shot 2 keyframe)
    subject_ref: Node 2 (character ref)
  duration: 4
  label: "Shot 2 — animated"

Node 7 — Phase 3: Concat
  operation: concat
  promptIntent: "Assemble Shot 1 then Shot 2 in order. No transitions."
  edges:
    depends_on: Node 4, Node 6
  label: "Final cut"
```

**What is absent from this plan and why:**

- No `t2v` nodes. Every video starts from a `t2i` keyframe.
- The product photo from the canvas does not appear as a direct edge into any `i2v`. It informed Node 1 (the product reference), which then flows through the keyframes.
- The character does not exist on the canvas — a reference was generated from scratch.

---

## Common failures

- **Using `t2v` for any shot.** Forbidden. Always use `t2i → i2v`.
- **Wiring a canvas node or reference image directly into `i2v`.** Forbidden. Generate a `t2i` keyframe first. The canvas node can be `subject_ref` on the keyframe — but the keyframe is never optional.
- **Skipping Phase 0 references.** Skipping character references causes identity drift across shots. Skipping product/hero prop references causes inconsistent object appearance. Skipping setting references causes location incoherence. Generate all that apply, every time.
- **Skipping the keyframe because "the reference is good enough".** It is not. The reference defines identity; the keyframe defines framing, lighting, and pose for that specific shot. They are different nodes with different purposes.
- **Wiring `t2i` nodes directly into `concat`.** Produces a slideshow of stills. Always animate first.
- **Mood words without physical grounding.** "Cinematic", "epic", "emotional" produce generic output. Translate to physical facts before passing to PromptEngineer.
- **All shots at maximum duration.** Vary rhythm — short punchy cuts (4s) followed by longer breathing shots (6–8s).
- **Omitting audio in any `i2v` node.** Always specify, even if "No dialogue. No music. Room tone only."
