---
name: virtual-tryon
description: Virtual try-on workflow. Composites a garment onto a subject using reference images, then optionally animates the result. Trigger when the user wants to see clothing on a person or mannequin.
metadata:
    type: pattern
---

## Trigger condition

Use this pattern when the user provides (or asks to generate) a **subject image** and a **garment image**, and wants to see the garment worn by the subject — as a still or animated.

## Quality checks on input references

Before planning nodes, verify:

1. **Subject image**: full-body or torso visible, neutral pose preferred, clear lighting. If no subject is available, generate a character sheet first using `t2i`.
2. **Garment image**: flat-lay or on-mannequin, full garment visible, minimal background clutter.

If either reference is absent or poor quality, add a `t2i` node to generate a suitable reference first. For recurring subjects, generate a character sheet (operation `t2i`, label "Character Sheet — [name]") to anchor visual consistency across multiple try-on nodes.

## Workflow steps

```
[Step 1 — optional] t2i: generate subject reference (if no canvas image available)
  operation: t2i
  promptIntent: "Full-body neutral-pose subject on clean background"

[Step 2 — optional] t2i: generate garment flat-lay (if no canvas image available)
  operation: t2i
  promptIntent: "Flat-lay product shot of [garment description] on white background"

[Step 3 — required] i2i: composite try-on
  operation: i2i
  promptIntent: "Subject wearing [garment], photorealistic composite, same lighting as subject reference"
  edges: subject_ref from subject node, style_ref from garment node

[Step 4 — optional] i2v: animate the composited result
  operation: i2v
  promptIntent: "Subtle breathing and fabric movement, slow 360 rotation"
  edges: depends_on from step 3
```

## Dependencies

- Step 3 (`i2i`) depends on both the subject and garment images — wire both as edges (`subject_ref`, `style_ref`).
- Step 4 (`i2v`) depends on step 3 — wire as `depends_on`.

## Common failures

- Low-resolution or heavily cropped subject images produce poor composites. Always use at least a torso-visible crop.
- Busy garment patterns (stripes, checks) can bleed into the subject in `i2i`. Increase prompt specificity: "sharp plaid pattern, precise seams".
- Skipping the subject reference generation step when the user has no canvas image leads to a generic composite. Generate the subject first.
