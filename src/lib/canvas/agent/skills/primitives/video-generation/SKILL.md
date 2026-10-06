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

- **Gemini Omni Models (`gemini-omni-1.1-flash-preview`, `gemini-omni-flash-preview`)**: Default is Auto (leave duration unset / no parameter passed). When omitted, the model automatically selects the optimal natural duration (or matches the source video timing in video editing/transforms). Only pass an explicit duration (3 to 10 seconds) if the user requested a specific duration.
- **Veo Models (`veo-3.1-*`)**: Duration is configured via parameter and MUST be 4, 6, or 8 seconds (default 4s).

- **3–4s**: subtle atmosphere, minimal motion, single beat.
- **5–6s**: one camera move or moderate subject motion.
- **7–10s**: multi-beat action, evolving lighting, or complex camera arc.

For single-shot sequences longer than 10 seconds, split into multiple nodes connected with `concat`.

---

## Aspect Ratio

- **Gemini Omni Models (`gemini-omni-1.1-flash-preview`, `gemini-omni-flash-preview`)**: Default is Auto (leave aspect ratio unset / no parameter passed). When omitted, the model naturally infers the aspect ratio from the source image/video (e.g. during `i2v` or video editing) or selects natural proportions. Only pass an explicit aspect ratio ("16:9" or "9:16") for new generations (`t2v`, `i2v`) if specifically requested. Note: for video editing tasks (editing an existing video or video-to-video), Omni models do not support setting `aspect_ratio` in the response format — the model always preserves the source video's aspect ratio.
- **Veo Models (`veo-3.1-*`)**: Defaults to "16:9" ("16:9" or "9:16").

---

## Model hints

- `gemini-omni-1.1-flash-preview`: **default** — best for general video generation, defaults to Auto duration (3-10s optional) and Auto aspect ratio (16:9, 9:16 optional), resolutions (360p, 720p, 1080p, 4K), first/last frame interpolation (`i2v2`), and stateful conversational editing (audio reference inputs/mixing are NOT supported).
- `veo-3.1-lite-generate-001`: best balance of quality and speed for Veo model family.
- `veo-3.1-generate-001`: highest quality motion and consistency; use for hero shots or final output.
- `gemini-omni-flash-preview`: legacy Omni 1.0 (720p fixed).
- Use the canvas default model unless the user explicitly requests otherwise.

---

## Common failures

- Redescribing subject appearance conflicts with the source image — describe motion only.
- Two camera moves in one prompt ("pan left while tracking right") causes jitter in every model.
- Short duration (4s) with complex multi-step action loses beats — use 6s or 8s.
- Busy source images + strong camera moves cause flickering — prefer subtle moves or static tripod.
- Omitting audio leaves the model to hallucinate sound — always specify, even if the choice is silence.
- **Connecting Audio Nodes:** Connecting a separate audio/music node (`t2m`, `t2s`) as a reference/dependency to a video node is not supported for any model, including `gemini-omni-1.1-flash-preview`.
- **Stateful Video Editing (Omni):** The default model 'gemini-omni-1.1-flash-preview' supports stateful editing! To edit an existing video (e.g. 'make it faster', 'change the style', 'add a character'), draw a 'depends_on' edge from the previous video node to the new video node. The engine will propagate the interaction state for seamless editing.
