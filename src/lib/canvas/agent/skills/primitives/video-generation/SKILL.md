---
name: video-generation
description: Video generation. Animates a source image into a short video clip, or generates video from text. Use for any output that requires motion — bringing images to life, camera moves, atmospheric animation, or full scene videos.
metadata:
    type: primitive
---

## When to use

Use `i2v` when:

- The user wants to "animate" or "bring to life" an existing canvas image.
- A plan node turns a keyframe into a clip (e.g. scene image → scene video).
- A `t2i` node in the same plan produces the source frame (wire with a `depends_on` edge).

Always prefer `i2v` over `t2v` when a source image is available — it will be visually consistent with the reference.

---

## Prompt structure

The source image fixes the subject's appearance. The prompt describes only what changes: motion, camera, light shifts, atmosphere. Never redescribe the subject.

### [ACTION]

One verb. One motion arc. That is the entire action budget.

- Bad: "She walks over, turns around, and smiles at the camera."
- Good: "She turns slowly toward the lens."
- Add 1–2 micro-motions that support the main action: "fabric shifts at the shoulder," "steam rises from the cup," "hair catches the light."
- Use force verbs — avoid weightless defaults:
    - "walks" → "pushes through"
    - "looks at" → "snaps attention toward"
    - "runs" → "charges forward"

### [CAMERA]

One camera move + one rhythm word. Never combine two moves — it causes jitter.

Move options: slow push-in / static tripod / horizontal pan / gradual orbit / handheld shoulder-cam / rack focus / dolly pull-back / crash zoom / whip pan

Rhythm words: gradual, gentle, smooth, abrupt, sharp, fluid

Example: "Gradual dolly push-in." or "Static tripod shot, no movement."

### [ENVIRONMENT & LIGHTING]

Name every light source by type — never by mood.

- Bad: "cinematic lighting," "golden hour," "moody atmosphere," "beautiful light."
- Good: "warm tungsten side-light from the left," "motivated lighting — practical lamp visible in frame," "neon blue rim light," "overcast north-facing window light," "sodium-vapour street lamp at 2 o'clock."

Describe atmospheric changes if they evolve over the clip: "warm golden light fades to cooler dusk tone over 6 seconds."

Add realism anchors when photorealism is required: "Fine 35mm film grain. 2% camera shake in the first 1–2 seconds."

### [AUDIO]

Always specify. Silent defaults produce random results.

- Dialogue (in quotes): `She says: "I've been thinking about this for weeks."`
- Ambient layer: "coffee shop murmur at low volume," "room tone at -28dB," "ocean wind."
- Sound effects: "ceramic cup placed on wooden table," "fabric rustle on camera pickup," "distant thunder."
- Music: "slow minor key acoustic guitar," "no music."
- Silence: "No dialogue. No music. Room tone only."

### [CONSTRAINTS]

Positive phrasing only — write what you want, not what you don't.

- "Stable picture throughout."
- "Maintain outfit continuity."
- "Sharp focus on subject. Background softly defocused."
- "Consistent facial proportions throughout."
- "No morphing. No identity drift." → rephrase as: "Subject appearance stays identical to the source image throughout."

Anti-AI detection layer when realism matters:

- "2–3% film grain overlay."
- "2% camera shake in the first 1–2 seconds."
- "Slight facial asymmetry maintained from source."

### [QUALITY SUFFIX]

Append to every prompt without exception:
`4K. Ultra HD. Rich details. Sharp clarity. Cinematic texture. Natural colors. Stable picture.`

---

## Duration

MUST be exactly 4, 6, or 8 seconds — no other values.

- **4s**: subtle atmosphere, minimal motion, single beat.
- **6s**: one camera move or moderate subject motion.
- **8s**: multi-beat action, evolving lighting, or complex camera arc.

For sequences longer than 8 seconds, split into multiple nodes connected with `concat`.

---

## Model hints

- `veo-3.1-lite-generate-001`: **default** — best balance of quality and speed.
- `veo-3.1-generate-001`: highest quality motion and consistency; use for hero shots or final output.
- Use the canvas default model unless the user explicitly requests otherwise.

---

## Common failures

- Redescribing subject appearance conflicts with the source image — describe motion only.
- Two camera moves in one prompt ("pan left while tracking right") causes jitter in every model.
- Short duration (4s) with complex multi-step action loses beats — use 6s or 8s.
- Busy source images + strong camera moves cause flickering — prefer subtle moves or static tripod.
- Omitting audio leaves the model to hallucinate sound — always specify, even if the choice is silence.
- **Connecting Audio Nodes:** Connecting a separate audio/music node (`t2m`, `t2s`) to a video node as a reference or dependency is invalid. The video model cannot take audio files as inputs; it only generates audio from the text prompt. Never wire edges from audio nodes to video nodes.
