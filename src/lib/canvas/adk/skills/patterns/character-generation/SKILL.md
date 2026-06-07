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

```
[Step 1] t2i: Character Identity Board
  operation: t2i
  promptIntent: "Create an artistic 16:9 CHARACTER IDENTITY BOARD for [Character Name].
                 [CHARACTER SEED]: [Describe core idea, e.g., cyber hacker, forest druid]
                 [AGE / BODY TYPE]: [Describe age, physique, anatomy]
                 [VISUAL MEDIUM]: [Describe visual medium, e.g., 2D anime, stylized 3D, fashion photo]
                 [STYLE]: [Describe style direction, e.g., urban techwear, elegant fantasy]"
  label: "Character Board — [Character Name]"
```

If the user provides an existing image of the character on the canvas and wants to generate an identity board from it:

- Wire the existing image as `subject_ref` to the `t2i` node.
- In `promptIntent`, add: "SUBJECT: Use the reference image @Image1. name: [Name]."

---

## Layout and Design Rules for the Board

The planned `promptIntent` must instruct the generator to follow these layout guidelines (which the PromptEngineer will expand):

1. **Background**: Pure white or soft off-white, minimal clean graphic design. No environment, no logo, no watermark.
2. **Asymmetrical Layout**: Elegant and visually memorable, with large empty space, varied image scale, and intentional imbalance. Avoid grids, catalog layouts, and blueprint designs.
3. **No Overlapping**: Keep all views visually distinct with breathing room. No cropped faces, no hidden limbs.
4. **Composition**:
    - One large hero full-body view slightly off-center as the visual anchor.
    - Varied supporting studies: neutral full-body, back view, profile view, seated/leaning poses, and portrait studies.
    - A small silhouette study area (2-3 black silhouettes).
    - A small expression study area (subtle emotional variations).
    - A small detail study area (close-ups of face, hair, or outfit).
5. **Text Block**: Include a minimal, bold, and art-directed CHARACTER ID block containing only:
    - NAME
    - ROLE
    - CORE MOOD
    - VISUAL SIGNATURE

---

## Common failures

- **Generating a standard scene instead of a board**: The character sheet is a tool for future generation. Putting them in a scene makes it hard to extract details for other nodes.
- **Grids and blueprints**: Standard turnarounds feel robotic. Always insist on an "asymmetrical, elegant, artbook-like" layout.
- **Cropped limbs or overlapping views**: If the views overlap, the model cannot distinguish the character's clothing and proportions for future frames.
