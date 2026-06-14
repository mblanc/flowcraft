---
name: illustration-styles
description: Reference vocabulary for image illustration styles across printmaking, traditional media, digital/modern, historical movements, comic/narrative, and technical illustration. Use to populate STYLE & MEDIUM in image prompts, and to surface style options via ask_user.
---

## Illustration Style Reference

Use this vocabulary in the `STYLE & MEDIUM` section of image prompts. Name the style explicitly — do not use vague descriptors like "artistic" or "stylized."

---

### 1. Printmaking & Relief Techniques

| Style              | Prompt vocabulary                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Woodcut            | Bold black outlines, rough cross-hatching texture, block printing look, German Expressionist style              |
| Ukiyo-e            | Japanese woodblock print, textured rice paper, flat colors, distinct outlines, Hokusai style                    |
| Linocut            | Fluid curving white lines carved into a black background, high contrast, handmade stamp texture                 |
| Etching / Intaglio | Fine scratchy ink lines on aged sepia paper, cross-hatching, 17th-century scientific illustration style         |
| Engraving          | Dense cross-hatching, swelling lines creating depth, banknote style illustration, monochrome steel engraving    |
| Lithography        | Crayon-like texture on stone, soft shading, muted color palette, Toulouse-Lautrec vibe, vintage                 |
| Screen printing    | Bold blocks of layered cyan, magenta, and yellow ink, slight misregistration of layers, coarse texture, pop art |
| Risograph          | Grainy texture, fluorescent ink, slight imperfect layer alignment, speckled paper look                          |

---

### 2. Traditional Media

| Style                 | Prompt vocabulary                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Watercolor            | Translucent colors, wet-on-wet paint bleeding, visible brushstrokes, soft edges, textured paper background         |
| Gouache               | Opaque flat colors, matte finish, chalky texture, distinct brushstrokes, naive art style                           |
| Sumi-e                | Traditional Japanese ink wash, minimalist black ink brushstrokes on rice paper, negative space, fluid brush flow   |
| Stippling             | Thousands of small black dots creating shading and form, pointillism pen and ink technique                         |
| Cross-hatching        | Shading created entirely by dense cross-hatching and parallel lines, high contrast black and white                 |
| Impasto               | Extremely thick paint application, visible palette knife marks creating sculptural texture on canvas, oil painting |
| Pastel / Chalk        | Dusty texture, highly blended colors, chalky finish on textured paper                                              |
| Charcoal              | Rich deep blacks, smudged shadows, rough textures, expressive lines on newsprint                                   |
| Collage / Mixed media | Torn newspaper clippings, painted textures, old photographs, found paper scraps, analog cut-and-paste aesthetic    |

---

### 3. Digital & Modern Graphic

| Style          | Prompt vocabulary                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| Flat design    | Simple geometric shapes, solid colors, no gradients, no shadows, minimalist UI aesthetic                         |
| Isometric      | 3D view from 30-degree angle, cute low-poly style, diorama effect, clean rendering                               |
| Low poly       | Geometric polygonal facets, faceted 3D rendering, angular style                                                  |
| Vector art     | Crisp mathematical lines, scalable graphics, solid bold colors, Adobe Illustrator style                          |
| Pixel art      | 16-bit retro video game aesthetic, visible pixel grid, limited color palette                                     |
| Voxel art      | 3D rendering made entirely of small cubes, blocky Minecraft aesthetic, cute style                                |
| Glitch art     | Digital data corruption, VHS tracking errors, RGB color separation shifts, pixel sorting, fragmented imagery     |
| Vaporwave      | Classical statue aesthetic, neon pink and blue grid sunset, Windows 95 UI elements, nostalgic digital surrealism |
| Matte painting | Hyper-realistic digital matte painting, epic scale, detailed cinematic lighting, film background                 |

---

### 4. Historical Art Movements

| Style               | Prompt vocabulary                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Art Nouveau         | Organic whiplash curves, decorative border, muted gold and natural colors, Alphonse Mucha style                       |
| Art Deco            | Geometric shapes, sunburst motifs, metallic gold and black palette, symmetrical composition, 1920s jazz age           |
| Bauhaus             | Abstract composition, basic geometric shapes in primary colors, minimalist functional design                          |
| Pop Art             | Thick black outlines, bold primary colors, Ben-Day halftone dots, comic book panel aesthetic, Roy Lichtenstein style  |
| Surrealism          | Dreamlike illogical imagery, highly rendered realistic technique applied to impossible subjects, Salvador Dalí style  |
| Cubism              | Subject fragmented into geometric planes, multiple viewpoints simultaneously, muted earthy palette, Picasso influence |
| Mid-Century Modern  | Atomic age shapes, boomerang tables, whimsical cartoon style, textured brushes, olive green/turquoise/orange palette  |
| Victorian / Vintage | Ornate engraved borders, elaborate typography, cross-hatch shading, sepia toned, trade card illustration              |

---

### 5. Comic, Character & Narrative

| Style              | Prompt vocabulary                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Ligne Claire       | Uniform strong black outlines, flat colors, no hatching, Hergé/Tintin aesthetic                           |
| Anime / Manga      | Vibrant colors, expressive large eyes, dynamic action pose, cel-shading aesthetic, anime still frame      |
| Chibi              | Super-deformed proportions, oversized head, tiny body, large expressive eyes, kawaii aesthetic            |
| Concept art        | Loose brushwork, focus on atmosphere and lighting, industrial design, speed-painting aesthetic            |
| Caricature         | Wildly exaggerated features, humorous distorted proportions, satirical cartoon style                      |
| Noir / Chiaroscuro | Extreme chiaroscuro lighting, high contrast black and white, heavy shadows, gritty mood, comic book panel |

---

### 6. Technical & Specialized Illustration

| Style                   | Prompt vocabulary                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Botanical / Scientific  | Highly detailed watercolor and ink rendering, isolated on white, scientific labels, vintage botanical illustration |
| Technical / Blueprint   | White schematic lines and dimension measurements on blue grid background, cutaway view, mechanical drawing         |
| Fashion illustration    | Elongated 9-head figure, loose energetic marker and ink lines, focus on fabric drape and texture                   |
| Architectural rendering | Precise two-point perspective, watercolor and ink, realistic lighting and landscaping                              |

---

## ask_user guidance for style

When the user has not specified a style and one is needed, ask with 3–4 options matched to the subject:

- **Portrait / character** → suggest: photorealistic, anime, concept art, charcoal
- **Landscape / environment** → suggest: watercolor, matte painting, woodcut, flat design
- **Product / object** → suggest: technical illustration, vector art, gouache, isometric
- **Historical / vintage feel** → suggest: engraving, lithography, Art Nouveau, Victorian
- **Abstract / experimental** → suggest: glitch art, cubism, collage/mixed media, vaporwave
