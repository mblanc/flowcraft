Recipe: Short Film / Ad with Full Consistency

The meta-insight from every practitioner who's shipped real work: 80% of consistency is pre-production, 20% is generation. The generation phase is
the easy part.

---

Phase 1 — Narrative Lock (before anything else)

- Script first. Use Claude as a writer's room — workshop plot structure, character arcs, scene sequence. Output a proper shot list.
- Figma Scene Cards. One card per shot: scene name, required characters, location, shot type, action beat. This is your tracker and tells you exactly
  which assets to build.

---

Phase 2 — Asset Library (build before you generate any video)

Character Sheets (every principal + extra type)

Three levels of depth, pick the one matching your fidelity requirements:

Basic (Olivio Sarikas):
photorealism, Character sheet, three-view, full figure only, white background, 6 square samples on the right side

Cinema-grade (GPT Image 2): Add psychological profile, performance direction (micro-expressions, body language tendencies), strict turnaround views
(front / 3/4 / side / back / 3/4 back), head study in 6 expressions, cinematic portrait at 85mm — composition intentionally asymmetrical (not
auto-grid).

Then always generate separately:

- Face close-up — the single most important consistency asset
- Detail sheet: photorealism, sample sheet 2x3 of teeth, nose, eye, hair, skin, ear — reference with @teeth, @hair, etc. per scene

For animation/motion: generate a movement sheet (GPT Image 2 → NB2 Pro: keep @img1 structure, but the animatic now [action] in [N] phases) — use both
the sheet AND the original character image as dual references.

Location Bibles

1. Generate a single master image of each location
2. NB2 Pro: generate 5 distinct angles including the difficult back view
3. Stitch into a location reference sheet

Props / Extras

Every hero prop and recurring extra type gets its own sheet at this stage.

---

Phase 3 — Storyboard First (cuts failure rates in half)

Generate a 3×3 storyboard grid (GPT Image 2 preferred — native Thinking Mode reasons through composition before rendering). Feed this grid as a
reference image when generating shots.

Alternative: Visual Production Graph — treat the video as a single structured reference image covering shot composition, motion intent, and scene
context all at once.

---

Phase 4 — Video Generation

The 2026 rule: I2V, not T2V. If a shot has a named character, product, or brand — start from an image. Always. Text-to-video for those shots will
drift.

Dominant pipeline:
Claude (optimize prompt) → NB2 (generate first frame) → Veo 3.1 or Kling 3.0 (animate)

Model routing:

┌──────────────────────────────────────────────────────┬─────────────────────────┐
│ Shot type │ Model │
├──────────────────────────────────────────────────────┼─────────────────────────┤
│ All-around + native audio │ Veo 3.1 │
├──────────────────────────────────────────────────────┼─────────────────────────┤
│ Dialogue + lip-sync │ Kling 3.0 Omni │
├──────────────────────────────────────────────────────┼─────────────────────────┤
│ Multi-reference (up to 9 images + 3 clips + 3 audio) │ Seedance 2.0 │
├──────────────────────────────────────────────────────┼─────────────────────────┤
│ Sequence continuity (next shot references previous) │ Kling O1 │
├──────────────────────────────────────────────────────┼─────────────────────────┤
│ First + last frame defined │ Veo 3.1 Frames-to-Video │
└──────────────────────────────────────────────────────┴─────────────────────────┘

Prompt structure per shot:

- Subject (match character sheet exactly, not "a woman")
- Location + time of day
- One dominant force verb (push, slam, drift, recoil — not "walk")
- Physical camera description: "Steadicam push-in on 35mm lens" — never "cinematic"
- Named light sources: "motivated by practical lamp at frame left"
- Audio note (separate sentence if using native audio)

Iteration: use fast/cheap tiers to lock concept first; only high-quality regeneration when you have a clip worth keeping.

---

Phase 5 — Audio

- Native audio: Veo 3.1, Kling 3.0 Omni, Seedance 2.0 all produce synchronized dialogue + ambient + music in one pass. Use for most UGC/social work.
- Structured TTS (Gemini 3.1 Flash): For VO, prompt in 5 sections: Audio Profile → Scene → Director's Notes → Sample Context → Transcript. Inline
  tags: [whispers], [sarcastically]. Post-process with ElevenLabs V3 + CapCut normalization.

---

Phase 6 — Post-Processing

1. Add 2–3% film grain — single highest-impact step
2. 1080p export, not 4K — 4K AI video looks sharper than real footage, triggers uncanny valley
3. LUT pass to unify color temperature across clips from different models
4. Light background noise under VO
5. C2PA metadata — non-negotiable for published ad/media content in 2026

---

Minimal Viable Recipe (30-second ad, 2–4 hours)

Script (Claude, 5 shots) → character sheet (GPT Image 2, 1 per character + face close-up) → location master (NB2, 3 angles) → storyboard (GPT Image
2, 3×3) → NB2 first frame per shot → Veo 3.1 animate → Kling for dialogue shots → native audio → film grain + 1080p export.
