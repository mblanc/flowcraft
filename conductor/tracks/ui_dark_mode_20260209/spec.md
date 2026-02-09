# Specification: UI Standardization & Dark Mode

## 1. Overview
This track focuses on standardizing the UI by replacing hardcoded design values (colors, spacing, shadows) with the project's design system tokens (likely Tailwind CSS classes / Shadcn UI variables). Additionally, it introduces a Dark Mode feature, allowing users to toggle between Light, Dark, and System themes.

## 2. Goals
- Eliminate hardcoded CSS values (e.g., `#hex`, `px` values) in favor of semantic variables/classes.
- Implement a robust Dark Mode that respects system preferences by default but allows manual overrides.
- Ensure visual consistency across all components.

## 3. Functional Requirements

### 3.1 Design System Audit & Refactor
- **Audit:** Scan the codebase for hardcoded colors, spacing, and typography that do not use Tailwind utility classes or CSS variables.
- **Refactor:** Replace these instances with appropriate Tailwind classes (e.g., `bg-background`, `text-primary`) to ensure theme compatibility.
- **Scope:** Prioritize high-impact areas if full coverage is not immediately possible, but aim for a comprehensive pass on:
    - Custom Node components (`*-node.tsx`)
    - Layout components (`sidebar.tsx`, `header.tsx`)
    - Form elements (`config-panel.tsx`)

### 3.2 Dark Mode Implementation
- **Theme Provider:** Implement a Theme Provider (likely `next-themes`) to manage the active theme state.
- **Persistence:**
    - Default to the user's operating system preference (System).
    - Persist manual overrides (Light/Dark) to `localStorage`.
- **UI Toggle:**
    - Add a toggle button (Sun/Moon icon) to the main **Header**.
    - The toggle should cycle through or allow selection of Light, Dark, and System modes.

## 4. Non-Functional Requirements
- **Performance:** Theme switching must be instant without page reloads or significant layout shifts (FOUC).
- **Accessibility:** Ensure color contrast ratios meet WCAG AA standards in both Light and Dark modes.

## 5. Out of Scope
- Backend persistence of theme preferences (user database).
- Redesigning the UI layout or UX flows (strict style refactor only).
