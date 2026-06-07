---
name: t2s
description: Text-to-speech generation. Converts a text script into a spoken-word audio file. Use for narration, voiceover, dialogue, and any plan node requiring a human voice track.
metadata:
    type: primitive
---

## When to use

Use `t2s` when:

- The user requests narration, voiceover, or dialogue for a video.
- A plan includes a story or documentary-style sequence that needs a voice track.
- The promptIntent references a specific speaker voice, tone, or language.

## Prompt conventions

The prompt for `t2s` is the **verbatim script** to be spoken, plus speaker direction.

- **Script first**: the exact words the voice should say.
- **Voice direction** (append after script): pace, tone, accent — "warm and conversational", "slow and authoritative", "excited and energetic".
- **Pauses**: use ellipses (...) or explicit `[pause]` markers for breath breaks.
- **Pronunciation guides**: for unusual names or terms, add phonetic hints in brackets — "Chloé [kloh-AY]".

## Model hints

- This operation is architecturally planned but the executor is not yet wired. The node will be created in the plan; execution will require a speech model integration.

## Common failures

- Very long scripts (>60 seconds) may truncate. Split into multiple `t2s` nodes for long-form narration.
- Emotional direction baked into the script text ("said angrily") is less reliable than explicit voice direction after the script.
