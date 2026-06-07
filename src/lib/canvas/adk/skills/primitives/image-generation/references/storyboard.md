---
name: storyboard
description: Canonical prompt rules for STORYBOARD image generation. Loaded automatically by the PromptEngineer alongside the main SKILL.md when the intent targets a storyboard sheet.
---

## Special Case: Storyboard Sheets

If the generation intent specifies a storyboard (phrases like "storyboard", "panel sheet", "[N] panels", "director strip", "SEQUENCE ID", or starts with "Create a 16:9 image." followed by a `[PROJECT CARD]` block), **do not use the standard GENERAL DESCRIPTION + STRUCTURED FEATURES format**. Instead, output the intent as-is — the Director has already structured it using the correct storyboard template. Your role is to:

1. Verify the intent contains the required sections: `[PROJECT CARD]`, `[SCENE PACKET]`, `[STORYBOARD PURITY]`, `[DIRECTOR STRIP]`, `[SEQUENCE]`.
2. If any required section is missing, add it verbatim from the canonical fragments below.
3. If a reference image is mentioned (e.g., `@Image1`), confirm it appears in the `[CONTINUITY HEADER]` REFERENCE PRIORITY line.
4. Append at the end:
    ```
    FORBIDDEN: No color inside panel artwork. No labels, arrows, or captions inside panels. No finished concept-art rendering inside panels. No watermarks, logos, or timing marks. No ghost poses or duplicate bodies in any panel. No symmetry artifacts in sketched figures. No director strip missing or collapsed into a single row.
    ```
5. Output the final prompt block with no extra preamble, headers, or markdown.

**Exception to the "no mood words" rule**: storyboard prompts intentionally use descriptors like `cinematic`, `monochrome`, `off-white`, `burst-cut`, and `artbook-like` as format descriptors — keep them exactly as written.

### Canonical sections to inject if missing

#### [STORYBOARD PURITY] (inject if absent)

```
[STORYBOARD PURITY]
Panel images are visual-only low-detail monochrome light-gray rough sketches. Put panel numbers, beat names, and lens tags in the header strip outside each panel image. No color, labels, arrows, captions, subtitles, logos, watermarks, timing marks, diagrams, UI, ghost poses, duplicate bodies, or technical overlays inside panels.
```

#### [STYLE LOCKS] (inject if absent; fill [X] from context)

```
[STYLE LOCKS]
STYLE LOCK: clean monochrome rough-sketch storyboard panels on off-white paper, light-gray gesture lines, simplified shapes, restrained accent colors only outside panel art, crisp cinematic hierarchy, no rendered panel lighting.
EFFECT LOCK: inside panels, all effects are simple monochrome bright shapes only.
ENVIRONMENT LOCK: preserve consistent spatial geography across all wide and master panels.
```

#### [DIRECTOR STRIP] format reminder (inject if the strip tracks are present but malformed)

```
RHYTHM TRACK format: `RHY P##: [hold|slow reveal|build|burst|impact|pause|recover|final hit] / [short block|medium block|long block] / [clean beat|match beat|smash beat|held beat|whip beat]`.
ESCALATION MAP format: `ESC P##: [L1 calm|L2 tension|L3 rise|L4 surge|L5 peak] / [flat|rise|spike|drop|release|unresolved]`.
```
