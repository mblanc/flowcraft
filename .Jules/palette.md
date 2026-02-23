## 2026-02-23 - Accessibility for Icon-Only Buttons

**Learning:** Icon-only buttons are often inaccessible to screen readers and lack visual discovery for sighted users. In this application, many such buttons lacked both `aria-label` and `title` attributes.
**Action:** Always ensure icon-only buttons include both `aria-label` (for screen readers) and `title` (for visual tooltips), or better yet, wrap them in a `Tooltip` component if the design system supports it.
