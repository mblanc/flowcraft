# Lumen Agent Harness — Specification

## What Is an Agent Harness?

An **agent harness** is the configurable infrastructure that surrounds an AI agent without changing its core logic. Where the agent itself handles _reasoning and planning_, the harness controls _what context it reasons with_, _what capabilities it has access to_, and _what happens before and after it runs_.

Think of it as the difference between the engine of a car (the agent) and the dashboard, gearbox, and electronics that configure how you drive it (the harness). Two workspaces using the same Lumen agent can behave completely differently based on their harness configuration.

For Lumen, the harness is the layer that admins configure to shape how the agent behaves for their workspace — without touching any agent code.

---

## Design Principles

1. **Composition over monolith**: The harness assembles the agent's operating context from small, independently configurable modules. No module is required.
2. **Transparent to users**: Users interact with Lumen naturally. The harness applies silently. Users may _see_ the effects (brand colors in generated images) but don't need to know the mechanism.
3. **Ordered pipeline**: Each module is a step in a pipeline with a defined execution order. Admins control what's in the pipeline; the pipeline controls when and how each module fires.
4. **Non-destructive**: Modules enrich or constrain; they don't replace. The user's original intent is always preserved through the pipeline.
5. **Inspectable**: Every transformation applied by the harness should be traceable in the generation metadata, so admins can audit what fired and why.

---

## The Harness Pipeline

The harness sits at three intervention points around the agent:

```
                    ┌─────────────────────────────────────────┐
                    │           LUMEN AGENT HARNESS            │
                    │                                          │
User Message ──────▶│  [1. INPUT PIPELINE]                    │
                    │      ↓                                   │
                    │  Agent Context Assembly                  │
                    │    + System Context Modules              │
                    │      ↓                                   │
                    │  ┌─────────────────────┐                │
                    │  │    LUMEN AGENT      │  (unchanged)   │
                    │  │  reasons + plans    │                │
                    │  └─────────────────────┘                │
                    │      ↓                                   │
                    │  [2. PLAN PIPELINE]                     │
                    │      ↓                                   │
                    │  [3. OUTPUT PIPELINE]                   │
                    │                                          │
                    └────────────────────┬────────────────────┘
                                         │
                                    Canvas / User
```

### Stage 1 — Input Pipeline

Applied to the user's raw message _before_ the agent sees it. Modules at this stage transform or enrich the message.

### Stage 2 — Plan Pipeline

Applied to the agent's output plan (list of generation steps) _before_ execution. Modules here can enrich prompts, inject steps, or reorder.

### Stage 3 — Output Pipeline

Applied _after_ generation steps complete. Modules here trigger follow-up actions, validate results, or emit side effects.

---

## Harness Module Types

### 1. Brand Kit

**Purpose**: Ensure every generated asset reflects the workspace's visual identity without users needing to specify it.

**What it configures**:

- Color palette (primary, secondary, forbidden)
- Style descriptors (e.g. "minimalist", "bold typography", "geometric")
- Mood keywords (e.g. "energetic", "professional")
- Logo reference (GCS URI — optionally passed as visual reference to multimodal models)
- Negative constraints (forbidden elements, forbidden colors)
- Tone of voice (for conversational framing, not visual)

**Where it fires**:

- **Stage 1** (Input → System Context): A "Brand Identity" block is injected into the agent's system context. The agent knows the brand when it writes prompts.
- **Stage 2** (Plan Pipeline): Brand suffix is appended to each generation step's prompt before execution.

**Example injection**:

```
BRAND IDENTITY (apply to all generations):
Colors: #0F172A (background), #6366F1 (accent). Style: clean, minimal, high contrast.
Avoid: gradients, stock photos, serif fonts, busy backgrounds.
```

---

### 2. Knowledge Base

**Purpose**: Give the agent persistent background knowledge about the workspace — its product, audience, use cases, industry context — so planning is grounded in reality.

**What it configures**:

- Named knowledge entries (title + free-text content, up to ~1500 chars each)
- Scope per entry: `agent` (planning context only), `generation` (appended to prompts), or `both`
- Priority order (higher priority entries appear earlier in context)
- Toggle per entry

**Where it fires**:

- **Stage 1 → System Context** (`scope: agent|both`): Knowledge entries are appended to the agent's system context. The agent can reference this when deciding how to plan.
- **Stage 2 → Plan Pipeline** (`scope: generation|both`): Content is prepended as a brief context note to each step's generation prompt.

**Example**:

```
WORKSPACE KNOWLEDGE:
[Product] Acme Analytics is a B2B SaaS dashboard for e-commerce operations managers.
[Audience] Mid-market retailers (50–500 employees), non-technical users, mobile-first.
[Tone] Direct, data-driven. Never use jargon. Avoid passive voice.
```

---

### 3. Skills

**Purpose**: Let admins define named, parameterized multi-step workflows that users can invoke by name — without users needing to describe every step.

A Skill is a preset plan template: a named sequence of generation steps with variable slots. When the agent detects a skill invocation (by name or trigger phrase), it expands the skill into a full plan, fills in parameters from the user's message, and presents it for approval.

**What it configures**:

- Skill name + description (shown to users)
- Trigger phrases (e.g. "weekly social bundle", "social kit")
- Parameters: named slots the skill needs (e.g. `{{topic}}`, `{{product_name}}`) with optional defaults
- Steps: ordered list of generation steps with prompt templates using `{{param}}` tokens
- Step dependencies (for sequential or parallel execution)

**Where it fires**:

- **Stage 1 → System Context**: Active skill names and trigger phrases are listed in the agent's context so it can detect and route to them.
- **Stage 1 → Post-agent**: If the agent returns a skill trigger, the harness expands the skill template into a concrete `GenerationStep[]` before the plan is shown to the user.

**Example Skill — "Product Demo"**:

```
Trigger: "product demo", "demo walkthrough"
Parameters: product_name (required), audience (default: "professionals")
Steps:
  1. Hero screenshot — "Clean UI screenshot of {{product_name}}, dark theme, {{audience}} context"
  2. Feature highlight — "Close-up detail view of key feature in {{product_name}}, minimal, focused"
  3. CTA card — "Simple {{product_name}} call-to-action visual, brand colors, clean typography"
```

---

### 4. Prompt Rules

**Purpose**: Define conditional rules that automatically transform messages or prompts — enforcing style standards, adding context, or patching common omissions.

Rules are evaluated in priority order. Each rule has a **condition** (when to fire) and an **action** (what transformation to apply).

**Conditions**:

- `always` — fires on every generation
- `contains: [keywords]` — fires if message contains any of the keywords
- `mode: [image|video|auto]` — fires only in specified generation modes
- `no_style_mentioned` — fires if the message has no aesthetic/style descriptor (smart default)

**Actions**:

- `append: text` — adds text at the end of the target
- `prepend: text` — adds text at the beginning
- `wrap: prefix, suffix` — wraps the target
- `replace_pattern: find, replace` — regex substitution

**Targets** (`appliesTo`):

- `user_message` — transforms the raw user message before it reaches the agent
- `generation_prompt` — transforms each step's generation prompt before execution
- `both`

**Where it fires**:

- **Stage 1 → Input** (`appliesTo: user_message`): Message is transformed before agent receives it.
- **Stage 2 → Plan** (`appliesTo: generation_prompt`): Each step prompt is transformed before generation.

**Example Rules**:

```
Rule: "Always cinematic" — condition: no_style_mentioned, action: append ", cinematic lighting, professional photography", target: generation_prompt
Rule: "Brand voice" — condition: contains [product, feature], action: append " — minimal, on-brand", target: user_message
```

---

### 5. Hooks

**Purpose**: Define automated behaviors that fire before or after generation — enabling auto-transforms, quality gates, and chained follow-ups.

A Hook has a **trigger** (when it fires) and an **action** (what it does).

**Triggers**:

- `pre_generation` — fires before a generation step executes; can transform the step's prompt
- `post_generation` — fires after a step completes; can trigger follow-up actions
- Media type filter: `image`, `video`, or both

**Actions**:

- `prompt_transform` — applies a template to the step's prompt (e.g. `"{{original_prompt}}, shot on Fujifilm, film grain"`)
- `auto_followup` — automatically sends a follow-up request after generation completes (e.g. auto-upscale, auto-caption)
- `upscale` — built-in: triggers an upscale pass on every generated image
- `validate` _(future)_ — runs a review check against policy rules before surfacing the result

**Where it fires**:

- **Stage 2 → Plan** (`pre_generation`): Prompt transforms are applied to each step before execution.
- **Stage 3 → Output** (`post_generation`): Follow-ups are queued after each completed step.

**Example Hooks**:

```
Hook: "Auto-upscale" — trigger: post_generation (image), action: upscale
Hook: "Film aesthetic" — trigger: pre_generation (image), action: prompt_transform "{{original}}, analog film, grain, Kodak Portra 400"
Hook: "Auto-caption" — trigger: post_generation (image), action: auto_followup "describe what's in this image"
```

---

## Harness Configuration Object

At runtime, the harness loads a single `HarnessConfig` for the workspace before processing any request:

```typescript
interface HarnessConfig {
    workspaceId: string;

    brand: BrandKit | null; // null = disabled
    knowledge: KnowledgeEntry[]; // empty = disabled
    skills: Skill[]; // empty = none active
    promptRules: PromptRule[]; // empty = none active
    hooks: Hook[]; // empty = none active
}
```

All fields are optional and additive. An empty `HarnessConfig` (all null/empty) means the agent runs with its defaults — exactly as it does today.

---

## Execution Trace

Every generation should include a harness trace in its metadata so admins can audit what fired:

```typescript
interface HarnessTrace {
    promptRulesApplied: string[]; // IDs of rules that fired
    brandInjected: boolean;
    knowledgeInjected: string[]; // IDs of knowledge entries used
    skillExpanded: string | null; // skill ID if a skill was triggered
    hooksPreGen: string[]; // hook IDs applied pre-generation
    hooksPostGen: string[]; // hook IDs applied post-generation
}
```

This trace is stored on the canvas node alongside the prompt and model, so admins can inspect why a generation looked the way it did.

---

## Admin Configuration Surface

The harness is configured via a workspace settings panel with one tab per module:

| Tab              | Key actions                                                 |
| ---------------- | ----------------------------------------------------------- |
| **Brand Kit**    | Set colors, style, logo, forbidden elements                 |
| **Knowledge**    | Add/edit/toggle knowledge entries, set scope and priority   |
| **Skills**       | Build skill templates with step editor and parameter slots  |
| **Prompt Rules** | Define conditional prompt rules with priority ordering      |
| **Hooks**        | Configure pre/post generation hooks with trigger conditions |

Each module is independently toggleable. Admins can also preview the composed system context that will be sent to the agent, and test-fire prompt rules on sample messages inline.

---

## Relation to Lumen's Roadmap

The harness is the foundation for several planned Lumen capabilities:

- **Brand kit (P0)**: Brand Kit module is the implementation vehicle
- **Template system (P1)**: Skills module is the implementation vehicle
- **Policy rules engine (P1)**: Validate hook action is the implementation vehicle
- **Reviewer layer (Phase 2)**: The Output Pipeline is the natural home for the Reviewer agent
- **Subagent customization (Phase 2)**: Each subagent (Image, Video, Audio) can have its own harness configuration scope
- **Template marketplace (Phase 3)**: Skills become shareable/importable across workspaces

The harness design ensures that as Lumen grows from a single orchestrator to a multi-subagent system, the same configuration primitives extend naturally — without requiring admins to relearn the model.

---

## Non-Goals

- **Per-user configuration**: The harness is workspace-level (admin-set). Individual user preferences are out of scope for v1.
- **Dynamic prompt engineering by non-admins**: Users interact through natural language, not harness config.
- **Code-level extensibility**: The harness is configuration-driven, not a plugin SDK. A developer SDK is a separate roadmap item (Phase 3).
- **Real-time harness editing during a session**: Config changes take effect on the next request, not mid-conversation.
