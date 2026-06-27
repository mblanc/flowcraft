---
name: color-grading
description: Exhaustive color grading reference — named looks, shadow/highlight treatment, saturation styles, film stock emulations, era-specific grades, genre-specific palettes, and color contrast techniques. Applies to both images and videos.
---

## Color Grading

Color grading defines the emotional and stylistic register of an image beyond subject and lighting. Always specify grading explicitly — unspecified color produces neutral, unintentional results.

Describe grading across three channels: **shadows**, **midtones**, and **highlights**, plus overall **saturation** and **contrast**.

---

### Named Cinematic Looks

| Look                      | Description                                                                       | Prompt vocabulary                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Teal-orange blockbuster   | Warm skin tones pushed orange, shadows and backgrounds pushed teal, high contrast | "Teal-orange grade: warm orange skin tones, teal shadows, high contrast, crushed blacks"              |
| Bleach bypass             | Silver halide retained in processing, desaturated, high contrast, gritty          | "Bleach bypass look, desaturated muted colors, high contrast, lifted blacks, silver grain overlay"    |
| Cross-processed           | Film developed in wrong chemistry, unusual color shifts, cyan shadows, saturated  | "Cross-processed look, cyan-green shadows, red-orange highlights, oversaturated, unpredictable color" |
| Day-for-night             | Daytime footage graded to appear nighttime                                        | "Day-for-night grade, heavy blue cast, crushed shadows, lifted only by blue ambient"                  |
| Desaturated cold thriller | Minimal saturation, cool color temperature throughout, clinical                   | "Desaturated cold grade, near-monochrome, blue-grey midtones, no warm tones anywhere"                 |
| Warm nostalgia / vintage  | Lifted blacks (faded), warm orange/yellow cast, reduced contrast, aged            | "Warm nostalgic grade, lifted shadows, orange-yellow cast, faded low contrast look, vintage"          |
| High contrast noir        | Near-black shadows, near-white highlights, minimal midtones                       | "High contrast noir, crushed blacks, blown-out highlights, minimal midtone information"               |
| Faded indie / matte       | Blacks lifted to grey, low contrast, often cool or desaturated                    | "Faded matte look, lifted blacks to dark grey, low contrast, desaturated midtones"                    |
| Cyberpunk neon            | Deep crushed blacks, vivid saturated neon colors (cyan, magenta, purple)          | "Cyberpunk grade, crushed blacks, vivid neon cyan and magenta, high saturation, dark environment"     |
| Horror desaturated green  | Cool green cast throughout, flesh tones grey-green, low saturation                | "Horror green cast, desaturated flesh tones, green-grey midtones, oppressive low saturation"          |
| Western / dusty           | Warm amber-brown cast, desaturated cool colors, muted, dusty                      | "Western grade, warm amber-brown cast, muted cool tones, dusty desaturated look, faded midtones"      |
| Sci-fi cold blue          | Cool blue throughout, clean, clinical, high contrast                              | "Sci-fi cold blue grade, blue-white highlights, dark cool shadows, clean high contrast"               |
| Romance / warm soft       | Warm highlights, lifted shadows, gentle low contrast, skin tones rich             | "Romantic warm grade, lifted warm shadows, glowing highlights, rich skin tones, soft contrast"        |
| Documentary / natural     | Neutral, accurate, minimal processing                                             | "Documentary natural grade, neutral color balance, accurate skin tones, minimal processing"           |

---

### Shadow Treatment

Shadows define the black point and color tint in dark areas.

| Treatment                   | Description                                                   | Prompt vocabulary                                                     |
| --------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| Crushed blacks              | Blacks at absolute zero, deep dense dark areas, high contrast | "Crushed blacks, pure black shadows, no shadow detail"                |
| Lifted blacks (matte/faded) | Black point raised to grey, low contrast, faded vintage look  | "Lifted blacks, matte shadow grade, faded blacks raised to dark grey" |
| Clean blacks                | True black with no color cast, just dark neutral              | "Clean neutral blacks, accurate shadow rendering"                     |
| Warm shadows                | Brown, amber, or orange tint in shadow areas                  | "Warm amber-tinted shadows, brown shadow cast"                        |
| Cool shadows                | Blue or teal tint in dark areas                               | "Cool blue shadows, teal tinted blacks"                               |
| Green shadows               | Green cast in shadows, sickly or horror register              | "Green-tinted shadows, desaturated flesh in shadow areas"             |
| Purple/violet shadows       | Rich, stylized, fashion or music video register               | "Purple-violet shadow tint, deep colored blacks"                      |

---

### Highlight Treatment

Highlights define how bright areas are rendered.

| Treatment          | Description                                             | Prompt vocabulary                                                        |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Clipped / blown    | Highlights exceed exposure and clip to pure white       | "Blown highlights, clipped whites, overexposed bright areas"             |
| Rolled-off         | Highlights compress gradually, no hard clipping, filmic | "Gentle highlight rolloff, filmic shoulder, no clipping in bright areas" |
| Warm highlights    | Orange, yellow, or gold cast in bright areas            | "Warm golden highlights, orange-tinted bright areas"                     |
| Cool highlights    | Blue-white or cyan tint in bright areas                 | "Cool blue-white highlights, cyan cast in specular areas"                |
| Halated highlights | Bright areas bleed and glow into surrounding darks      | "Halated glowing highlights, light blooming into shadows"                |
| Creamy / soft      | Highlights feel luxurious, gradual, no harshness        | "Creamy soft highlights, luxurious gentle exposure in bright areas"      |

---

### Saturation Styles

| Style                     | Description                                           | Prompt vocabulary                                                        |
| ------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------ |
| Hyper-saturated           | All colors pushed to vivid maximum                    | "Hyper-saturated, vivid high-chroma colors throughout"                   |
| Naturally saturated       | Pleasing real-world color richness, not pushed        | "Naturally saturated, rich accurate colors, pleasing but not artificial" |
| Muted / desaturated       | Colors reduced in chroma, closer to grey              | "Muted desaturated colors, reduced chroma, painterly restraint"          |
| Near-monochrome           | Almost no color, only trace saturation remains        | "Near-monochrome, trace color only, almost black-and-white"              |
| Selective saturation      | One color retained vivid, rest desaturated            | "Selective color: only reds are saturated, everything else grey-brown"   |
| Skin-accurate, rest muted | Flesh tones remain warm while environment desaturates | "Skin tones accurate and warm, environment desaturated cool"             |

---

### Contrast Styles

| Style           | Description                                             | Prompt vocabulary                                                      |
| --------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| High contrast   | Wide range from deep black to bright white, punchy      | "High contrast, punchy tonal range, deep blacks and bright whites"     |
| Low contrast    | Narrow tonal range, everything in midtone zone, soft    | "Low contrast, narrow tonal range, flat midtone-dominant image"        |
| S-curve         | Shadows darker, highlights brighter, midtones preserved | "S-curve contrast, enhanced shadows and highlights, rich midtones"     |
| Flat / log-like | Intentionally flat, no contrast, requires grading       | "Flat log-like exposure, no contrast, full tonal information retained" |

---

### Film Stock Emulations

| Film                   | Character                                                         | Prompt vocabulary                                                                        |
| ---------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Kodak Portra 400       | Warm skin tones, fine grain, excellent latitude, pleasing shadows | "Kodak Portra 400 emulation, warm skin, fine grain, gentle shadow rendering"             |
| Kodak Portra 800       | Like 400 but more grain, pushed-film look                         | "Kodak Portra 800, visible grain, pushed warm tones, slight fading"                      |
| Kodak Ektar 100        | High saturation, fine grain, cool-ish, vivid landscapes           | "Kodak Ektar 100, highly saturated, fine grain, vivid deep colors"                       |
| Fujifilm Velvia 50     | Extremely high saturation, deep shadows, intense color            | "Fuji Velvia 50, hyper-saturated, intense deep colors, punchy shadows"                   |
| Fujifilm Provia 100F   | Neutral, accurate, professional slide film                        | "Fuji Provia 100F, neutral accurate color, fine grain, clean professional rendering"     |
| Kodak Vision3 500T     | Cinema film, balanced for tungsten, fine grain, wide latitude     | "Kodak Vision3 500T cinema film, balanced warm tones, fine organic grain"                |
| Ilford HP5             | Classic B&W, moderate grain, versatile, pushes well               | "Ilford HP5 black and white, moderate grain, wide tonal range"                           |
| Kodak Tri-X 400        | B&W, more grain than HP5, higher contrast, gritty                 | "Kodak Tri-X 400 black and white, visible grain, higher contrast, gritty street feel"    |
| Fuji Instax / Polaroid | Faded, warm, low contrast, dreamy, instant film                   | "Polaroid instant film look, faded colors, warm cast, dreamy low contrast, white border" |
| Super 8 Ektachrome     | Warm, saturated, heavy grain, home movie                          | "Super 8 Ektachrome, warm saturated colors, heavy grain, home movie register"            |
| Lomochrome             | Unusual color remapping, greens to purple/magenta                 | "Lomochrome Purple, green foliage shifted to magenta-purple, unusual remapped palette"   |

---

### Era-Specific Grades

| Era                   | Characteristics                                            | Prompt vocabulary                                                                        |
| --------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Silent film / 1920s   | Sepia or hand-tinted, high contrast, film damage           | "Silent film look, sepia-toned, high contrast, film scratches and grain"                 |
| 1940s–50s Technicolor | Vivid saturated primary colors, slightly unrealistic, lush | "Three-strip Technicolor look, vivid saturated reds and greens, lush unnatural colors"   |
| 1960s psychedelic     | Oversaturated, warm, high contrast, blown-out              | "1960s psychedelic, oversaturated warm colors, blown highlights, vivid poster aesthetic" |
| 1970s New Hollywood   | Warm amber-brown, desaturated blues and greens, film grain | "1970s New Hollywood grade, warm brown-amber cast, muted blues, visible 35mm grain"      |
| 1980s                 | Warm, slightly faded, high saturation in midtones, VHS-era | "1980s grade, warm faded look, slightly high saturation, mild VHS softness"              |
| 1990s music video     | Cool blue-green, high contrast, digital post feel          | "1990s music video grade, cool blue-green cast, high contrast, slightly crushed shadows" |
| 2000s film            | Teal-green shadows, warm highlights, transitional digital  | "Early 2000s grade, teal-green shadow cast, warm highlights, transitional look"          |
| 2010s blockbuster     | Heavy teal-orange, high contrast, digital precision        | "2010s blockbuster teal-orange, heavy color separation, high contrast, digital clean"    |
| Contemporary / clean  | Natural, neutral, minimal grading, current standard        | "Contemporary minimal grade, accurate neutral color, clean shadow rendering, modern"     |

---

### Genre-Specific Palette Guide

| Genre                | Recommended grade                                                          |
| -------------------- | -------------------------------------------------------------------------- |
| Horror               | Desaturated cool green, crushed blacks, cold skin tones, no warmth         |
| Thriller             | Cold blue-grey, desaturated, clinical, high contrast                       |
| Action / blockbuster | Teal-orange, high contrast, punchy, warm skin against cool environment     |
| Romance              | Warm lifted shadows, soft highlights, rich skin tones, gentle low contrast |
| Sci-fi               | Cold blue or neon-saturated cyberpunk, crushed blacks, clinical or vivid   |
| Western              | Warm amber-brown, dusty muted cool tones, faded contrast                   |
| Documentary          | Natural neutral, accurate, minimal processing                              |
| Period drama         | Warm desaturated, aged, slightly faded, appropriate to era                 |
| Comedy               | High-key, warm, clean, saturated, no heavy contrast                        |
| Musical              | Vivid Technicolor saturation, theatrical warmth, lush midtones             |

---

### Prompt construction examples

- "Teal-orange blockbuster grade: skin tones pushed warm orange, shadows and environment pushed teal. Crushed blacks. High contrast S-curve. Kodak Vision3 grain overlay."
- "Warm nostalgic grade: lifted blacks to dark grey, orange-yellow cast throughout, faded low contrast, Kodak Portra 400 emulation."
- "Near-monochrome cold thriller: blue-grey desaturated midtones, crushed blacks, barely any saturation. Only the single red object retains full chroma."
- "Cyberpunk neon: crushed blacks to pure zero, vivid cyan and magenta neon saturated, purple-violet shadow tint, high contrast."
- "1970s New Hollywood: warm brown-amber cast, muted desaturated blues, visible 35mm grain, gentle highlight rolloff, lifted shadow slightly."
