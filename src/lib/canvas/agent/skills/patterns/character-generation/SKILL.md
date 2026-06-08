---
name: character-generation
description: Character generation and identity board planning. Creates an artistic, high-quality Character Identity Board to establish and lock a character's visual identity (face, clothing, body type, expression range, and silhouette) for future image and video generation.
metadata:
    type: pattern
---

## Trigger condition

Use this pattern when the user asks to:

- "create a character", "design a character", "make a character sheet"
- "create a reference sheet for [character name]"
- "generate a character identity board"

Do **not** use this pattern if the user wants to generate a standard scene with a character. This pattern is strictly for creating a reference/identity board of the character on a clean background.

---

## Workflow steps

Creating a character is planned as a single `t2i` step that generates a 16:9 Character Identity Board.

### Case A — From an existing reference image on the canvas

Use when the user provides a reference image and wants to build an identity board from it.

- Wire the existing image as `subject_ref` to the `t2i` node.
- `promptIntent` must follow this template exactly:

```
Create an artistic 16:9 CHARACTER IDENTITY BOARD.

[SUBJECT]: use the reference image. name: [Name]. [role, e.g. hacker / warrior / dancer]. make color correction.
VISUAL MEDIUM: [exact medium, e.g. Stylized anime-painterly / stylized 3D / realistic cinematic].

Pure white / soft off-white background.
No environment, no logo, no watermark.

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

### Case B — Fully original character (no reference image)

Use when the user wants to create a new character from scratch.

- `promptIntent` must follow this template exactly (fill in all placeholders; invent anything not specified by the user):

```
Create a fully original, copyright-safe character and present them as an artistic CHARACTER IDENTITY BOARD.

[CHARACTER SEED]: [core idea: job, personality, world, role]
[AGE / BODY TYPE]: [age impression, body type, posture, physical presence or creature anatomy]
[VISUAL MEDIUM]: [exact rendering medium, e.g. 2D anime character design / modern 3D animation character design / semi-realistic painterly realism / graphic novel illustration]
[STYLE]: [aesthetic direction, e.g. urban street fashion / dark cinematic noir / poetic coastal fantasy]
[OTHER DETAILS - OPTIONAL]: [extra constraints, mood, outfit hints, props, colors, themes, personality hints]

Invent everything else:
character name, alias or title, role, personality traits, emotional tone, visual theme, outfit design or body design, color palette, signature prop or signature biological feature, recognizable silhouette, pose language, small identity notes.

Originality rules:
The character must not resemble any existing anime, manga, game, movie, comic, celebrity, athlete, mascot, franchise character or known copyrighted creature.
Do not copy recognizable IP elements, costumes, hairstyles, uniforms, weapons, logos, symbols, color combinations, silhouettes, powers or signature visual traits.
Avoid fan-art aesthetics.
Create a fresh visual identity from scratch.

Character authenticity rules:
Create the character with a strong sense of individuality and non-generic design.
Avoid overly polished, overly idealized or repetitive visual features that make the character feel like a default AI-generated face, stock design, cloned archetype or generic creature.

If the character is human or humanoid:
Use distinctive facial structure, subtle asymmetry, natural variation, small imperfections and believable proportions.
The character should feel specific, grounded and recognizably individual.
If the character is attractive, keep the appeal natural, tasteful and appropriate to the chosen visual medium.

If the character is stylized:
Preserve uniqueness through original shape language, expressive proportions, distinctive features, posture and clear personality cues.
Avoid default genre clichés and repeated beauty standards.

If the character is non-human:
Preserve uniqueness through original anatomy, believable biological structure, distinctive proportions, functional features, surface texture and clear personality cues.
Do not make it feel like a generic mascot, pet monster or stock fantasy creature.

Medium and style control:
[VISUAL MEDIUM] controls the rendering language.
[STYLE] controls the aesthetic direction.
The character identity board format is only the presentation format.
The presentation must adapt to [VISUAL MEDIUM] and [STYLE], not override them.
Use visual traits that belong naturally to the selected medium.

Create an artistic 16:9 CHARACTER IDENTITY BOARD.

The board should feel like a curated visual identity presentation, not a generic turnaround sheet.

Board content:
large full-body main character view, neutral full-body view, back view, profile view, secondary attitude pose, 4 to 6 face or expression studies, outfit detail close-ups or anatomy detail close-ups, key prop close-up or signature feature close-up, small silhouette or shape study, color palette strip, short readable identity notes.

Layout:
asymmetrical, elegant, visually memorable, large empty space, clean separation between all views, no overlapping bodies, no cropped faces, no hidden limbs, no clutter.

Text on the board may include:
character name, alias, role, personality traits, core theme, signature prop or feature, color notes.

Background:
pure white or soft off-white, minimal clean graphic design, no environment, no logo, no watermark.

Prioritize:
accurate visual medium, strong unique identity, readable outfit design or anatomy design, clear personality, original character design, natural or stylized individuality as appropriate, believable uniqueness, non-repetitive character design, artistic identity-board presentation.
```

---

## Common failures

- **Generating a standard scene instead of a board**: The character sheet is a tool for future generation. Putting them in a scene makes it hard to extract details for other nodes.
- **Grids and blueprints**: Standard turnarounds feel robotic. Always insist on an "asymmetrical, elegant, artbook-like" layout.
- **Cropped limbs or overlapping views**: If the views overlap, the model cannot distinguish the character's clothing and proportions for future frames.
