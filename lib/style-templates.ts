import type { StyleDocument } from "./style-types";

export type TemplateStyle = Omit<
    StyleDocument,
    "id" | "userId" | "createdAt" | "updatedAt"
> & {
    isTemplate: true;
    id: string;
};

export const STYLE_TEMPLATES: TemplateStyle[] = [
    {
        id: "template-cinematic",
        isTemplate: true,
        name: "Cinematic",
        description:
            "35mm film aesthetic with golden hour lighting and shallow depth of field",
        referenceImageUris: [],
        content: `# Cinematic Style

## 1. Primary Medium
- **Camera:** 35mm film, anamorphic lens (85mm equivalent)
- **Film Stock:** Kodak Vision3 500T aesthetic — slight grain, rich shadows, warm highlights
- **Depth of Field:** Shallow (f/1.4–f/2.0), smooth bokeh backgrounds

## 2. Lighting & Mood
- **Direction:** Single-source side lighting or motivated natural light
- **Quality:** Soft-diffused but high-contrast (ratio 4:1)
- **Time of Day:** Late afternoon golden hour (~5500K) or blue hour dusk (~4000K)
- **Atmosphere:** Slight haze, volumetric light rays when appropriate

## 3. Color Science
- **Shadows:** Deep teal-blue undertones, never pure black
- **Midtones:** Warm amber-orange push on skin and earth tones
- **Highlights:** Creamy off-white, slight yellow cast
- **Grade:** S-curve with crushed blacks and lifted mids (filmic look)

## 4. Composition Rules
- **Framing:** Widescreen 2.39:1 crop feel, letterbox sensibility
- **Subject Placement:** Rule of thirds; negative space intentional
- **Vantage Point:** Eye-level or slight low angle ("hero" perspective)
- **Camera Movement Feel:** Suggest slow dolly or static locked shots

## 5. Negative Constraints
- No HDR processing, no over-sharpening
- No neon or high-saturation colors
- No flat/even lighting — always directional
- No stock-photo "smiling at camera" poses
- No digital-looking cleanliness — embrace organic imperfection`,
    },
    {
        id: "template-editorial-photo",
        isTemplate: true,
        name: "Editorial Photo",
        description:
            "Clean studio photography with high contrast and minimalist backgrounds",
        referenceImageUris: [],
        content: `# Editorial Photography Style

## 1. Primary Medium
- **Camera:** Medium format digital (Hasselblad aesthetic), 80mm lens
- **Look:** Commercial editorial — crisp, intentional, magazine-ready
- **Depth of Field:** Medium (f/4–f/8), subject sharp, background softly separated

## 2. Lighting & Mood
- **Direction:** Two-light setup: key + rim, or large softbox overhead
- **Quality:** Clean, soft, high-key with precise shadow control
- **Color Temperature:** Neutral daylight 5600K — no warm/cool bias
- **Mood:** Confident, aspirational, polished

## 3. Color Science
- **Shadows:** Dark gray, slight cool tint — never crushed to black
- **Skin Tones:** Accurate, neutral — no orange push
- **Backgrounds:** White, light gray, or textured neutral (concrete, paper)
- **Accents:** Single brand color used sparingly as prop or wardrobe element

## 4. Composition Rules
- **Subject Placement:** Centered or strong rule-of-thirds alignment
- **Negative Space:** Generous — let the subject breathe
- **Backgrounds:** Clean, minimal, non-distracting
- **Cropping:** Head room respected; full body or deliberate portrait crop

## 5. Negative Constraints
- No busy or cluttered backgrounds
- No dramatic color grading or heavy filters
- No motion blur or intentional camera shake
- No harsh shadows across the face
- No oversaturated colors`,
    },
    {
        id: "template-flat-illustration",
        isTemplate: true,
        name: "Flat Illustration",
        description:
            "Bold vector-style flat design with clean shapes and a limited color palette",
        referenceImageUris: [],
        content: `# Flat Illustration Style

## 1. Primary Medium
- **Style:** Vector flat illustration, 2D
- **Rendering:** Clean fills, no gradients (or very subtle 2-stop gradients max)
- **Line Work:** Optional thin outlines (1–2px stroke) or fully borderless fills

## 2. Visual Language
- **Shapes:** Geometric, simplified — organic shapes only when intentional
- **Iconography:** Consistent stroke weight throughout, rounded corners (8–12px radius)
- **Characters:** Simple, expressive — no photorealistic faces
- **Depth:** Achieved through layering and color, not shadows

## 3. Color Science
- **Palette:** 4–6 colors maximum per composition
- **Values:** Medium-light range — avoid very dark or very light extremes
- **Shadows:** Flat color blocks, 15–20% darker than base — no soft drop shadows
- **Highlights:** Flat color blocks, 15–20% lighter than base
- **Accents:** One high-vibrancy color for focal points only

## 4. Composition Rules
- **Layout:** Balanced, grid-aligned
- **Subject Placement:** Central focal element with supporting secondary elements
- **White Space:** Generous — avoid visual crowding
- **Scale:** Use deliberate scale contrast to establish hierarchy

## 5. Negative Constraints
- No photorealism or 3D rendering
- No complex textures or noise
- No more than 6 colors in a single scene
- No lens effects (flares, blur, bokeh)
- No gradients that span more than 2 stops`,
    },
    {
        id: "template-watercolor-ink",
        isTemplate: true,
        name: "Watercolor & Ink",
        description:
            "Loose painterly brushwork with organic edges and paper texture",
        referenceImageUris: [],
        content: `# Watercolor & Ink Style

## 1. Primary Medium
- **Technique:** Traditional watercolor on cold-press paper, with ink line work
- **Paper Texture:** Visible tooth and grain — Fabriano 300gsm aesthetic
- **Brushwork:** Loose, gestural, with intentional bleeding and blooms

## 2. Lighting & Atmosphere
- **Approach:** Light defined by absence of paint (paper shows through)
- **Shadows:** Wet-on-wet washes, soft edges, never harsh
- **Mood:** Quiet, contemplative, organic — nature or travel journal feel
- **Color Temperature:** Warm or cool depending on subject; always harmonious

## 3. Color Science
- **Palette:** Muted, slightly desaturated — no neon or pure primaries
- **Mixing:** Colors bleed and blend at edges — hard edges only from ink
- **Shadows:** Complementary color washes (e.g., blue-purple under warm subjects)
- **Whites:** Pure paper white — no white paint or digital white fill
- **Ink Lines:** Dark brown or black, variable weight, hand-drawn feel

## 4. Composition Rules
- **Edges:** Soft, bleeding, unfinished — subjects fade into the background
- **Focus:** Soft vignette naturally draws eye to center
- **Negative Space:** Unpainted areas are active compositional elements
- **Texture:** Paper grain, watercolor blooms, and ink variation always present

## 5. Negative Constraints
- No clean digital edges or perfectly uniform fills
- No high saturation or neon colors
- No symmetric or mechanical compositions
- No photorealistic rendering
- No flat vector shapes`,
    },
    {
        id: "template-3d-render-glass",
        isTemplate: true,
        name: "3D Render / Glass",
        description:
            "Glossy 3D product renders with HDRI studio lighting and glass materials",
        referenceImageUris: [],
        content: `# 3D Render / Glass Style

## 1. Primary Medium
- **Technique:** 3D CGI render (Cinema 4D / Blender aesthetic)
- **Rendering:** Path-traced, high sample count — no noise
- **Materials:** Primary: glossy glass, transparent acrylic, polished metal

## 2. Lighting & Mood
- **Setup:** HDRI studio environment with 2–3 area lights
- **Key Light:** Large soft box, high position, slight warm tint
- **Fill:** Subtle cool bounce from opposite side
- **Rim:** Thin bright rim to separate subject from background
- **Background:** Pure white, light gray gradient, or dark studio

## 3. Material Language
- **Glass:** IOR 1.5, slight caustics, colored tint optional
- **Plastic:** Semi-glossy, matte finish preferred over high-gloss
- **Metal:** Brushed aluminum or polished chrome — no rust or wear
- **Surfaces:** Clean, pristine — product-shot perfection

## 4. Color Science
- **Primary Color:** Monochromatic or analogous palette
- **Reflections:** Accurate environment mapping
- **Highlights:** Pure white specular — precise, not blown
- **Shadows:** Soft contact shadows, slight blue-gray tint

## 5. Composition Rules
- **Vantage Point:** Slightly above eye-level (15–25° elevation)
- **Angle:** 3/4 view preferred for dimensionality
- **Scale:** Object fills 60–70% of frame
- **Depth of Field:** Subtle — product sharp, foreground/background slightly soft

## 6. Negative Constraints
- No hand-drawn or painterly textures
- No warm or ambient occlusion-heavy looks
- No visible render noise or compression artifacts
- No overcrowded scenes — one hero object maximum
- No photographic film grain`,
    },
    {
        id: "template-vintage-poster",
        isTemplate: true,
        name: "Vintage Poster",
        description:
            "Retro screen-print aesthetic with limited palette, grain, and bold typography feel",
        referenceImageUris: [],
        content: `# Vintage Poster Style

## 1. Primary Medium
- **Technique:** Screen-print / lithograph aesthetic (1920s–1970s)
- **Texture:** Visible halftone dots, ink grain, and slight misregistration
- **Feel:** Analogue printing — intentional imperfection

## 2. Visual Language
- **Color Separation:** 2–4 flat color layers, each slightly misaligned
- **Halftones:** Visible dot patterns in midtones (45° angle, 60–80 LPI)
- **Grain:** Paper texture and ink bleed visible throughout
- **Typography Feel:** Bold, condensed letterforms even if no text present

## 3. Color Science
- **Palette:** 2–5 colors maximum — duotone or tritone preferred
- **Ink Colors:** Muted, slightly aged — not fresh or digital-bright
- **Background:** Aged cream (#F5EDD6), kraft brown, or deep navy
- **Accent:** One high-contrast accent color (red, mustard, or teal)
- **Black:** Rich, slightly warm — never pure digital black

## 4. Composition Rules
- **Layout:** Strong geometric structure, poster-grid sensibility
- **Subject:** Bold, graphic, high-contrast silhouettes
- **Negative Space:** Active and intentional — flat color fills
- **Hierarchy:** Clear visual hierarchy — one dominant element

## 5. Negative Constraints
- No photorealism or gradients
- No bright, saturated digital colors
- No clean, modern sans-serif aesthetic
- No lens effects or photography-derived looks
- No more than 5 colors in any composition`,
    },
];
