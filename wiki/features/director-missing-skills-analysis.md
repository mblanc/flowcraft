# Generative Media Director: Missing Skills & Capabilities Analysis

This document analyzes the capabilities of the **Canvas Director (Agent B)** in the context of the comprehensive generative AI media use cases outlined in [genmedia-usecases.md](file:///Users/mblanc/projects/flowcraft/wiki/research/genmedia-usecases.md). It identifies key gaps between the Director's current skill set and the highest-value commercial opportunities, and proposes concrete new skills and architectural upgrades to bridge these gaps.

---

## Executive Summary

The Flowcraft Canvas Director is built on a highly modular, elegant architecture. By separating **Pattern Skills** (high-level orchestrators of multi-node DAGs) from **Primitive Skills** (single-node prompt-engineering rules), the Director can plan complex, multi-modal workflows.

However, the Director's current skill set is heavily skewed toward **cinematography, narrative fiction, and cinematic pre-production** (e.g., `multi-shot-video`, `storyboard`, `character-generation`). While these are powerful, they leave significant gaps in the **highest-value commercial, e-commerce, marketing, and corporate L&D sectors**, which represent the largest addressable markets (TAM).

To transform the Director from a creative narrative tool into an enterprise-grade production powerhouse, we need to introduce:

1. **Commercial & E-commerce Patterns** (`product-staging`, `ad-variant-multiplier`, `virtual-staging-interior`).
2. **Audio-Visual Continuity & Talking Avatar Patterns** (`avatar-presenter-video`, `video-localization-dubbing`).
3. **Engine & Primitive Upgrades** (multi-track audio-video mixing, precision editing like inpainting/outpainting).

---

## Current Capabilities Baseline

The Director currently possesses the following skills:

### 1. Pattern Skills (Multi-Node Workflows)

- [character-generation](file:///Users/mblanc/projects/flowcraft/src/lib/canvas/agent/skills/patterns/character-generation/SKILL.md): Plans a single `t2i` Character Identity Board to lock visual identity (face, clothing, body, silhouette) on a clean background.
- [virtual-tryon](file:///Users/mblanc/projects/flowcraft/src/lib/canvas/agent/skills/patterns/virtual-tryon/SKILL.md): Composites a garment onto a subject using `i2i` and optionally animates it using `i2v`.
- [storyboard](file:///Users/mblanc/projects/flowcraft/src/lib/canvas/agent/skills/patterns/storyboard/SKILL.md): Plans a single `t2i` multi-panel sketch-style storyboard sheet with a designed masthead and director strip.
- [multi-shot-video](file:///Users/mblanc/projects/flowcraft/src/lib/canvas/agent/skills/patterns/multi-shot-video/SKILL.md): Breaks down a narrative/ad into a script, generates parallel reference nodes (character, prop, setting), creates individual `t2i` keyframes, animates them via `i2v`, and joins them via `concat`.

### 2. Primitive Skills (Single-Node Prompt Enrichment)

- [image-generation](file:///Users/mblanc/projects/flowcraft/src/lib/canvas/agent/skills/primitives/image-generation/SKILL.md): Enriches `t2i`/`i2i` prompts using a structured template (SUBJECT, ENVIRONMENT, STYLE & MEDIUM, CHANGES, FORBIDDEN).
- [video-generation](file:///Users/mblanc/projects/flowcraft/src/lib/canvas/agent/skills/primitives/video-generation/SKILL.md): Enriches `t2v`/`i2v`/`i2v2` prompts with motion, camera, and native audio descriptions.
- [music-generation](file:///Users/mblanc/projects/flowcraft/src/lib/canvas/agent/skills/primitives/music-generation/SKILL.md): Enriches `t2m` prompts for short clips or full songs.
- `t2s` / `cinematography`: Enriches text-to-speech voiceovers and camera-movement instructions.

---

## Gap Analysis: Top 10 High-Value Use Cases

Here is how the Director's current capabilities map to the **Top 10 High-Value Use Cases** identified in [genmedia-usecases.md](file:///Users/mblanc/projects/flowcraft/wiki/research/genmedia-usecases.md):

| Rank   | Use Case (from taxonomy)                        | Market Size / Value                       | Current Director Status | Key Gaps & Limitations                                                                                                                                                   |
| :----- | :---------------------------------------------- | :---------------------------------------- | :---------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | **Ad creative at scale (banners, social, DCO)** | **Highest** (Trillion-dollar ad spend)    | **Partially Covered**   | Can generate single ad images/videos, but **cannot plan campaigns at scale** (multi-aspect ratios, audience variants, A/B test multiplication, text overlays).           |
| **2**  | **Marketing/explainer videos**                  | **Very High** (High cost-compression)     | **Partially Covered**   | `multi-shot-video` is optimized for cinematic trailers, not **talking-head/presenter videos** or B-roll/graphics explainer layouts.                                      |
| **3**  | **E-commerce product imagery**                  | **Very High** (Ubiquitous, high volume)   | **Partially Covered**   | Has `virtual-tryon` for clothing, but lacks a pattern for **product staging / packshots** (placing a product photo in a lifestyle scene while preserving branding/text). |
| **4**  | **Gaming asset & content generation**           | **High** (Deep pipelines, high budgets)   | **Partially Covered**   | Can do concept art/characters, but lacks primitives for **3D assets** or **seamless tiling textures / skyboxes**.                                                        |
| **5**  | **Voice synthesis, cloning & dubbing**          | **High** (Structural localization unlock) | **Missing**             | Has basic `t2s` primitive, but **no localization/dubbing pipeline** (translating script, generating matching voiceover, and lip-syncing video).                          |
| **6**  | **Film/TV pre-production & VFX**                | **High** (High value per project)         | **Partially Covered**   | Strong in pre-viz (`storyboard`, `multi-shot-video`), but lacks VFX primitives for **set extension (outpainting)**, **inpainting**, or **compositing**.                  |
| **7**  | **Corporate & e-learning video/training**       | **High** (Quietly enormous L&D budgets)   | **Partially Covered**   | Same gaps as #2 (explainer videos) and #5 (localization) — needs talking-head avatars and slide-to-video conversions.                                                    |
| **8**  | **Architecture & interior visualization**       | **Medium-High** (Virtual staging)         | **Missing**             | Lacks a pattern for **virtual staging** (furnishing empty rooms) or **interior style transfer** while preserving architectural geometry.                                 |
| **9**  | **Music & audio production**                    | **Medium** (Licensing & sound design)     | **Partially Covered**   | Can plan standalone `t2m`/`sfx` nodes, but **cannot mix or overlay them** with video due to a major engine/DAG limitation.                                               |
| **10** | **Synthetic data generation**                   | **Medium-High** (Regulated/niche)         | **Missing**             | Outside the scope of a creative visual canvas.                                                                                                                           |

---

## Proposed New Pattern Skills

To bridge these gaps, we should implement the following **Pattern Skills** in `src/lib/canvas/agent/skills/patterns/`.

### 1. `product-staging` (E-commerce Staging & Packshots)

- **Trigger**: "place this product in a kitchen", "create a lifestyle shot for @ProductImage", "generate a packshot of this bottle on a marble table".
- **Concept**: Takes a raw product photo (cut-out or flat-lay) and generates a photorealistic, beautifully lit lifestyle scene.
- **Workflow**:
    1.  **Phase 0: Product Reference**: Isolate the product and ensure high-detail preservation.
    2.  **Phase 1: Background Generation (`t2i`)**: Generate a high-quality background scene (without the product) using the desired style, lighting, and camera angle.
    3.  **Phase 2: Composite & Relight (`i2i`)**: Blend the product reference into the generated background. The prompt-engineer enforces strict rules:
        - _Preserve_ the product's exact shape, label text, and branding.
        - _Generate_ realistic contact shadows, reflections, and matching light sources (e.g., "cast warm light from the background window onto the left side of the bottle").
    4.  **Phase 3 (Optional) Animation (`i2v`)**: Add subtle movements (water ripples, steam, camera parallax).

### 2. `ad-variant-multiplier` (Dynamic Creative & Scale)

- **Trigger**: "make a campaign pack for this product", "generate social media variants of @AdCreative", "create 9:16, 16:9, and 1:1 ads for this campaign".
- **Concept**: Multiplies a single creative concept into a cohesive multi-channel asset pack.
- **Workflow**:
    1.  **Phase 0: Core Asset Lock**: Establish the subject reference (product, character, or key graphic) and style reference.
    2.  **Phase 1: Multi-Format Generation (`t2i` / `i2i` in parallel)**:
        - Node A: `16:9` Widescreen (YouTube/Desktop) — landscape composition, subject off-center.
        - Node B: `9:16` Vertical (TikTok/Reels) — vertical composition, subject centered.
        - Node C: `1:1` Square (Instagram Feed) — tight crop, subject prominent.
    3.  **Phase 2: Audience/Theme Variations**: Generate variants with different background settings or copy overlays targeted at different demographics (e.g., "corporate office background" vs. "outdoor nature background").

### 3. `avatar-presenter-video` (Explainer & L&D Video)

- **Trigger**: "make an explainer video with a presenter reading this script", "generate an avatar video for this training course", "create a talking-head video".
- **Concept**: Generates a synthetic talking-head presenter synchronized with a voiceover and script.
- **Workflow**:
    1.  **Phase 0: Presenter Reference**: Generate/select a high-quality presenter character sheet.
    2.  **Phase 1: Script & Voiceover (`t2s`)**: Generate the speech audio node from the user's text.
    3.  **Phase 2: Video Generation (`t2v` or `i2v` + `lip-sync`)**: Generate a video of the presenter. In the current engine, this would require a specialized `lip-sync` or `avatar-generate` primitive that takes the presenter image and the `t2s` audio, generating a lip-synced talking video.
    4.  **Phase 3: B-Roll overlay**: Overlay background graphics or B-roll slides at key timestamps.

### 4. `video-localization-dubbing` (Translation & Dubbing)

- **Trigger**: "translate this video to Spanish", "dub @VideoNode in French", "localize this ad for the Japanese market".
- **Concept**: Takes an existing video and translates/dubs it while maintaining the speaker's voice and lip-sync.
- **Workflow**:
    1.  **Phase 1: Transcription/Translation**: Translate the original script.
    2.  **Phase 2: Voice Cloning (`t2s`)**: Generate a translated voiceover using a voice-cloning model that matches the original speaker's tone.
    3.  **Phase 3: Video Dubbing / Lip-Sync**: Apply the new audio track to the video, running a lip-sync model to adjust the speaker's mouth movements to match the new language.

### 5. `virtual-staging-interior` (Real Estate & Interior Design)

- **Trigger**: "stage this empty room photo", "render this room sketch in Scandinavian style", "change the furniture in @RoomImage to mid-century modern".
- **Concept**: Furnishes empty spaces or transfers interior design styles while keeping the architectural shell intact.
- **Workflow**:
    1.  **Phase 0: Architectural Shell Reference**: Lock the walls, windows, doors, and perspective of the source image.
    2.  **Phase 1: Style/Furniture Placement (`i2i`)**: Generate furniture and decor in the specified style, aligned to the room's perspective.
    3.  **Phase 2: Lighting & Shadow Matching**: Enforce realistic shadows from the room's windows and light fixtures.

---

## Architectural & Engine Upgrades (Missing Primitives)

To support these advanced patterns, the underlying canvas engine and primitive set need three critical upgrades:

### 1. Multi-Track Audio-Video Mixing

- **The Problem**: Currently, the Director has a strict constraint: **"Video/image generation nodes cannot accept or use audio, speech, or music nodes as references or dependencies. Video nodes generate their own audio..."** (from [prompts.ts](file:///Users/mblanc/projects/flowcraft/src/lib/canvas/agent/prompts.ts#L77-L81)). The `concat` node only joins video clips; it cannot mix separate audio tracks. This makes it impossible to create a video with a background music track and a separate voiceover.
- **The Solution**: Introduce an **`audio-video-mix`** or **`mix`** primitive operation.
    - This node would accept a video sequence (e.g., from a `concat` or `i2v` node) and one or more audio nodes (`t2s`, `t2m`, `sfx`) as inputs.
    - It would allow the Director to specify a timeline mixing sheet (e.g., "music at -18dB, voiceover at -3dB starting at 0s, sound effect at 4.5s").
    - _DAG Representation_:
        ```mermaid
        graph TD
            V1[Shot 1 Video] --> C[Concat]
            V2[Shot 2 Video] --> C
            VO[Voiceover T2S] --> M[Audio-Video Mix]
            BG[Background Music T2M] --> M
            C --> M
            M --> FC[Final Composite Video]
        ```

### 2. Precision Editing Primitives (`inpainting`, `outpainting`, `relighting`)

- **The Problem**: The Director only has `i2i` (image-to-image), which is a "black box" that often redraws the entire image, leading to style drift or loss of detail.
- **The Solution**: Introduce specialized editing primitives:
    - **`inpaint`**: Modifies a specific region of an image defined by a mask or text description (e.g., "replace the mug with a glass"), leaving the rest of the image untouched.
    - **`outpaint` (Set Extension)**: Extends the canvas boundaries (e.g., converting 1:1 to 16:9) and fills in the new areas in a way that is structurally and stylistically continuous.
    - **`relight`**: Alters the light sources and shadow directions on an existing subject/scene without changing the geometry.

### 3. Lip-Sync / Avatar Animation Primitive (`lip-sync`)

- **The Problem**: Generating talking videos requires synchronizing a static face or existing video with an audio file.
- **The Solution**: A **`lip-sync`** primitive that takes an image/video input and an audio input, and outputs a video with the mouth movements synchronized to the audio.

---

## Conclusion & Next Steps

By expanding the Director's skill set in these directions, Flowcraft can evolve from a creative sandbox into a highly defensible, enterprise-grade production tool.

If we want to implement these:

1.  **Short-term**: We can author new Pattern Skills (like `product-staging` and `ad-variant-multiplier`) using the existing `t2i` and `i2i` primitives by writing highly descriptive prompt-engineering templates that enforce style/subject locks.
2.  **Medium-term**: We should implement the `audio-video-mix` primitive and update the backend execution engine (`src/lib/canvas/generation.ts`) to support mixing audio tracks via tools like `ffmpeg` or cloud APIs.
3.  **Long-term**: We should integrate specialized model capabilities like inpainting, outpainting, and lip-syncing as first-class primitives in the registry.
