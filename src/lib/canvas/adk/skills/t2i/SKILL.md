---
name: t2i
description: Text-to-image generation. Transforms a natural language description into a single still image. Best for creating reference images, scene keyframes, character sheets, and style explorations.
metadata:
    type: primitive
---

## When to use

Use `t2i` when the user wants a still image from a text description, including: concept art, product shots, character references, background plates, style samples, or any image that does not require motion.

## Prompt conventions

- **Subject first**: lead with the main subject (who or what), then context, then style.
- **Be specific about medium**: specify "photorealistic", "oil painting", "digital art", "3D render", etc.
- **Camera and composition**: include lens and framing cues — "close-up", "wide establishing shot", "bird's eye view", "85mm portrait".
- **Lighting**: name the light — "golden hour", "overcast diffused", "neon-lit", "studio three-point".
- **Mood/atmosphere**: one adjective cluster works best — "moody and cinematic", "clean and minimal", "vibrant and punchy".
- **Negative space**: if the canvas has an active style guide with negative constraints, reflect them at the end of the prompt.

## Model hints

- `gemini-3.1-flash-image`: fastest, best for drafts and variations.
- `gemini-3-pro-image`: highest quality, use for hero shots or final keyframes.
- Default to `gemini-3.1-flash-image` unless the user requests quality.

## Common failures

- Vague subjects ("a nice scene") produce generic output. Push the promptIntent to a specific, concrete description.
- Conflicting style cues ("photorealistic watercolor") confuse the model. Pick one medium.
- Aspect ratio affects composition: portrait subjects should use `9:16`, landscapes `16:9`, product shots often `1:1`.
