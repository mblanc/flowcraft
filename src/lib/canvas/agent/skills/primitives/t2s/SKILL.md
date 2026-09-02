---
name: t2s
description: Text-to-speech generation. Converts a text script into spoken speech narration or voiceover using Gemini TTS (gemini-3.1-flash-tts-preview). Use for voiceovers, speech narration, spoken dialogue, and reading text aloud.
metadata:
    type: primitive
---

## When to use

Use `t2s` when:

- The user requests narration, voiceover, speech, or dialogue for a video or canvas scene.
- A plan includes a story, documentary, or explainer that needs a spoken voice track.
- The promptIntent references a specific speaker voice, tone, or script.

## Prompt conventions

The prompt for `t2s` is the **verbatim script** to be spoken, plus speaker direction.

- **Script first**: the exact words the voice should say.
- **Voice direction** (append after script): pace, tone, accent — "warm and conversational", "slow and authoritative", "excited and energetic".
- **Voice parameter**: optional prebuilt voice name — `Puck`, `Charon`, `Kore`, `Fenrir`, `Aoede`.
- **Pauses**: use ellipses (...) or explicit `[pause]` markers for breath breaks.
- **Pronunciation guides**: for unusual names or terms, add phonetic hints in brackets — "Chloé [kloh-AY]".

## Model hints

- Fully wired using Gemini TTS model (`gemini-3.1-flash-tts-preview`). Supports voice parameter selection.

## Common failures

- Very long scripts (>60 seconds or >5000 characters) will be rejected. Split into multiple `t2s` nodes for long-form narration.
- Using `t2m` or Lyria for speech — `t2m` is strictly for instrumental music; ALWAYS use `t2s` for voiceover/speech.
