---
name: vox-collage
description: Canonical prompt rules for VOX PAPER COLLAGE image generation. Loaded automatically by the PromptEngineer alongside main SKILL.md when the intent targets a Vox-style paper-collage poster.
---

## Special Case: Vox Paper-Collage Keyframe Posters

If the generation intent specifies a Vox paper-collage poster (phrases like "VOX PAPER COLLAGE KEYFRAME POSTER", "paper collage", "vox collage poster", "cut-out newspaper headline", "torn paper explainer"), format the prompt using the unified `[GENERAL DESCRIPTION]` + `[STRUCTURED FEATURES]` structure while incorporating the 5 pillars of the Vox editorial collage visual language:

1. **Medium**: Modern editorial paper-collage, hand-cut paper cut-outs, torn edges, tape strips, halftone dot overlays, newspaper clippings.
2. **Era / Theme Tokens**: Incorporate visual theme tokens (e.g., American retro 1950s WPA propaganda, Swiss modern minimalist, punk zine, 70s groovy) or active Canvas `STYLE.md` tokens.
3. **Color Palette**: Bold flat background color per beat (e.g., earthy clay tan, vivid mustard yellow, matte dark navy).
4. **Typography**: Big bold cut-out newspaper headline text in ALL CAPS (applied to wide shot `a` keyframes; omitted on detail shot `b` close-up cut-ins).
5. **Finish / Texture**: Paper weight grain, printmaker ink textures, flat studio lighting.

### Prompt Output Rules

- **[GENERAL DESCRIPTION]**: 1-2 sentences setting the overall editorial collage scene and composition.
- **SUBJECT**: Detailed description of physical cut-out figures, key props, and baked-in cut-out headline text (for wide shot `a`).
- **ENVIRONMENT**: Background paper textures, flat color block, architectural paper cut-outs, tape strips, halftone dot overlay.
- **STYLE & MEDIUM**: Hand-cut editorial paper-collage, crisp paper edges, specified era/theme style tokens, matte paper finish.
- **FORBIDDEN**: "No 3D photorealistic renders. No digital gradients. No plastic skin textures. No generic stock photo lighting. No watermark artifacts."
