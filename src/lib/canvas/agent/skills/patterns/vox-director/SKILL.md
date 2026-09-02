---
name: vox-director
description: >
    Turn any topic into a finished Vox-style paper-collage explainer or ad video. Generates beat map, paper-collage keyframe posters with headline text, living poster motion clips, beat narration speech tracks, and background music. Triggers on "vox video", "paper collage video", "motion collage", "collage explainer", "make a collage ad", "turn this topic into a collage video", or /vox-director.
metadata:
    type: pattern
---

## Trigger Condition

Use this pattern skill whenever the user asks to:

- "make a Vox video", "vox style video", "create a Vox explainer"
- "paper collage video", "motion collage", "scrapbook tribute"
- "make a collage ad", "turn [topic] into a paper collage video"
- `/vox-director`

---

## Workflow Steps

When triggered, the Director Agent operates in two phases:

### Phase 1 — Proposed Beat Map & Creative Direction in Chat

1. **Pick Narrative Arc (`arc`)**: Select a story structure from `references/beat-layer.md` matching the topic (`timeline`, `pas`, `bab`, `how_it_works`, `man_in_hole`).
2. **Read Active Canvas Style (`activeStyle`) or Pick Theme Preset (`theme`)**: Use the canvas `STYLE.md` if present, or pick a visual theme preset from `references/prompt-guide.md` (`american-retro`, `swiss-modern`, `punk-zine`, `soviet-constructivist`, `70s-groovy`, `wpa-propaganda`).
3. **Draft Beat Map**: Break topic into $N$ beats (default 4 beats for 30s film; 6 beats for 60s film). Each beat contains:
    - Beat title & narration script (8–10s per beat).
    - **2 shots per beat** (Shot `a`: wide establishing poster with cut-out headline text + primary camera move; Shot `b`: detail close-up cut-in without headline text + secondary camera move).
4. Present the proposed beat map and narration script to the user in the chat response.

### Phase 2 — Plan Production Tool (`planProductionTool`)

Construct a multi-step `ProductionPlan` DAG containing:

1. **Audio Track**:
    - `t2s` (Text-to-Speech) node for each beat narration script. Set model to `gemini-3.1-flash-tts-preview`.
    - `music` (Background Music) node for global soundtrack. Set model to `lyria-3-clip-preview` with prompt matching the theme tone.

2. **Visual Track (DAG per shot)**:
    - For each beat $i$ ($1 \le i \le N$):
        - **Shot $i_a$ (Wide Keyframe)**: `t2i` node with `promptIntent` starting with `"VOX PAPER COLLAGE KEYFRAME POSTER:"` including 5-part Vox prompt parameters (medium, era/style, color palette, cut-out headline text, finish).
        - **Shot $i_a$ (Motion Clip)**: `i2v` node with `depends_on: [Shot i_a Keyframe ID]` specifying camera move (`push_in`, `pan`, `pull_out`) and rich element motion.
        - **Shot $i_b$ (Detail Keyframe)**: `t2i` node for close-up detail without headline text.
        - **Shot $i_b$ (Motion Clip)**: `i2v` node with `depends_on: [Shot i_b Keyframe ID]` specifying secondary camera move (`parallax`, `tilt`, `static`) and detail element motion.

---

## 5-Part Keyframe Prompt Rules (`t2i`)

Every keyframe poster `promptIntent` must incorporate the 5 core Vox elements:

1. **Medium**: Hand-cut paper collage, torn paper edges, tape strips, halftone dot overlays, newspaper clippings.
2. **Era / Theme**: Active Canvas `STYLE.md` tokens or selected theme preset (`american-retro`, `swiss-modern`, `punk-zine`, etc.).
3. **Color Palette**: Flat background color block per beat (earthy clay tan, vivid mustard yellow, matte dark navy).
4. **Typography**: Big bold cut-out newspaper headline text in ALL CAPS (only on wide shot `a`, omit on detail shot `b`).
5. **Finish**: Paper grain, printmaker ink texture, flat lighting.

---

## Shot Rhythm & Motion Constraints (`i2v`)

- **Cadence Rule**: Never use a single long shot for an 8–10s beat. Always split into 2 shots of 3–5 seconds duration (wide + detail cut-in).
- **Camera Move Rule**: Vary camera movement across adjacent beats (`push_in` $\to$ `parallax` $\to$ `pan` $\to$ `static`). Never repeat identical camera moves consecutively.
- **Element Motion Rule**: Describe active multi-element movement (e.g. _"merchants gesture, paper plane glides across frame, coins scatter"_).
