---
name: music-generation
description: Music generation. Produces a music clip from a text prompt using Lyria. Use for background scores, mood pieces, jingles, underscore tracks, or any plan node requiring generated audio.
metadata:
    type: primitive
---

## When to use

Use `t2m` when:

- The user requests a music track, score, jingle, or background audio.
- A plan needs an audio layer to accompany video or image content.
- The promptIntent references a mood, genre, or musical style.

---

## Prompt structure

Every music prompt must specify four core dimensions. Omitting any dimension lets the model guess, producing generic or mismatched output.

```
[GENRE & STYLE] [MOOD & EMOTION] [INSTRUMENTATION] [TEMPO & ENERGY]
[SONG STRUCTURE] [PRODUCTION QUALITY]
[VOCALS or "instrumental"]
[NEGATIVE PROMPT (optional)]
```

---

## Core dimensions

### [GENRE & STYLE]

Name the genre explicitly. Compound genres are valid and often preferred.

- **Good:** "cinematic orchestral," "lo-fi hip-hop," "upbeat Latin pop," "dark ambient electronic," "classic jazz trio," "progressive rock," "blues-influenced R&B"
- **Bad:** "nice music," "background music," "something cool"

Sub-genre precision improves output — "new-wave synth-pop" is better than "electronic."

### [MOOD & EMOTION]

Use concrete emotional descriptors rather than vague adjectives.

- **Good:** "melancholic and introspective," "triumphant and soaring," "tense and suspenseful," "playful and whimsical," "nostalgic and warm"
- **Bad:** "good vibes," "emotional," "powerful"

Pair moods when appropriate: "bittersweet yet hopeful."

### [INSTRUMENTATION]

Name specific instruments. Generic terms ("guitar," "strings") are weaker than specific ones.

- **Good:** "fingerpicked acoustic guitar, upright bass, brushed snare, Fender Rhodes," "sweeping string section with solo violin, French horns, and orchestral timpani," "808 bass, trap hi-hats, atmospheric pad synths, and sampled piano"
- **Bad:** "guitars and drums," "orchestra"

Always specify the lead instrument — it anchors the texture: "lead: solo cello."

### [TEMPO & ENERGY]

Provide BPM when precision matters; use descriptive terms otherwise.

- **Numeric:** "120 BPM," "72 BPM ballad tempo," "180 BPM drum and bass"
- **Descriptive:** "slow and meditative," "mid-tempo groove," "driving and relentless," "rubato, free-flowing tempo"

Always pair tempo with an energy word: "slow (40 BPM), sparse and sparse" or "fast (140 BPM), energetic and propulsive."

### [SONG STRUCTURE]

Optional but powerful for controlling dynamics and arc. Use only when the user has a narrative intent.

- "Builds from sparse intro → full chorus → stripped-down outro."
- "Repeating two-bar loop, no variation — suitable for seamless looping."
- "Verse-chorus-verse structure with a key change on the final chorus."
- "Single sustained ambient texture, no structural variation."

For clips (30s default model), one dynamic arc is the maximum — do not plan full song structures.

### [PRODUCTION QUALITY]

Sets the sonic aesthetic.

- "studio-quality, polished mix, wide stereo field"
- "lo-fi, warm tape saturation, slight vinyl crackle"
- "raw live recording, room ambience, natural reverb"
- "cinematic, large-room reverb, IMAX-scale dynamics"
- "intimate, close-mic'd, dry acoustic"

### [VOCALS]

Always declare explicitly.

- **No vocals:** Add `"instrumental"` as a standalone keyword — always include this when vocals are not wanted.
- **With vocals:** Describe style, not lyrics: "wordless female vocal harmonies," "deep baritone spoken word," "layered gospel choir," "distorted punk vocals."
- **Lyrics:** Wrap in quotes: `vocals singing: "Rise up and take the stage."`

---

## Negative prompts

Use `negative_prompt` to exclude specific elements. Be precise — model-level exclusions, not abstract moods.

| Want to avoid        | Negative prompt value                        |
| -------------------- | -------------------------------------------- |
| All vocals           | `"vocals, singing, choir, spoken word"`      |
| Percussion           | `"drums, kick, snare, hi-hat, percussion"`   |
| Distortion           | `"distorted guitar, fuzz, overdrive, noise"` |
| Specific instruments | `"violin, piano, brass"`                     |
| Bass frequencies     | `"bass guitar, sub-bass, 808"`               |
| Genre bleed          | `"jazz, hip-hop, electronic"`                |

Do not use mood words in negative prompts — `"sad"`, `"boring"`, `"cheap"` have no effect.

---

## Timestamp prompting

For dynamic genre or mood shifts within a clip, use `[mm:ss]` markers in the prompt. Only available for longer clips (lyria-3-pro-preview).

```
[0:00] Sparse piano intro, slow and contemplative, 60 BPM.
[0:15] Full orchestral swell enters — strings, brass, timpani.
[0:45] Returns to solo piano, fading out.
```

Rules:

- Timestamps must be in `[mm:ss]` format.
- Minimum 15 seconds between transitions.
- Maximum 3–4 transition points per clip to avoid incoherence.
- Each section must still specify genre, mood, and instrumentation.

---

## Model selection

| Model                  | Duration    | Best for                                              |
| ---------------------- | ----------- | ----------------------------------------------------- |
| `lyria-3-clip-preview` | ~30s        | Default. Loops, stingers, short background pieces.    |
| `lyria-3-pro-preview`  | up to ~3min | Full tracks, complex structures, timestamp prompting. |

Always use `lyria-3-clip-preview` unless the user explicitly needs a longer track or timestamp-based structure.

---

## Full prompt examples

**Background underscore for a product video:**

```
Upbeat corporate pop. Optimistic and forward-moving. Instrumentation: electric piano, clean electric guitar, light synth pads, punchy kick and snare. 118 BPM. Builds from sparse verse to full chorus at 0:15. Studio quality, polished mix. Instrumental.
```

**Suspense cue for a horror sequence:**

```
Dark cinematic orchestral. Tense, dread-building. Lead: low string ostinato with dissonant brass stabs. Sparse, irregular percussion. 60 BPM rubato. No melody — sustained atmospheric texture. Large-room reverb. Instrumental.
Negative prompt: piano, acoustic guitar, major key, bright tones.
```

**Lo-fi study track:**

```
Lo-fi hip-hop. Melancholic and cozy. Instrumentation: Fender Rhodes, vinyl-sampled double bass, brushed jazz drums, atmospheric pad. 85 BPM. Loopable, no structural variation. Warm tape saturation, vinyl crackle. Instrumental.
```

**Cinematic epic with vocals:**

```
Cinematic epic orchestral. Triumphant and emotionally charged. Full orchestra: soaring strings, French horns, choir, orchestral percussion. 120 BPM, driving. Builds through verse to massive final chorus. Studio quality, IMAX-scale dynamics. Wordless female and male choir.
```

---

## Common failures

- Omitting "instrumental" when no vocals are wanted — the model often adds them by default.
- Using a single-word genre ("rock") without mood or instrumentation — produces a generic, unfocused result.
- Specifying lyrics without using the `vocals singing:` format — lyrics may appear as narration instead.
- Using mood words in `negative_prompt` — only instrument and genre terms have effect.
- Requesting complex song structure on a 30s clip — use `lyria-3-pro-preview` and timestamp prompting.
- Stacking more than 4 timestamp transitions — causes abrupt, incoherent transitions.
