---
name: cinematography
description: Cinematography vocabulary for shot framing, camera angles, subject relationship, and camera movement. Load when the user's request involves shot-type choices or when constructing ask_user options for framing/movement settings.
metadata:
    type: primitive
---

## When to load

Load this skill when:

- The user's request is cinematography-ambiguous (e.g. "a shot of a mountain", "film the character walking") and you need to propose framing or movement options via `ask_user`.
- The `promptIntent` for an image or video node requires precise shot-type or movement vocabulary.
- A pattern skill (e.g. storyboard, long-video) asks you to specify shot types per cut.

The full vocabulary is split across seven reference files loaded automatically alongside this skill:

- See `references/framing.md` — subject size (ECU → EWS)
- See `references/camera-angles.md` — lens height and tilt angle
- See `references/subject-relationship.md` — number of subjects, POV, OTS, inserts
- See `references/camera-movement.md` — movement type (video only)
- See `references/lighting.md` — light source types, setups, direction, quality, color temperature, time-of-day conditions
- See `references/lens-optics.md` — focal length, aperture, depth of field, bokeh, lens types, optical effects, camera bodies
- See `references/color-grading.md` — named looks, shadow/highlight treatment, saturation, film stock emulations, era and genre palettes

---

## Prompt vocabulary rules

Combine framing + angle + movement into a single cinematography phrase per node:

- "ECU on her eyes, eye-level, static tripod."
- "Wide shot, low angle, slow dolly in over 6 seconds."
- "OTS two-shot at medium distance, handheld, slight drift."
- "Aerial bird's-eye view, drone shot pulling back to reveal the coastline."
- "Dutch angle medium shot, static, subject centered."

Never use vague cinema words — "cinematic", "dramatic", "epic", "beautiful framing" produce inconsistent results. Always name the specific shot type and movement from the reference tables.

---

## ask_user option guidelines

Surface the 3–5 most relevant options for the described scene. Do not list all types. Use this reasoning:

| Scene type                      | Recommend                             |
| ------------------------------- | ------------------------------------- |
| Portrait / character focus      | CU, MCU, MS, full shot                |
| Action / motion sequence        | Wide shot, cowboy shot, tracking shot |
| Location reveal / scene opening | Establishing shot, EWS, aerial        |
| Dialogue / conversation         | OTS, two-shot, MCU                    |
| Subjective / immersive          | POV, handheld, eye-level              |
| Power / drama                   | Low angle, dutch angle, crane shot    |

Option label format: `"[Shot type] — [one-line visual description]"`
Example: `"Close-up — face fills the frame, full emotional detail"`
