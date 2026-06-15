# Brand Validation & Policy Enforcement

Brainstorm for enforcing brand guidelines, channel rules, and custom policies during canvas media generation.

---

## The Core Tension

There are two fundamentally different enforcement mechanisms:

**Preventive** — inject rules into prompts and hope the model follows them.
What Canvas Instructions / `style.md` does today. Works for mood, tone, aesthetic. Unreliable for precise constraints.

**Detective** — generate → validate → fix if needed.
A "Brand Guard" that checks output against rules and triggers a correction loop. New capability, needed for rules that actually matter.

You need both: preventive for everything, detective for rules where failure has real cost.

---

## Rule Taxonomy

| Category                      | Examples                                                                | Enforcement mechanism                                                     |
| ----------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Dimensional** (hard, exact) | 1200×628px, 9:16, 300dpi, safe zone margins                             | Programmatic — check image metadata, no model needed                      |
| **Visual** (semi-hard)        | Color palette compliance, logo presence, safe space, no text near edges | Vision model — "Does this image have the logo in the top-right quadrant?" |
| **Qualitative** (soft)        | Brand mood ("warm and aspirational"), tone, style consistency           | LLM-as-judge — evaluate against brand description                         |

---

## Failure Handling Strategies

**1. Auto-correct (silent)**
For dimensional rules — fix it post-generation. Wrong aspect ratio → crop/resize to spec. No regeneration needed. Fast, zero friction.

**2. Regenerate with feedback (silent retry)**
For visual/qualitative rules — send the violation back to the prompt engineer: "Previous generation failed: logo missing from top-right. Regenerate with explicit placement instruction." Up to N retries, then escalate.

**3. Surface to user (manual review)**
For stubborn failures after retries, or for high-stakes rules. Show the generated image + the specific violation + options: Accept anyway / Regenerate / Edit rule. Also the right path when a rule conflicts with the user's explicit prompt — let the user decide which wins.

**Hybrid approach**: Auto-retry once silently. If still failing, surface it. Keep an "Accept anyway" escape hatch always available.

---

## Brand Profile Data Model

```
brandProfiles/{id}:
  name: "Acme Corp Brand 2025"
  colors:
    palette: [{ hex: "#FF3B00", name: "Primary Red", tolerance: 15 }]
    allowedBackgrounds: ["#FFFFFF", "#000000"]
  typography:
    fonts: ["Helvetica Neue", "GT America"]       # injected into prompt, not validated
  safeZone:
    top: 10%  bottom: 10%  left: 8%  right: 8%   # programmatic check
  logo:
    required: true
    placement: "top-right"                         # vision check
  mood:
    keywords: ["premium", "minimal", "sophisticated"]  # LLM judge
  rules:
    - { id, description, severity: "hard" | "soft", autoCorrect: boolean }
```

**Channel presets** (built-in library, not user-defined):

- `x-ad-banner` → 1200×628, 20% safe zone all sides, no text in bottom 15%
- `instagram-feed-square` → 1080×1080
- `instagram-feed-portrait` → 1080×1350 (4:5)
- `youtube-thumbnail` → 1280×720, readable text zone center

---

## Validation Pipeline

After generation, before the canvas node is marked complete:

```
generate image
  → check dimensions              (programmatic, instant)
  → check safe zones              (programmatic, instant)
  → check color palette           (pixel sampling + delta-E distance, instant)
  → check visual rules            (vision model, ~1–2s)
  → check qualitative rules       (LLM-as-judge, ~2s)
  → if any fail → apply correction strategy
  → stream validation result as StepEvent to canvas
```

The vision model check is a single Gemini call: "Here is an image. Here are my brand rules: [...]. For each rule respond with PASS or FAIL and a brief reason."

Color palette validation should use **delta-E color distance** rather than exact HEX matching — perceptual tolerance avoids false positives from compression artifacts and lighting variation.

---

## UI Concepts

**Brand Panel** (canvas sidebar tab, alongside Style):

- Active brand profile selector
- Channel preset picker (X.com banner, IG feed, etc.)
- Rules list with live pass/fail indicators after generation

**Validation feedback on canvas nodes**:

- Green badge — all rules passed
- Yellow badge — soft rule failed, accepted anyway
- Red badge — hard rule failed (escalated to user)
- Click badge → rule-by-rule breakdown panel

**On failure surfacing** (inline):

- Toast: "3 of 5 brand rules failed — [see details / regenerate / accept]"
- Details panel: rule name, violation description, thumbnail

---

## Open Questions

1. **Who defines channel presets?** Built-in library (X.com, Meta, TikTok specs) vs. user-defined? Probably both — built-ins for common platforms, user-extensible for custom formats.

2. **Color palette tolerance**: Delta-E distance is the right metric. What threshold is "close enough"? Needs calibration — too tight causes false failures, too loose defeats the purpose.

3. **Prompt vs. user conflicts**: User says "make it red" but brand palette is blue-only. Surface the conflict _before_ generating rather than after — saves one generation round-trip.

4. **Brand profile scope**: Global user profile, per-canvas override, or a "brand" entity shared across multiple canvases? A brand entity that multiple canvases reference feels right long-term (same brand, multiple campaign canvases).

5. **Validation cost**: Every generation triggers N additional model calls. Mitigations: cache validation results per prompt+image hash, batch vision checks into a single call, skip qualitative checks for draft mode.

6. **Partial failures**: If a generation is mostly right but one element is off — should we inpaint just that region, or do a full regeneration? Inpainting is faster but requires mask generation.
