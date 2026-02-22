## 2025-05-14 - [Accessible Icon-Only Buttons]

**Learning:** Icon-only buttons without explicit labels (aria-label or sr-only text) are inaccessible to screen reader users and lack tooltips for mouse users if the title attribute is also missing. In complex node-based interfaces like FlowCraft, these buttons are common for secondary actions (run options, sidebar closing, etc.).
**Action:** Always provide an `aria-label` and a `title` attribute to icon-only buttons. For buttons with dynamic states (like expand/collapse), use dynamic `aria-label` values to reflect the current state.
