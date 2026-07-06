# Flowcraft Wiki

Navigation index for all design docs, research, and references.

---

## Architecture

Developer-facing design documents for the codebase.

- [architecture.md](architecture/architecture.md) — Codebase map for engineers; read before touching anything
- [unify.md](architecture/unify.md) — Design for unifying flows and custom nodes into one abstraction
- [version-control.md](architecture/version-control.md) — Version control strategy for flows and media assets

---

## Canvas

Design and specification documents for the Canvas product surface (media agent / Director).

- [agent-design.md](canvas/agent-design.md) — Canonical architecture: principles, primitives, orchestration
- [agent-harness.md](canvas/agent-harness.md) — Agent harness spec: context, capabilities, pre/post hooks
- [agent-primitives.md](canvas/agent-primitives.md) — Layer-by-layer primitive taxonomy (atomic operations)
- [extensibility.md](features/extensibility.md) — Three-phase plan: Canvas Instructions → User Skills → Flows as Tools
- [lumen-prd.md](canvas/lumen-prd.md) — Original product requirements document
- [lumen-tech-spec.md](canvas/lumen-tech-spec.md) — Original technical specification
- [lumen-design-spec.md](canvas/lumen-design-spec.md) — Original design specification
- [lumen-studio-mockup.html](canvas/lumen-studio-mockup.html) — HTML prototype mockup

---

## Features

Planned and in-design features.

- [batch.md](features/batch.md) — PRD for batch execution system
- [code-export.md](features/code-export.md) — Export flow as runnable code
- [director-missing-skills-analysis.md](features/director-missing-skills-analysis.md) — Gap analysis of Canvas Director (Agent B) capabilities vs commercial opportunities
- [enterprise-teams.md](features/enterprise-teams.md) — PRD & Tech Spec for Organization and Member Management (foundational for team features)
- [gemini-omni-video.md](features/gemini-omni-video.md) — Feature spec for integrating Gemini Omni Flash for video generation & editing
- [model-nodes.md](features/model-nodes.md) — Node taxonomy brainstorm (triggers, models, tools, flow control)
- [validation.md](features/validation.md) — Brand validation and policy enforcement during generation

---

## Prompt Engineering

Prompt templates, style references, and production recipes for use inside flows and the canvas.

- [ultimate-image-prompt.md](prompt-engineering/ultimate-image-prompt.md) — AI Art Director role: transforms requests into high-fidelity image prompts
- [ultimate-video-prompt.md](prompt-engineering/ultimate-video-prompt.md) — AI Video Director role: transforms requests into high-fidelity video prompts
- [movie-recipe.md](prompt-engineering/movie-recipe.md) — Short film / ad production recipe with full consistency
- [character-sheet.md](prompt-engineering/character-sheet.md) — Character identity board prompt examples
- [storyboard.md](prompt-engineering/storyboard.md) — Storyboard prompt examples
- [scenario.md](prompt-engineering/scenario.md) — Example trailer architecture and shot sequence
- [styles.md](prompt-engineering/styles.md) — Visual style library (illustration, engraving, linocut, etc.)

---

## Research

Market research, use-case taxonomies, and architectural explorations.

- [genmedia-usecases.md](research/genmedia-usecases.md) — Comprehensive gen AI media use-case taxonomy by industry
- [use-cases.md](research/use-cases.md) — Top 10 demo flows with wow factor and selection rationale
- [nodes-synthesis.md](research/nodes-synthesis.md) — Synthesized node architecture from multi-model consultation

---

## Other

- [todo.md](todo.md) — Active task list
- [user-docs.md](user-docs.md) — Draft user-facing documentation
