---
name: lighting
description: Exhaustive lighting reference for image and video prompts — light source types, setups, direction, quality, color temperature, time-of-day conditions, and motivated vs. practical lighting. Applies to both images and videos.
---

## Lighting

Always name every light source by type, direction, and quality. Never describe lighting by mood ("cinematic lighting", "dramatic", "moody", "beautiful light") — these produce inconsistent results and override the model's knowledge with noise.

---

### Light Source Types

| Source                         | Prompt vocabulary                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| Tungsten / incandescent        | Warm tungsten lamp, orange-amber cast, 2700–3200K                                        |
| Fluorescent                    | Cool fluorescent overhead, green-tinted white light, flat and even                       |
| HMI / daylight-balanced        | Daylight-balanced HMI, clean neutral 5600K, harsh shadows                                |
| LED panel                      | Soft LED panel, adjustable color temperature, minimal falloff                            |
| Neon tube                      | Neon sign glow, saturated colored fill, hard specular, no diffusion                      |
| Practical (in-frame)           | Practical lamp visible in frame, motivated warm point source, small light radius         |
| Candle / fire                  | Candle flame, flickering amber point source, very warm 1800K, deep falloff               |
| Street lamp / sodium vapor     | Sodium vapor street lamp at [clock position], orange-yellow cast, pooled light on ground |
| Moonlight                      | Diffuse blue-white moonlight from above, cool 7000K+, soft shadows                       |
| Computer / screen light        | Screen glow from below/front, cool blue-green cast, low intensity fill                   |
| Flash / strobe                 | Hard front flash, flat even exposure, shadow behind subject, paparazzi register          |
| Bioluminescence / practical FX | Glowing object as only source, saturated colored ambient, high contrast surroundings     |

---

### Lighting Setups

| Setup                      | Description                                                                                                      | Use when                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 3-point (key + fill + rim) | Key from 45° front, fill from opposite side at 50% intensity, rim from behind separating subject from background | Neutral, professional, controlled    |
| Key light only             | Single dominant source, deep shadows on unlit side                                                               | Dramatic, high-contrast, noir        |
| Rembrandt                  | Key at 45° above, triangle of light on shadowed cheek                                                            | Portrait intimacy, Old Masters look  |
| Split lighting             | Key directly to one side, 90° from camera — face split 50/50 light/shadow                                        | High drama, duality, tension         |
| Butterfly / Paramount      | Key directly above and in front, shadow falls under nose like butterfly wings                                    | Glamour, 1940s Hollywood, beauty     |
| Loop lighting              | Key slightly above eye level, 30–45° to side, small shadow loops from nose                                       | Most common portrait, flattering     |
| Broad lighting             | Key on the side of face turned toward camera — more face illuminated                                             | Commercial, accessible, open         |
| Short lighting             | Key on the side of face turned away from camera — less face illuminated                                          | Slimming, moody, editorial           |
| Backlight / rim light only | Light source behind subject, separating from background, no fill                                                 | Silhouette, atmospheric, ethereal    |
| Kicker / hair light        | Secondary light from behind at low angle, adds edge definition                                                   | Depth, separation from background    |
| Practicals only            | Only in-frame light sources illuminate the scene, no invisible lights                                            | Naturalistic, location feel, realism |
| Motivated lighting         | All lights appear to come from visible or implied sources in the scene                                           | Realistic, immersive, grounded       |
| Non-motivated lighting     | Lights exist without story justification                                                                         | Stylized, theatrical, expressionist  |
| Chiaroscuro                | Extreme contrast, large dark areas, single strong key, minimal fill                                              | Baroque, noir, psychological drama   |
| High-key                   | Bright, even, low contrast, minimal shadows                                                                      | Comedy, commercial, optimistic       |
| Low-key                    | Dark, high contrast, heavy shadows                                                                               | Thriller, horror, drama              |

---

### Light Direction

| Direction                     | Clock position              | Visual effect                                |
| ----------------------------- | --------------------------- | -------------------------------------------- |
| Front / flat                  | 12 o'clock, camera-adjacent | Reduces texture and depth, even exposure     |
| 45° front-side (standard key) | 10–11 or 1–2 o'clock        | Natural, flattering, dimensional             |
| Side (90°)                    | 9 or 3 o'clock              | Strong shadow half, maximum texture          |
| 45° rear-side (kicker)        | 7–8 or 4–5 o'clock          | Edge definition, separation                  |
| Backlight (180°)              | 6 o'clock, directly behind  | Silhouette or halo, no fill detail           |
| Above (top light)             | Straight down               | Harsh under-eye shadows, ominous             |
| Below (underlighting)         | Straight up                 | Horror register, unnatural                   |
| Diagonal high-side            | 10 o'clock high             | Rembrandt/loop, most natural sunlight analog |

---

### Light Quality

| Quality  | Description                                                                    | How to specify                                                  |
| -------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Hard     | Point source, small relative to subject, sharp-edged defined shadows           | "Hard point source", "sharp cast shadows", "crisp shadow edges" |
| Soft     | Large source relative to subject, diffused, shadows have wide gradual penumbra | "Soft diffused wrap", "broad source", "gentle shadow falloff"   |
| Specular | Produces bright highlights and reflections on shiny surfaces                   | "Specular highlight on [material]"                              |
| Diffused | Passed through diffusion material (silk, bounce, overcast sky)                 | "Diffused through a silk scrim", "bounced off a white card"     |
| Bounced  | Reflected off a surface, becomes soft and directional                          | "Bounced off a warm plaster wall from camera right"             |

---

### Color Temperature

| Kelvin      | Description                        | Prompt vocabulary                                           |
| ----------- | ---------------------------------- | ----------------------------------------------------------- |
| 1800–2000K  | Candle / fire                      | "Candle-warm amber glow", "fire-lit, deep orange cast"      |
| 2700–3200K  | Tungsten / incandescent            | "Warm tungsten, orange-amber fill", "practical lamp warmth" |
| 3500–4100K  | Warm white LED / early sunrise     | "Warm neutral interior light"                               |
| 5000–5600K  | Daylight / flash / HMI             | "Neutral daylight, no color cast", "balanced 5600K key"     |
| 6500K       | Overcast sky / shade               | "Cool overcast light, slight blue cast, no shadows"         |
| 7000–10000K | Deep shade / blue hour / moonlight | "Cool blue-white moonlight", "deep shade, heavy blue cast"  |

Mixed color temperatures create visual tension — specify both:

- "Warm tungsten practical (2800K) in foreground, cool blue moonlight (6500K) through window in background."

---

### Time of Day / Natural Conditions

| Condition               | Description                                       | Prompt vocabulary                                                                    |
| ----------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Golden hour             | 30–60 min after sunrise or before sunset          | "Warm low-angle golden sunlight from the right, long soft shadows, 2700K fill"       |
| Magic hour              | Final minutes before sunset, sky deep orange/pink | "Deep magenta-orange sky, sun at horizon level, saturated warm key"                  |
| Blue hour               | 20–30 min after sunset or before sunrise          | "Blue hour exterior, cool 7000K ambient, no direct sun, deep desaturated shadows"    |
| Overcast / cloudy       | Clouds act as giant diffusion box                 | "Overcast sky as source, soft even light from above, no shadows, 6500K"              |
| Midday / harsh sun      | Direct overhead sun, hard unforgiving shadows     | "Harsh overhead sun at 90°, sharp shadows straight down, bleached highlights"        |
| Night / artificial only | No ambient, only practical and street lights      | "Night exterior, only practical sodium vapor street lamp, everything else dark"      |
| Interior day (window)   | Natural light coming through windows              | "North-facing window light from camera left, soft 5600K, gentle falloff across room" |
| Dusk / twilight         | After blue hour, sky almost dark                  | "Near-dark sky, last ambient light, equal sky/practical balance"                     |
| Fog / haze              | Atmospheric scatter, volumetric                   | "Fog diffusing all sources, visible light shafts, contrast reduced by atmosphere"    |
| Overcast winter         | Low flat light, cool shadows, no warmth           | "Cold overcast winter light, 6000K, flat even illumination, muted shadows"           |

---

### Prompt construction examples

- "Warm tungsten key at 45° camera left (3000K), no fill, deep shadow on right half, hard edge. Single practical desk lamp visible in frame."
- "Soft diffused daylight through north-facing window, 5600K, gentle falloff. No artificial sources. Overcast sky as source."
- "Rembrandt setup: key at 45° high camera right, triangle of light on left cheek. Warm amber, 2800K. No fill. Dark background."
- "Split lighting: hard neon blue source at 90° camera left, hard neon red source at 90° camera right. Both 100% intensity. No fill."
- "Golden hour exterior: warm low-angle sunlight from camera right at 10° above horizon, long soft shadows left, 2700K fill from sky."
- "Night interior: practical floor lamp (amber, 2500K) as only source. Everything beyond 2m falls to near-black. Heavy vignette."
