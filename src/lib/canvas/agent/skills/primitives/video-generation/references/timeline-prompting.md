---
name: timeline-prompting
description: Canonical prompt format and rules for timeline-prompting (timestamp-prompting) for Gemini Omni. Loaded automatically by the PromptEngineer alongside the main SKILL.md.
---

## Special Case: Timeline / Timestamp Prompting

If the generation intent specifies a timeline video (phrases like "timeline", "timestamp", "multi-beat", "sequence", or contains multiple timestamp blocks like `[0s-3s]`), **do not use the standard video prompt structure**. Instead, follow these timeline rules:

### 1. Timeline Format

Structure the prompt as a continuous text block where each timestamp beat is enclosed in square brackets:

```
[Start_s–End_s]: [Visuals / Action description] — [Camera movement and lens details]. Audio: [Ambient sound layers] / [Sound effects] / [Dialogue].
```

Ensure timestamps are sequential, non-overlapping, and contiguous (e.g. `[0s–3s]` then `[3s–7s]` then `[7s–10s]`).

### 2. Formatting Rules

1. **Duration Check:** The segment times must sum up to the total video target duration (e.g. 15s max).
2. **Kinetic Force Verbs:** Describe actions with active kinetic force verbs (`strides`, `slides`, `snaps`, `grabs`, `twirls`, `pockets`) instead of weightless defaults (`walks`, `moves`, `takes`).
3. **Camera Rule:** Use exactly **one** camera move/lens per segment. Never combine panning, zooming, and tracking simultaneously.
4. **Dialogue Rules:**
    - Under 8 seconds per speaking segment.
    - Dialogue must be enclosed in double quotes.
    - Always append `(no subtitles)` to dialogue blocks to prevent burnt-in text.
    - Example: `Audio: He says in a low voice: "We must leave now." (no subtitles)`
5. **Asset Reference Check:** If starting from a canvas image/frame or referencing other nodes, use `@Image1`, `@Video1` tags.

### 3. Audio / Dialogue Syncing

Specify all dialogue, music, or room tone directly in each segment's `Audio:` section:

- Use double quotes for dialogue: `Audio: She says: "Hello there." (no subtitles)`
- Specify SFX and relative decibel levels: `Audio: SFX: heavy door slam at 11s | ambient wind howling at -15dB.`

### 4. Continuous Flow & Transitions

Ensure smooth flow between timestamps without explicit transition words unless requested.
