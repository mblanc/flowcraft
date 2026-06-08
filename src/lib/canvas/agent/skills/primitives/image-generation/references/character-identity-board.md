---
name: character-identity-board
description: Canonical prompt format and rules for CHARACTER IDENTITY BOARD generation. Loaded automatically by the PromptEngineer alongside the main SKILL.md.
---

## Special Case: Character Identity Boards

If the generation intent specifies a "CHARACTER IDENTITY BOARD", **do not use the standard GENERAL DESCRIPTION + STRUCTURED FEATURES format**. Instead, output the intent as-is — the Director has already structured it using the correct character identity board template. Your role is to:

1. Verify the intent already contains the required sections (DESIGN DIRECTION, IMPORTANT LAYOUT RULE, MAIN COMPOSITION, IDENTITY LOCK, ARTISTIC SECTIONS, TEXT DESIGN, STYLE).
2. If sections are missing, add them verbatim from the canonical template below.
3. If a reference image is mentioned (e.g., `@Image1`), make sure `SUBJECT: use the reference image @Image1` is present.
4. Append at the end: `FORBIDDEN: No overlapping figures. No cropped faces. No hidden limbs. No grids or blueprint lines. No logos or watermarks. No stock-photo backgrounds. No generic AI faces. No symmetry artifacts.`
5. Output the final prompt block with no extra preamble, headers, or markdown.

**Exception to the "no mood words" rule**: character identity board prompts intentionally use the words `cinematic`, `premium`, `artbook-like`, and `expressive` as format descriptors — keep them exactly as written.

### Canonical sections to inject if missing

```
DESIGN DIRECTION:
Do not create a standard character reference sheet.
Create a cinematic identity board that feels like a high-end animation studio character study mixed with an artbook layout.

The layout should be asymmetrical, elegant and visually memorable.
Use large empty space, varied image scale and intentional imbalance.
Avoid grids, blueprint design, catalog layout and repetitive turnaround presentation.

IMPORTANT LAYOUT RULE:
Do not overlap any character images.
Every view must have clear separation and breathing room.
Keep all bodies, portraits, silhouettes and detail studies visually distinct.
No cropped faces, no hidden limbs, no stacked figures, no merged poses.

MAIN COMPOSITION:
Place one large hero full-body view slightly off-center as the visual anchor.

Around it, arrange smaller supporting studies with clean spacing:
neutral full-body view,
back view,
profile view,
seated pose,
leaning pose,
crouching pose,
top-down body angle,
low-angle body angle,
expressive portrait studies.

Each view should feel like a separate clean character study, not a frame from one scene.

IDENTITY LOCK:
Preserve strict identity consistency across all views:
same face,
same facial proportions,
same hairstyle,
same outfit,
same body proportions,
same posture language,
same visual personality.

USEFUL REFERENCE DETAILS:
Make the character readable for future image and video generation:
clear face shape,
clear hair silhouette,
clear outfit silhouette,
clear body shape,
clear hands,
clear posture,
clear expression range.

ARTISTIC SECTIONS:
Include a small silhouette study area with 2-3 simplified black character silhouettes.
Include a small expression study area with subtle emotional variations.
Include a small detail study area showing key visual features of the face, hair and outfit.

TEXT DESIGN:
Add one stylish CHARACTER ID block.
Keep it minimal, bold and art-directed.
Use only:
NAME
ROLE
CORE MOOD
VISUAL SIGNATURE

Use small handwritten-style labels only where helpful.
Subtle editorial arrows and annotation marks are allowed, but keep them minimal and elegant.

STYLE:
minimal,
cinematic,
premium,
artbook-like,
clean,
expressive,
useful for production.

The final image should feel like an artistic character identity board designed to help an AI model understand the character's face, silhouette, outfit, posture and emotional range.
```
