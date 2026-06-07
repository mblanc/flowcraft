---
name: i2v
description: Image-to-video generation. Animates a source image into a short video clip. Use when the user wants to bring a still image to life with motion, camera moves, or atmospheric effects.
metadata:
    type: primitive
---

## When to use

Use `i2v` when:

- The user wants to "animate" or "bring to life" an existing canvas image.
- A plan node needs to turn a keyframe into a clip (e.g. scene image → scene video).
- A `t2i` node in the same plan produces the source image (wire with a `depends_on` edge).

Always prefer `i2v` over `t2v` when a source image is available — the result will be visually consistent with the reference.

## Prompt conventions

The prompt for `i2v` describes the **motion and camera** applied to the source image. The subject's appearance is already fixed; do not redescribe it.

- **Camera move first**: "Slow dolly in", "Push back", "Aerial tilt down", "Handheld drift left".
- **Subject motion**: describe what moves and how — "leaves rustling gently", "eyes slowly blink", "smoke rises and disperses".
- **Atmosphere**: lighting changes, weather, particle effects that add life — "warm golden light fades to dusk".
- **Pacing**: match duration to motion complexity. 4s for subtle atmosphere; 6–8s for camera moves or multi-beat action.
- **Keep it under 10 seconds**: split longer sequences into multiple nodes with `concat`.

## Model hints

- `veo-3.1-fast-generate-001`: fastest iteration.
- `veo-3.1-generate-001`: highest quality motion and consistency.
- Default to fast for planning drafts; upgrade to standard for final output.

## Common failures

- Describing subject appearance again often conflicts with the source image — stick to motion only.
- Contradictory motion verbs ("pan left while tracking right") confuse the model.
- Very short duration (4s) with complex multi-step action loses beats — use 6s or 8s.
- If the source image has busy detail, strong camera moves can cause flickering; prefer subtle moves.
