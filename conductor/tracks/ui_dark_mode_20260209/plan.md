# Implementation Plan - UI Standardization & Dark Mode

This plan outlines the steps to standardize the UI using design tokens and implement a persistent dark mode.

## Phase 1: Infrastructure & Theming Setup

- [x] Task: Install `next-themes` and configure the `ThemeProvider` in `app/layout.tsx`. a95f9fd
    - [ ] Write Tests
    - [ ] Implement Feature
- [x] Task: Update `tailwind.config.ts` to support dark mode (selector strategy) and ensure all primary/secondary colors are defined using CSS variables. 3c17ac2
    - [ ] Write Tests
    - [ ] Implement Feature
- [x] Task: Implement the `ThemeToggle` component in `components/header.tsx` with Sun/Moon icons. 1a05a47
    - [ ] Write Tests
    - [ ] Implement Feature
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Infrastructure & Theming Setup' (Protocol in workflow.md)

## Phase 2: Design System Audit & Core Layout Refactor

- [ ] Task: Audit and refactor `app/globals.css` to use CSS variables for the color palette (background, foreground, primary, etc.).
    - [ ] Write Tests
    - [ ] Implement Feature
- [ ] Task: Refactor `components/sidebar.tsx` and `components/header.tsx` to remove hardcoded hex/px values and use semantic Tailwind classes.
    - [ ] Write Tests
    - [ ] Implement Feature
- [ ] Task: Ensure all Radix UI based components in `components/ui/` are correctly wired to the theme variables.
    - [ ] Write Tests
    - [ ] Implement Feature
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Design System Audit & Core Layout Refactor' (Protocol in workflow.md)

## Phase 3: Workflow Canvas & Node Standardization

- [ ] Task: Refactor `components/flow-canvas.tsx` to ensure the background and grid adapt to the theme.
    - [ ] Write Tests
    - [ ] Implement Feature
- [ ] Task: Standardize all custom node components (`llm-node.tsx`, `image-node.tsx`, etc.) to use the design system for borders, backgrounds, and shadows.
    - [ ] Write Tests
    - [ ] Implement Feature
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Workflow Canvas & Node Standardization' (Protocol in workflow.md)

## Phase 4: Final Polish & Accessibility

- [ ] Task: Audit `components/config-panel.tsx` and complex form elements for theme consistency.
    - [ ] Write Tests
    - [ ] Implement Feature
- [ ] Task: Perform an accessibility pass to ensure WCAG AA contrast ratios in both light and dark modes.
    - [ ] Write Tests
    - [ ] Implement Feature
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Final Polish & Accessibility' (Protocol in workflow.md)
