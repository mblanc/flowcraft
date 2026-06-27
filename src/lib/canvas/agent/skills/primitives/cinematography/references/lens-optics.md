---
name: lens-optics
description: Exhaustive lens and optics reference — focal length, aperture, depth of field, bokeh, lens types, optical effects, and camera/format vocabulary. Applies to both images and videos. Populates the STYLE & MEDIUM section of image prompts and camera specs in video prompts.
---

## Lens & Optics

Lens choice is as expressive as framing. Always specify focal length, aperture, and any optical characteristics that affect the look. Use real lens names and camera bodies when photorealism is required.

---

### Focal Length

Focal length controls field of view, perspective distortion, and background compression. All values assume a full-frame (35mm) sensor.

| Category           | Range            | Visual character                                                                  |
| ------------------ | ---------------- | --------------------------------------------------------------------------------- |
| Fisheye            | 4–10mm           | Extreme barrel distortion, hemispherical field of view, all edges curve           |
| Ultra-wide         | 14–18mm          | Significant distortion at edges, exaggerated depth, environmental immersion       |
| Wide               | 24–28mm          | Moderate distortion, deep depth of field, expansive feel, environmental context   |
| Mild wide          | 35mm             | "Street photography" lens, slight wide feel, natural-looking perspective          |
| Standard / normal  | 50mm             | Closest to human eye perspective, no distortion, neutral and documentary          |
| Short telephoto    | 85mm             | Slight compression, flattering for portraits, gentle background separation        |
| Portrait telephoto | 105–135mm        | Noticeable compression, subject isolated from background, beautiful bokeh         |
| Long telephoto     | 200–300mm        | Heavy compression, background fills frame, layers stack close together            |
| Super telephoto    | 400–600mm        | Extreme compression, very shallow DOF, requires stabilization or tripod           |
| Macro              | 60–100mm (macro) | 1:1 reproduction ratio, extreme close focus, defocused background at any aperture |

**Perspective distortion rules:**

- Wide lenses (14–28mm) exaggerate distance — foreground looms, background recedes.
- Telephoto lenses (135mm+) compress distance — foreground and background appear at similar scale.
- Standard (50mm) is neutral — use when distortion would feel unnatural.

---

### Aperture & Depth of Field

Aperture controls how much of the image is in sharp focus.

| f-stop      | Depth of field                                              | Typical use                                                 |
| ----------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| f/1.0–f/1.2 | Razor-thin — only millimeters in focus                      | Extreme subject isolation, dreamy, highly cinematic         |
| f/1.4–f/1.8 | Very shallow — only the subject plane                       | Portrait bokeh, low-light, subject isolated from background |
| f/2.0–f/2.8 | Shallow — subject sharp, background clearly blurred         | Standard cinematic, most portrait work                      |
| f/4.0       | Moderate — small group in focus, background still soft      | Environment slightly readable, subject still dominant       |
| f/5.6–f/8.0 | Deep — most of the scene in focus                           | Landscape, editorial, product, documentary                  |
| f/11–f/16   | Very deep — near-infinite depth                             | Architectural, landscape, everything sharp                  |
| f/22+       | Diffraction limit — everything in focus but slight softness | Extreme landscape, technical, rarely used creatively        |

**Prompt vocabulary:**

- "Shot wide open at f/1.4, razor-thin depth of field, background melts to smooth bokeh."
- "Stopped down to f/8, deep focus throughout, full environment visible and sharp."
- "f/2.8, subject sharp, background recognizable but softly defocused."

---

### Bokeh

The quality of out-of-focus areas is determined by lens design and aperture shape.

| Bokeh type            | Description                                                       | Associated lens/format                          |
| --------------------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| Smooth / creamy       | Soft, gradual, featureless circles of confusion                   | Fast prime lenses (f/1.4–f/1.8), 85–135mm       |
| Circular / neutral    | Round, even disc shapes                                           | Most modern spherical lenses                    |
| Swirly / Petzval      | Background rotates in a swirling vortex pattern                   | Vintage Petzval lenses, Lomography              |
| Oval / cat-eye        | Elongated elliptical bokeh discs at frame edges                   | Anamorphic lenses                               |
| Hexagonal / octagonal | Geometric shaped discs, distinct aperture blade pattern           | Stopped-down lenses, older designs              |
| Busy / nervous        | Distracting, high-contrast double edges                           | Some telephoto zoom lenses                      |
| Soap bubble           | Distinct ring outline on bokeh discs                              | Trioplan, Helios, certain vintage optics        |
| Halation              | Bright highlight areas bloom and spread into surrounding darkness | Older coatings, vintage glass, Pro-Mist filters |

---

### Lens Types

| Lens type          | Character                                                              | Prompt vocabulary                                                                   |
| ------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Modern spherical   | Clean, sharp, neutral, corrected distortion                            | "Modern sharp prime, no distortion, clean rendering"                                |
| Vintage / uncoated | Flare-prone, lower contrast, glowing highlights, character             | "Vintage uncoated glass, reduced contrast, glowing highlights around light sources" |
| Anamorphic         | 2:1 squeeze, horizontal lens flares (blue), oval bokeh, wider aspect   | "Anamorphic lens, horizontal blue lens flare, oval bokeh, letterboxed 2.39:1"       |
| Tilt-shift         | Selective focus plane, architectural correction, miniature effect      | "Tilt-shift lens, focus plane tilted, selective blur creating miniature effect"     |
| Macro              | Extreme close focus, high magnification                                | "Macro lens, 1:1 magnification, extreme subject detail, defocused surroundings"     |
| Fisheye            | Hemispherical, extreme barrel distortion                               | "Fisheye lens, extreme barrel distortion, curved horizon"                           |
| Cine lens          | No breathing, smooth focus throw, geared manual focus, cinema standard | "Cinema prime, no focus breathing, smooth rack focus"                               |

---

### Optical Effects & Filters

| Effect               | Description                                                       | Prompt vocabulary                                                                           |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Lens flare           | Light hitting glass elements, creates artifacts                   | "Anamorphic horizontal blue lens flare across frame", "hexagonal flare from practical lamp" |
| Vignette             | Darkening at frame edges, draws eye to center                     | "Subtle dark vignette at corners", "heavy lens vignette"                                    |
| Chromatic aberration | Color fringing at high-contrast edges (red/cyan, or purple/green) | "Slight chromatic aberration at edges, vintage feel", "purple fringing on backlit subjects" |
| Diffusion / glow     | Soft filter reduces contrast, halates highlights                  | "Black Pro-Mist 1/4 filter, halated highlights, slightly softened overall"                  |
| Film halation        | Light bleeds from bright areas into dark emulsion layers          | "Film halation, highlights bloom orange-red into shadow edges"                              |
| Streak filter        | Star or streak patterns from point lights                         | "Star filter on practical lights, 4-point star streaks"                                     |
| Infrared             | Foliage becomes white, skies dark, surreal tones                  | "Infrared photography look, white foliage, dark blue sky, glowing landscape"                |
| Double exposure      | Two images composited in-camera                                   | "Double exposure, ghosted second image overlaid at 40% opacity"                             |

---

### Camera Bodies & Film Formats

Naming a real camera body adds specificity to photorealistic prompts.

| Category                         | Examples                                                       | Character                                                          |
| -------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| Full-frame digital (photography) | Sony A7R V, Canon EOS R5, Nikon Z9, Leica M11                  | High resolution, clean at high ISO, neutral rendering              |
| Medium format digital            | Hasselblad X2D, Fujifilm GFX 100S, Phase One                   | Extreme detail, slight 3D "pop", shallow DOF at any aperture       |
| Cinema camera                    | ARRI Alexa 35, RED Komodo, Sony VENICE 2, Blackmagic URSA      | Wide dynamic range, cinema color science, gentle highlight rolloff |
| Film — 35mm                      | Kodak Vision3 500T, Fuji Eterna 500, Kodak Portra 400 (stills) | Organic grain, gentle color, latitude, nostalgic register          |
| Film — 16mm                      | Kodak Vision3 200T, Super 16mm                                 | More visible grain, slightly softer, indie/documentary             |
| Film — 65mm / IMAX               | Kodak Vision3 (65mm), IMAX 15-perf                             | Extreme detail, very fine grain, epic scale                        |
| Film — Super 8                   | Kodak Tri-X, Ektachrome 100D                                   | Heavy grain, warm colors, home movie register, faded               |

**Prompt examples using camera specs:**

- "Shot on ARRI Alexa 35, Leica Summicron-C 75mm T2, wide open. Cinema color science, gentle highlight rolloff."
- "35mm film, Kodak Portra 400, Canon EF 50mm f/1.4, shot at f/2. Fine grain visible, warm skin tones."
- "Hasselblad X2D, 90mm lens, f/2.8. Medium format 3D pop, extremely fine detail, creamy smooth bokeh."
- "Super 8 film, Kodak Ektachrome 100D. Heavy grain, warm faded colors, home movie feel, slight light leak at edges."

---

### Depth of Field Prompt Construction

Combine camera + focal length + aperture + subject distance for precise DOF specification:

- "85mm lens, f/1.4, subject at 2m — sharp focus on eyes only, ears and nose already soft."
- "24mm lens, f/8, landscape subject at 5m — near-infinite depth of field, everything from 1m to horizon sharp."
- "200mm telephoto, f/2.8, subject at 10m — heavy background compression, bokeh balls from distant lights."
- "Macro 100mm, f/4, subject at 30cm — only 5mm plane in focus, fore and background equally blurred."

---

### ask_user guidance for lens/optics

When depth of field or lens character is ambiguous and would materially change the image:

- "Shallow bokeh portrait feel" vs. "everything in sharp focus"
- "Wide environmental lens" vs. "compressed telephoto isolation"
- "Clean modern sharp" vs. "vintage character with flares and aberration"
- "Cinematic anamorphic" vs. "standard spherical"
