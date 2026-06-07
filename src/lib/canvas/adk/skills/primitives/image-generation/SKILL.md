---
name: image-generation
description: Image generation. Produces a still image from text, edits an existing image, or composites multiple images. Use for any output that is a single still frame — concept art, character references, product shots, scene keyframes, style explorations, background plates, virtual try-on, or image editing.
metadata:
    type: primitive
---

## When to use

Use `t2i` when the user wants a still image: concept art, product shots, character references, background plates, style samples, or any image that does not require motion.

Classify the job before writing the prompt:

- **Job A — Create from nothing**: full PLACE / FOCUS / FACTS / FORM / FORBIDDEN structure.
- **Job B — Modify one existing image**: EDIT / LOCK / NO / PHYSICS structure. One change per prompt.
- **Job C — Combine multiple images**: label every input by role (@Image1, @Image2…), then INSTRUCTION / PRESERVE / ADOPT / FORBIDDEN.

---

## Prompt structure (Job A)

### [PLACE]

Where the image physically exists. Be concrete — not "urban setting" but "east-facing corner of a 1970s laundromat, 6pm, winter."

- Geographic/architectural specificity, era, season, time of day, weather.
- State the ambient light source that would naturally exist here.
- Never: "urban," "modern," "atmospheric," "beautiful setting."

### [FOCUS]

One subject only. The single thing the eye lands on first.

- Person: specific physical anchors — jawline shape, eye color, brow weight, one distinguishing feature.
- Object: material, dimensions relative to surroundings, condition (new/worn/damaged).
- If anchoring to a reference: "Same person as @Image1. Maintain [list 3–4 specific traits]. Do not alter facial proportions, eye shape, or hairstyle."
- Never describe emotion. Describe the face that produces it.

### [FACTS]

Measurable physical details — the list that makes this image this image and not any other.

- **Clothing/materials**: fabric type, precise color name ("faded slate denim," not "blue jeans"), fit, visible wear.
- **Textures**: surface condition — scuffed heels, crazing on ceramic glaze, coffee ring on table, grime in corners.
- **Light sources**: named by type, direction, and quality — never by mood.
    - Bad: "cinematic lighting," "golden hour," "moody atmosphere," "beautiful light."
    - Good: "warm tungsten side-light from camera left," "practical lamp visible in frame casting a warm cone," "neon blue rim light at 2 o'clock," "overcast north-facing window at 9am," "single overhead bulb, one tube slightly dimmer, pale yellow cast."
- **Lens and capture**: camera model or equivalent (Sony A7R IV, 85mm prime), depth of field (f/1.8 shallow bokeh / f/8 sharp throughout), film stock if relevant (Kodak Portra 400 fine grain).
- **Imperfection anchor**: at least one real-world imperfection — "one flyaway hair strand," "coffee stain on cuff," "slight facial asymmetry," "paint worn where tyres have scuffed the kerb."

### [FORM]

Name the output artifact type explicitly:

- Editorial photo / reportage photography / fashion editorial / still life / food photography
- Product mockup / e-commerce render / architectural visualization
- Concept art panel / storyboard frame / illustrated poster

If style must transfer from a reference, decompose into three channels:

1. **Palette**: specific named colors, shadow treatment ("shadows: deep navy, never pure black").
2. **Edge treatment**: pixel edges, line weights, silhouette hardness (hard ink outline / soft photographic edge / vector-crisp).
3. **Silhouette language**: posing convention, proportional style.
   Never write "same style" — decompose it.

### [FORBIDDEN]

Never skip this slot. At least three specific entries.

- Secondary subjects: "No additional people. No extra hands."
- Face drift: "Preserve exact facial proportions, eye shape, and brow line."
- Background contamination: "No stock-photo backgrounds. No lens flares. No HDR treatment."
- Style contamination: "No over-sharpening. No plastic-looking skin. No neon colors."
- AI artifact tells: "No symmetry artifacts. No duplicate objects. No watermark-shaped artifacts."
- Anti-AI realism layer when photorealism is required: "2–3% film grain overlay. Slight facial asymmetry. Visible pore texture. One flyaway hair strand across the left eyebrow."

---

## Prompt structure (Job B — Edit)

```
EDIT    [Exactly what changes — one unambiguous sentence]
LOCK    [What must stay identical — face, pose, lens, lighting, background, layout, outfit, scale]
NO      [What must not appear or happen]
PHYSICS [Match these physical properties of the existing scene: shadow direction, contact shadows, grain, color balance, scale relationships]
```

One change per prompt. If EDIT needs more than one sentence, split into two separate prompts.

---

## Prompt structure (Job C — Composite)

```
@Image1 = [role: content subject — the person to place in the scene]
@Image2 = [role: style reference — color palette and edge treatment only]
@Image3 = [role: background environment — lighting and spatial geometry only]

INSTRUCTION: [What to do, referencing inputs by role]
PRESERVE FROM @Image1: [Specific traits that must survive the composite]
ADOPT FROM @Image2: [Exactly which style properties to transfer]
FORBIDDEN: [What must not appear]
```

---

## Model hints

- `gemini-3.1-flash-image`: **default** — fastest, best for drafts and variations.
- `gemini-3-pro-image`: highest quality; use for hero shots or final keyframes only when the user requests it.
- Always use the canvas default model unless the user explicitly requests otherwise.

---

## Common failures

- Vague subjects ("a nice scene") produce generic output — anchor to specific physical facts.
- Mood words ("cinematic," "stunning," "epic," "atmospheric") override the model's knowledge with noise — cut them.
- Conflicting medium cues ("photorealistic watercolor") confuse the model — pick one.
- Skipping FORBIDDEN lets the model hallucinate secondary subjects, extra limbs, and style drift.
- Aspect ratio shapes composition: portrait subjects → `9:16`, landscapes → `16:9`, product shots → `1:1`.
