---
name: storyboard
description: Cinematic storyboard generation. Produces a compact multi-panel storyboard sheet (16:9 image) with monochrome rough-sketch panels, a designed masthead, and a director strip animatic track board. Use for any sequence that needs a shot-by-shot visual breakdown — action, performance, cooking montage, fantasy, or any genre.
metadata:
    type: pattern
---

## Trigger condition

Use this pattern when the user asks to:

- "create a storyboard", "make a storyboard for [scene/sequence]"
- "storyboard this sequence", "draw a storyboard"
- "make a shot breakdown", "create panels for [scene]"
- "storyboard with [number] panels"

Do **not** use this pattern for a single scene image, a character reference sheet, or a standard concept-art keyframe. This pattern is strictly for producing a multi-panel storyboard sheet with a director strip.

---

## Workflow steps

A storyboard is planned as a **single `t2i` step** that generates a 16:9 storyboard sheet image.

### Case A — With character and/or environment reference images on the canvas

Use when the user provides reference images (character sheet, location, etc.) to lock visual identity.

- Wire reference images as `subject_ref` to the `t2i` node. The first image controls character identity; the second (if present) controls environment/location.
- `promptIntent` must follow the **Full Storyboard Template** below, filling in the `[REFERENCE PRIORITY]` section to describe which image controls what.

### Case B — Fully original storyboard (no reference images)

Use when the user describes the scene from scratch with no reference images.

- No `subject_ref` needed.
- `promptIntent` must follow the **Full Storyboard Template** below. Leave out `[REFERENCE PRIORITY]` or replace it with `No reference images provided. Invent all visual identities from the scene description.`

---

## Full Storyboard Template

Fill every placeholder in `[brackets]`. Invent anything the user has not specified. Panel count must match the `[SEQUENCE]` grid exactly.

```
Create a 16:9 image.

[PROJECT CARD]
Create a compact designed masthead, not a table.
TITLE: [SEQUENCE TITLE IN CAPS]
META LINE: [genre / style descriptor / rhythm — e.g. "nocturnal / sci-fi action / fast 15-second burst-cut edit"]
PRIORITY: [what the sequence must show clearly — key action, effect, prop, or character behavior]
MICRO BRIEF: [1-2 sentences: what the sequence is, who does what, and what the payoff is]

[CONTINUITY HEADER]
SEQUENCE ID: [TITLE-##P where ## is panel count]
REFERENCE PRIORITY: [Describe what each provided reference image controls, or "No reference images provided."]

[SCENE PACKET]
PREMISE: [1-3 sentences: who is doing what and why, in plain visual terms]
LOCATION: [specific physical location: architecture, surfaces, light sources, foreground/background landmarks, time of day]
START -> END: [describe the first panel state and the final panel state]
ACTION CHAIN: [comma-separated list of every beat in order, from first action to final payoff]
PROP / EFFECT STATE: [list every prop, effect, and FX rule — what exists, what changes, what is forbidden]
MUST READ: [one rule that overrides everything else — the creative intent or the constraint that must never break]

[CHARACTER SANITIZATION]
[C1]: [visible traits only — silhouette, outfit, hair, posture, props, emotional register. No backstory.]
[C2 if present]: [same format]
Remove contradictory traits, invisible psychology, excessive costume detail, and backstory that cannot appear in a panel.

[IDENTITY CONSISTENCY]
[State which reference controls which character or environment. List the specific costume and prop items that must stay locked across all panels. List forbidden redesigns.]

[STORYBOARD PURITY]
Panel images are visual-only low-detail monochrome light-gray rough sketches. Put panel numbers, beat names, and lens tags in the header strip outside each panel image. No color, labels, arrows, captions, subtitles, logos, watermarks, timing marks, diagrams, UI, ghost poses, duplicate bodies, or technical overlays inside panels.

[MASTER SHOT RULE]
[P01 or the first wide panel] shows full playable geography: [list every spatial element — character position, key props, landmarks, travel directions, foreground/background layers].

[EMOTIONAL ARC]
[Describe the emotional journey from first to last panel in terms of visible physical cues only: posture, hand tension, distance from camera, gaze, pace, spatial compression, physical contact.]

[STYLE LOCKS]
STYLE LOCK: clean monochrome rough-sketch storyboard panels on off-white paper, light-gray gesture lines, simplified [environment type] shapes, restrained [1-2 accent colors] only outside panel art, crisp cinematic hierarchy, no rendered panel lighting.
EFFECT LOCK: inside panels, [list the key effects] are simple monochrome bright shapes only; final video effect is [describe the in-video visual treatment].
ENVIRONMENT LOCK: [list the fixed spatial elements that must remain consistent across wide shots and master panels].

[SPATIAL CONTINUITY LOCK]
[List the panels that share the same geography, e.g. "P01, P05, P12 share the same clearing layout."] [Describe what C1 does across those panels and where they end up.] [Name what elements stay fixed.] [Name what is allowed to change: camera distance, pose, prop state, etc.]

[DIRECTOR STRIP]
Bottom animatic track board aligned to panel columns. Tracks: BEAT LINE, CAMERA PATH, ACTION PATH, RHYTHM TRACK, ESCALATION MAP, STATE TRACK, STYLE TRACK. Use shot chips, thin lines, rhythm blocks, small intensity bars, one-to-three-word labels. No seconds or timestamps.
RHYTHM TRACK format: `RHY P##: [hold|slow reveal|build|burst|impact|pause|recover|final hit] / [short block|medium block|long block] / [clean beat|match beat|smash beat|held beat|whip beat]`.
ESCALATION MAP format: `ESC P##: [L1 calm|L2 tension|L3 rise|L4 surge|L5 peak] / [flat|rise|spike|drop|release|unresolved]`.
PANEL HEADERS: [P01 / lens / Beat name -> P02 / lens / Beat name -> ... for every panel]
CAMERA + LENS PLAN: [P01 camera move -> P02 camera move -> ...]
ACTION PATH: [P01 C1 action -> P02 action -> ...]
RHYTHM TRACK: [P01 RHY P01: ... -> P02 RHY P02: ... -> ...]
ESCALATION MAP: [P01 ESC P01: ... -> P02 ESC P02: ... -> ...]
STATE TRACK: [P01 prop/character state -> P02 state -> ...]
STYLE TRACK: [P01 style chip -> P02 style chip -> ...]

[SEQUENCE]
Grid: [panel count] panels in a compact [columns x rows] cinematic storyboard sheet; panel artwork stays monochrome rough sketch while the director strip [describe how the strip shapes the pacing — e.g. "makes a 15-second sequence feel longer through two burst-cut clusters and a lake-energy final hold"].
```

---

## Panel count and grid guidelines

| Sequence length    | Panel count | Grid       |
| ------------------ | ----------- | ---------- |
| Short burst (≤10s) | 10–12       | 4×3 or 3×4 |
| Standard (10–20s)  | 14–18       | 4×4 or 3×6 |
| Extended (20–30s)  | 18–24       | 4×5 or 4×6 |

When the user specifies a panel count, use it exactly. When they do not, choose the grid that best fits the action chain length.

---

## Rhythm track and escalation map rules

- The **RHYTHM TRACK** describes editing rhythm, not camera movement. Match beat type to cut energy: `burst` = short sharp cut, `hold` = stationary camera, `impact` = physical hit or arrival.
- The **ESCALATION MAP** tracks dramatic tension. Every sequence must have at least one L5 peak and must resolve or release by the final panel.
- The opening panel can start at any level; the final panel should land at `release` or `held beat` to close the sequence.

---

## Common failures

- **Rendering finished concept art instead of rough sketches**: The panels must look like quick pencil gesture boards. If the output looks painted or polished, the model ignored the monochrome rough-sketch lock.
- **Color inside panels**: Accent colors (amber, teal, yellow, etc.) belong only in the masthead and director strip, never inside the panel artwork.
- **Labels and overlays inside panels**: Panel number, beat name, and lens tag go in the header strip above each panel. Nothing written inside the sketch area.
- **Director strip missing or collapsed**: The director strip is a required track board at the bottom of the sheet. It must be legible and aligned to the panel columns.
- **Spatial drift across wide panels**: Master-shot panels must share identical geography. If the craft moves or the clearing changes layout, the continuity lock has failed.
- **Mismatched panel count**: The grid in `[SEQUENCE]` must match the exact number of `PANEL HEADERS` entries.
