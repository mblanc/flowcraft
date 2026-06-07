---
name: image-generation
description: Image generation. Produces a still image from text, edits an existing image, or composites multiple images. Use for any output that is a single still frame — concept art, character references, product shots, scene keyframes, style explorations, background plates, virtual try-on, or image editing.
metadata:
    type: primitive
---

## When to use

Use `t2i` when the user wants a still image: concept art, product shots, character references, background plates, style samples, or any image that does not require motion.

---

## Unified Prompt Structure

Every image generation prompt — whether creating from scratch, editing an existing image, or compositing multiple images — must follow a single unified structure. It consists of a general description of the image followed by a structured description of specific features.

```
[GENERAL DESCRIPTION]
<A 1-2 sentence overview of the image, setting the core subject, action, and composition.>

[STRUCTURED FEATURES]
SUBJECT: <Specific details of the focus/subject. Include reference links like @Image1 if modifying or preserving traits.>
ENVIRONMENT: <The physical place, background elements, and light sources (type, direction, quality).>
STYLE & MEDIUM: <Output medium type, camera lens/depth, color palette, and textures.>
CHANGES (if editing/compositing): <EDIT instructions, LOCK directives, and PHYSICS constraints to match existing elements.>
FORBIDDEN: <At least three specific entries for elements/artifacts to exclude.>
```

---

## Prompt structure details

### [GENERAL DESCRIPTION]

Provide a 1-2 sentence overview of the entire scene to give the model overall context.

- **Good:** "A close-up photographic portrait of a chef slicing red peppers in a sunlit restaurant kitchen."
- **Bad:** "A chef in a kitchen."

### [STRUCTURED FEATURES]

#### **SUBJECT**

Describe the single subject or focus that the eye lands on first.

- **Details:** Material, physical anchors (e.g., jawline, eye color, fabric type, exact color names like "faded slate denim"), and condition (new, worn).
- **Reference Anchoring:** If inheriting traits from a canvas reference (e.g., `@Image1`), specify: `"Same person as @Image1. Maintain [list 3-4 specific traits]. Do not alter facial proportions, eye shape, or hairstyle."`
- **Emotion:** Do not describe emotion directly (e.g., "sad"). Describe the physical facial features that produce it (e.g., "furrowed brow, downcast eyes").

#### **ENVIRONMENT**

Describe the physical setting and lighting.

- **Setting:** Be concrete. Specify architectural details, era, season, time of day, and weather (e.g., "east-facing corner of a 1970s laundromat, 6pm, winter").
- **Lighting:** Name every light source by type, direction, and quality. Never use subjective mood words (e.g., "cinematic," "golden hour," "beautiful").
    - _Good:_ "Warm tungsten side-light from camera left," "neon blue rim light at 2 o'clock," "single overhead bulb casting a pale yellow glow."
- **Composite Setting:** If inheriting environment from a canvas reference (e.g., `@Image3`), specify: `"Adopt environment, lighting, and layout from @Image3."`

#### **STYLE & MEDIUM**

Name the output medium type and style properties explicitly.

- **Medium:** Editorial photo, digital painting, storyboard frame, product mockup, etc.
- **Camera Details:** Lens choice, aperture (e.g., "Sony A7R IV, 85mm prime, f/1.8 shallow depth of field"), and film stock (e.g., "Kodak Portra 400 fine grain").
- **Deconstruct Style:** If matching style from a reference (e.g., `@Image2`), deconstruct it into three channels:
    1.  **Palette:** Named colors and shadow treatment (e.g., "Adopt color palette from @Image2: shadows deep navy, never pure black").
    2.  **Edge treatment:** Line weights, silhouette hardness (e.g., "hard ink outlines," "soft photographic edges").
    3.  **Silhouette language:** conventions of pose, proportions.

#### **CHANGES (if editing/compositing)**

Used only when modifying or merging existing image(s).

- **EDIT:** Exactly what changes in one unambiguous sentence. One change per prompt.
- **LOCK:** What must stay identical (e.g., face, pose, outfit, layout, background).
- **PHYSICS:** Match physical properties of the existing scene: shadow direction, contact shadows, grain, color balance, scale relationships.

#### **FORBIDDEN**

Never skip this section. Provide at least three entries to prevent hallucination and distortion.

- **Exclusions:** "No secondary subjects. No duplicate objects. No over-sharpening."
- **AI Tells:** "No symmetry artifacts. No plastic-looking skin. No watermark-shaped artifacts."
- **Realism Layer:** "2-3% film grain overlay. Slight facial asymmetry. Visible pore texture."

---

## Special Case: Character Identity Boards

If the general description or intent specifies generating a "CHARACTER IDENTITY BOARD", structure the features as follows:

- **SUBJECT**:
    - If original: Define character seed, age, body type, posture, physical presence, and signature biological/outfit features.
    - If referencing an image (e.g., @Image1): `"SUBJECT: Use the reference image @Image1. name: [Name]. Make color correction. Preserve strict identity consistency across all views: same face, proportions, hairstyle, outfit, and body shape."`
- **ENVIRONMENT**:
    - `"Pure white or soft off-white background. No environment, no logo, no watermark."`
- **STYLE & MEDIUM**:
    - Medium type: `"Artistic 16:9 CHARACTER IDENTITY BOARD."`
    - Presentation style: `"Cinematic identity board that feels like a high-end animation studio character study mixed with an artbook layout. Asymmetrical, elegant, with large empty space and intentional imbalance. Avoid grids, blueprints, and repetitive turnarounds."`
    - Composition: `"One large hero full-body view slightly off-center as the visual anchor. Arrange smaller supporting studies with clean spacing: neutral full-body, back view, profile view, seated/crouching poses, and expressive portrait studies. No overlapping images; clear separation and breathing room."`
    - Artistic Sections: `"Include a small silhouette study area (2-3 black silhouettes), a small expression study area, and a small detail study area for face/hair/outfit."`
- **CHANGES**: (Leave blank unless editing an existing character board)
- **FORBIDDEN**:
    - `"No overlapping figures. No cropped faces. No hidden limbs. No grids or blueprint lines. No logos or watermarks. No stock-photo backgrounds."`

---

## Model hints

- `gemini-3.1-flash-image`: **default** — fastest, best for drafts and variations.
- `gemini-3-pro-image`: highest quality; use for hero shots or final keyframes only when the user requests it.
- Always use the canvas default model unless the user explicitly requests otherwise.

---

## Common failures

- Vague subjects ("a nice scene") produce generic output — anchor to specific physical facts.
- Mood words ("cinematic," "stunning," "epic," "atmospheric") override the model's knowledge with noise — cut them.
- Conflicting medium cues ("photorealistic watercolor") confuse the model — pick one.
- Skipping FORBIDDEN lets the model hallucinate secondary subjects, extra limbs, and style drift.
- Aspect ratio shapes composition: portrait subjects → `9:16`, landscapes → `16:9`, product shots → `1:1`.
