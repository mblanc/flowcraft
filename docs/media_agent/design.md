# Canvas Media Agent — Canonical Design

## 1. Principles

**General-purpose, not workflow-specific.** The agent understands any media production goal and decomposes it into primitive operations. The four example workflows (variations+animate, story, 360, try-on) are patterns over primitives, not hardcoded paths.

**Planning produces a graph, not prose.** The plan the user reviews _is_ the DAG that executes. No drift between what the agent describes and what it does.

**Primitives are the vocabulary.** Every media goal — however complex — resolves into combinations of a small set of primitive operations. The agent knows best practices for each primitive and how to compose them.

**Skills carry domain knowledge.** Best-practice knowledge is encoded in skill bundles that the Director injects at planning time. The agent doesn't reinvent prompting per call.

**The canvas node IS the asset.** Every generated artifact lives as a canvas node. The node graph is the asset registry — provenance, model, prompt, and lineage are stored on the node.

---

## 2. Agent Topology

There are exactly **two LLM agents** in this system. Everything else is deterministic code.

```
User intent
    │
    ▼
┌─────────────────────────────────────┐
│  Director (LLM agent)               │
│  - Parses intent                    │
│  - Loads relevant skills            │
│  - Builds production plan (DAG)     │
│  - Presents plan for approval       │
└──────────────┬──────────────────────┘
               │  approved plan nodes
               ▼
┌──────────────────────────────────────────────────────┐
│  PromptEngineer (LLM agent, called once per node)    │
│  - Receives plan node + skill bundle + active style  │
│  - Translates creative intent → model-specific prompt│
│  - Returns prompt + negativePrompt + resolvedParams  │
└──────────────────────────────────────────────────────┘
               │  fully-specified nodes
               ▼
┌──────────────────────────────────────────────────────┐
│  Executor (deterministic, no LLM)                    │
│  - Routes node by operation type                     │
│  - Calls the appropriate generation service          │
│  - Returns a canvas node                             │
│                                                      │
│  executeImageNode  executeVideoNode  executeAudioNode│
└──────────────────────────────────────────────────────┘
               │
           canvas nodes
```

### Director _(LLM agent)_

Owns the production plan. Talks to the user. Never generates media directly. All creative reasoning and decomposition happens here.

### PromptEngineer _(LLM agent)_

Called once per plan node after approval. Translates `promptIntent` into the final model prompt, enforcing skill best-practices and the active style. By the time it returns, every decision is made — no further reasoning is needed downstream.

### Executor _(deterministic functions, no LLM)_

Pure API wrappers. Receives a fully-specified node (prompt, model, params all resolved) and calls the generation service. Returns a canvas node on success, throws on failure. No reasoning, no retry logic at this level.

```typescript
async function executeImageNode(node: ResolvedPlanNode): Promise<CanvasNode>;
async function executeVideoNode(node: ResolvedPlanNode): Promise<CanvasNode>;
async function executeAudioNode(node: ResolvedPlanNode): Promise<CanvasNode>;
// future:
async function executePostNode(node: ResolvedPlanNode): Promise<CanvasNode>;
```

The runner orchestrates the executor functions directly — no ADK agent wrapping needed. This is consistent with the current execute-plan route, which already calls generation services without an LLM in the loop.

---

## 3. Primitive Media Operations

These are the atoms. Every use case is a DAG over a subset of these.

| ID        | Operation                 | Inputs                      | Output                    |
| --------- | ------------------------- | --------------------------- | ------------------------- |
| `t2i`     | Text → Image              | prompt, style refs          | image node                |
| `i2i`     | Image → Image             | source image, prompt        | image node                |
| `t2v`     | Text → Video              | prompt                      | video node                |
| `i2v`     | Image → Video             | first-frame image, prompt   | video node                |
| `i2v2`    | Image → Video (bracketed) | first + last frame, prompt  | video node                |
| `t2s`     | Text → Speech             | script, voice ref           | audio node                |
| `t2m`     | Text → Music              | description, mood, duration | audio node _(stub)_       |
| `sfx`     | Text → SFX                | description                 | audio node _(stub)_       |
| `concat`  | Concatenate               | ordered node list           | video/audio node _(stub)_ |
| `edit`    | Edit / Inpaint            | source node, mask, prompt   | image/video node          |
| `upscale` | Upscale / Restore         | source node, params         | image/video node          |

**Initial implementation scope:** `t2i`, `i2i`, `t2v`, `i2v`, `t2s`. The others are defined in the plan schema but their execution stubs return a `pending` status.

---

## 4. Production Plan (Data Model)

```typescript
interface ProductionPlan {
    intent: string; // verbatim user goal
    nodes: PlanNode[];
    edges: PlanEdge[]; // directed: from → to (dependency)
    clarifications?: string[]; // questions for user before execution
    estimatedSteps: number;
}

interface PlanNode {
    id: string; // stable plan-time ID
    label: string; // human-readable, e.g. "Hero portrait"
    operation: MediaOperation; // t2i | i2v | t2s | ...
    skill: string; // which skill bundle governs this node
    inputs: NodeRef[]; // canvas node IDs or plan node IDs
    params: MediaParams; // aspect ratio, duration, model hint, etc.
    promptIntent: string; // creative intent in plain language
    prompt?: string; // filled by PromptEngineer at execution time
    model?: string; // resolved by PromptEngineer
    rationale: string; // why this step exists
    canvasNodeId?: string; // set once a canvas node is created
}

interface PlanEdge {
    from: string; // plan node ID
    to: string; // plan node ID
    role: EdgeRole; // "source" | "style_ref" | "first_frame" | "last_frame" | "audio"
}

type NodeRef = {
    type: "canvas" | "plan";
    id: string;
    role: EdgeRole;
};

interface MediaParams {
    aspectRatio?: string;
    resolution?: string;
    duration?: number;
    model?: string;
    generateAudio?: boolean;
    seed?: number;
    [key: string]: unknown;
}

type MediaOperation =
    | "t2i"
    | "i2i"
    | "t2v"
    | "i2v"
    | "i2v2"
    | "t2s"
    | "t2m"
    | "sfx"
    | "concat"
    | "edit"
    | "upscale";
type EdgeRole =
    | "source"
    | "style_ref"
    | "first_frame"
    | "last_frame"
    | "character_ref"
    | "audio"
    | "depends_on";
```

The canvas node graph _is_ the runtime state of this plan. `PlanNode.canvasNodeId` links plan nodes to canvas nodes once execution begins.

---

## 5. Skill System

Skills follow the **[agentskills.io](https://agentskills.io) open standard** and are loaded into the Director via ADK's native `SkillToolset`. This gives the Director three tools automatically: `list_skills`, `load_skill`, and `load_skill_resource` — enabling progressive disclosure without any custom injection logic.

### Directory structure

```
src/lib/canvas/adk/skills/
  virtual-tryon/
    SKILL.md              # pattern: planning workflow for try-on jobs
    references/
      step-by-step.md     # detailed step breakdown + edge cases
  story/
    SKILL.md              # pattern: multi-scene narrative planning
  360-video/
    SKILL.md              # pattern: product orbit planning
  variations-animate/
    SKILL.md              # pattern: generate variants then animate
  t2i/
    SKILL.md              # primitive: how to prompt image models
    references/
      models.md           # model capability matrix
  i2v/
    SKILL.md              # primitive: camera motion grammar, duration limits
    references/
      models.md
  t2s/
    SKILL.md              # primitive: voice, pacing, script format
  ...
```

### SKILL.md format

Every skill follows the agentskills.io spec: YAML frontmatter + markdown body.

```markdown
---
name: virtual-tryon
description: >
    Plan a virtual try-on workflow. Use when the user wants to see a subject
    wearing a garment — requires a subject reference image and a garment
    reference image.
metadata:
    type: pattern
    operations: t2i, i2v
---

## Quality checks (before planning)

- Subject reference must show a clear full-body or face view
- Garment reference must show the full item without occlusion

## Steps

1. [t2i] Generate a character sheet from the subject reference — neutral pose, full body
2. [t2i] Generate try-on composite — subject from sheet wearing the garment
3. [i2v] Animate the composite

## Dependencies

- Step 2 inputs: step 1 output (character sheet) + garment reference node
- Step 3 inputs: step 2 output

## Common failures

- Skipping the character sheet causes identity drift in step 2
- Using the raw subject photo directly (not the sheet) produces inconsistent results
```

```markdown
---
name: i2v
description: >
    Best practices for image-to-video generation prompting and model parameters.
    Use when planning or executing an i2v step.
metadata:
    type: primitive
    operation: i2v
---

## Prompting

- Always specify camera movement explicitly (pan left, slow dolly in, static)
- Lock subject description verbatim from the character sheet
- Keep motion verbs unambiguous — avoid "dynamic" or "cinematic" without specifics

## Common failures

- Contradictory motion verbs cause jitter
- Omitting subject description causes identity drift between frames

## Reference conditioning

- First-frame image should be the exact output of the preceding t2i node
```

### Two tiers, same format, different consumers

| Tier      | `metadata.type` | Consumer       | When loaded                                                   |
| --------- | --------------- | -------------- | ------------------------------------------------------------- |
| Pattern   | `pattern`       | Director       | At planning time, when intent matches the skill's description |
| Primitive | `primitive`     | PromptEngineer | At execution time, per node, matched by `metadata.operation`  |

The Director uses `SkillToolset` for progressive disclosure — it calls `list_skills` to see what's available, then `load_skill` for the relevant pattern. It never loads all skills at once.

The PromptEngineer is instantiated with its operation already known, so the runner pre-loads the matching primitive skill and injects it directly into its instruction — no `SkillToolset` needed there.

### Loading at runtime

```typescript
import { loadAllSkillsInDir, SkillToolset } from "@google/adk";

const skills = await loadAllSkillsInDir("src/lib/canvas/adk/skills");
const skillToolset = new SkillToolset(skills);

// Pass to Director
const director = new LlmAgent({
    name: "Director",
    tools: [planProductionTool, suggestActionsTool, skillToolset],
    // ...
});
```

---

## 6. Style System

A **style** is a markdown document that describes a visual aesthetic — lighting, color science, composition rules, negative constraints. It acts as a global brief that governs every generation node in a plan.

Styles come from two sources:

- **Built-in templates** (`STYLE_TEMPLATES` in `src/lib/style-templates.ts`) — e.g. Cinematic, Editorial Photo, Flat Illustration
- **User-created styles** — stored in the database via `styleService`, same markdown format

The user activates a style per canvas via the style picker in the chat toolbar. The `activeStyleId` is persisted on the canvas document.

### Flow

```
Canvas.activeStyleId
    │
    ▼  (resolved in chat API route)
{ name: string; content: string }   ← full markdown content
    │
    ├─► injected into Director instruction as {active_style}
    │   "Apply this style to EVERY generation node."
    │
    └─► injected into PromptEngineer instruction per node
        "Active style brief follows. Enforce all constraints."
```

The style is not optional context — it is a hard constraint. Both the Director (when writing `promptIntent` per node) and the PromptEngineer (when rendering the final model prompt) must enforce it. A generation node's prompt should be invalid if it contradicts the active style's negative constraints.

### Style content structure

```markdown
# [Style Name]

## 1. Primary Medium

- Camera / technique / rendering approach

## 2. Lighting & Mood

- Direction, quality, color temperature

## 3. Color Science

- Shadow, midtone, highlight treatment

## 4. Composition Rules

- Framing, subject placement, negative space

## 5. Negative Constraints

- What must never appear in outputs
```

The negative constraints section is the most operationally important — it is what the PromptEngineer uses to build the `negativePrompt` field for models that support it.

---

## 7. Director

### System Prompt Skeleton

```
You are the Canvas Media Agent — a creative production director.
Your job is to turn any media goal into a precise production plan,
then orchestrate its execution.

RULES
- Never generate media directly. Emit a plan and wait for approval.
- Before planning, call list_skills to see what patterns are available, then load_skill
  for any that match the user's intent. If no pattern matches, decompose from the
  primitives list below.
- Decompose the user's goal into primitive operations (see PRIMITIVES).
- Express dependencies explicitly as edges (first_frame, style_ref, depends_on, etc.).
- For each node, write a plain-language promptIntent. PromptEngineer will render the actual model prompt.
- Flag ambiguity in clarifications[] before planning. One round of clarification maximum.
- Keep video nodes ≤10s. Split longer sequences into chained i2v nodes + concat.
- Reference canvas items by their exact node ID from the context block.
- After approval, dispatch nodes in topological order. Parallelise independent nodes.

PRIMITIVES
{primitives_list}

CANVAS CONTEXT
{canvas_nodes}

ACTIVE STYLE
{active_style}
```

### Director Tools

```typescript
plan_production(intent: string, steps: PlanNode[], edges: PlanEdge[], clarifications?: string[]): void
// Emits the full production plan for user approval. Called once per user intent.

request_clarification(questions: string[]): void
// Halts planning and asks the user targeted questions. Max one call per turn.

suggest_actions(actions: Array<{ label: string; prompt: string }>): void
// Post-execution follow-up suggestions. Max 3.

dispatch_node(nodeId: string): void
// Tells the runner to execute a specific plan node. Called after approval, in topological order.
```

---

## 8. PromptEngineer

A focused subagent called once per plan node during execution. It receives:

- The `PlanNode` (operation, promptIntent, params, inputs)
- The relevant `best-practices.md` for the operation
- The resolved input node metadata (existing canvas nodes used as references)
- The target model ID

It returns:

- `prompt: string` — the final model prompt
- `negativePrompt?: string`
- `resolvedParams: MediaParams` — any param overrides based on best practices

### System Prompt Skeleton

```
You are a prompt engineering specialist for AI media generation.
You receive a creative intent and translate it into the optimal prompt
for a specific model and operation type.

OPERATION: {operation}
TARGET MODEL: {model}
CREATIVE INTENT: {promptIntent}
INPUT ASSETS: {resolved_input_descriptions}
PARAMS: {params}

BEST PRACTICES FOR THIS OPERATION:
{best_practices_md}

ACTIVE STYLE BRIEF:
{active_style_content}

RULES
- Output a single model-ready prompt. No explanation.
- Follow the best-practice conventions above strictly.
- Enforce every constraint in the active style brief. If the style has negative constraints, use them to build a negativePrompt.
- Reference input assets by their visual description, not by ID.
- Respect aspect ratio, duration, and style constraints from params.
- If the model prefers structured tags over natural language, use tags.
- If a negative prompt improves output for this model, include one.
```

---

## 9. Executor Functions

Plain async functions — no LLM, no ADK agent, no session. Each receives a `ResolvedPlanNode` (prompt and params already filled by PromptEngineer) and calls the appropriate generation service.

```typescript
// image
async function executeImageNode(node: ResolvedPlanNode): Promise<CanvasNode>;
// covers: t2i, i2i, edit, upscale — routed by node.operation

// video
async function executeVideoNode(node: ResolvedPlanNode): Promise<CanvasNode>;
// covers: t2v, i2v, i2v2

// audio
async function executeAudioNode(node: ResolvedPlanNode): Promise<CanvasNode>;
// covers: t2s (live), t2m / sfx (stubs)

// future
async function executePostNode(node: ResolvedPlanNode): Promise<CanvasNode>;
// covers: concat, mix
```

Executors emit a canvas node on success and throw on failure. Retry decisions and error escalation belong to the runner, not the executor.

---

## 10. Plan → Approve → Execute Loop (Extended)

The existing loop is preserved and extended:

```
1. User sends intent
       │
       ▼
2. Director loads relevant skills, builds ProductionPlan
   (calls plan_production tool → SSE "plan" event)
       │
       ▼
3. Client renders plan as DAG in canvas UI
   User can edit promptIntent, reorder, remove nodes
   User clicks Proceed
       │
       ▼
4. Client sends approved plan to /execute-plan
       │
       ▼
5. Runner resolves topological execution order
   For each node (or parallel batch of independent nodes):
     a. PromptEngineer fills prompt + resolvedParams
     b. Execution subagent generates → canvas node created
     c. SSE "step_done" event → canvas node updated
       │
       ▼
6. Director receives all completions → calls suggest_actions
```

**What changes from the current implementation:**

- `plan_production` replaces the pair `plan_image_generation` + `plan_video_generation` — it handles any operation type
- The plan carries edges (DAG), not just a flat step list
- PromptEngineer is inserted between plan approval and execution (step 5a)
- Independent nodes in a topological level execute in parallel
- The canvas node is created as a placeholder at step 5b, updated at 5c (same as today)

**What stays the same:**

- SSE streaming: `text`, `plan`, `actions`, `step_start`, `step_done`, `step_error`, `done`
- Plan approval UX: the Proceed / Cancel card
- Canvas node as the runtime artifact
- Session continuity via ADK `SessionService`
- `suggest_actions` for follow-up ideas

---

## 11. ADK Implementation Notes

### Agent structure

```typescript
// Two LlmAgents only.

// 1. Director — root agent, owns planning
const director = new LlmAgent({
    name: "Director",
    model: gemini,
    instruction: buildDirectorInstruction(skills, canvasContext, activeStyle),
    tools: [planProductionTool, requestClarificationTool, suggestActionsTool],
});

// 2. PromptEngineer — instantiated fresh per node during execution
const promptEngineer = new LlmAgent({
    name: "PromptEngineer",
    model: gemini,
    instruction: buildPromptEngineerInstruction(
        node,
        bestPractices,
        activeStyle,
    ),
    tools: [],
});

// Executors are plain async functions — no ADK wrapping
await executeImageNode(resolvedNode); // calls Gemini image API
await executeVideoNode(resolvedNode); // calls Veo API
await executeAudioNode(resolvedNode); // calls TTS API
```

The PromptEngineer is invoked by the **runner** (not the Director) for each node after plan approval. This keeps the Director's context clean and means prompt engineering never contaminates the planning session.

### Skill loading

```typescript
import { loadAllSkillsInDir, SkillToolset } from "@google/adk";

// Load all skills once at startup (or per-request if hot-reloading is needed)
const skills = await loadAllSkillsInDir("src/lib/canvas/adk/skills");
const skillToolset = new SkillToolset(skills);

// Director gets the full toolset — it calls list_skills / load_skill on demand
const director = new LlmAgent({
    name: "Director",
    model: gemini,
    instruction: buildDirectorInstruction(canvasContext, activeStyle),
    tools: [
        planProductionTool,
        requestClarificationTool,
        suggestActionsTool,
        skillToolset,
    ],
});

// PromptEngineer gets its primitive skill pre-loaded into the instruction
const primitiveSkill = skills[node.operation]; // e.g. skills["i2v"]
const promptEngineer = new LlmAgent({
    name: "PromptEngineer",
    model: gemini,
    instruction: buildPromptEngineerInstruction(
        node,
        primitiveSkill,
        activeStyle,
    ),
    tools: [],
});
```

The Director's instruction no longer needs `{injected_skill_best_practices}` — the `SkillToolset` handles discovery and loading via progressive disclosure. The Director prompt only needs to tell the agent that skills are available and to load the relevant one before planning.

### Variant routing (existing)

The current `agentVariant: "a" | "b"` hook in the runner is the natural place to A/B test Director prompt variations, skill injection strategies, or PromptEngineer implementations during development.

---

## 12. Canvas Node as Asset

Every executed plan node produces a canvas node. The node data carries full provenance:

```typescript
interface CanvasImageData {
    // existing fields
    sourceUrl: string;
    prompt: string;
    model: string;
    // new fields
    operation: MediaOperation; // t2i | i2i | edit | ...
    planNodeId: string; // links back to the production plan
    derivedFrom?: string[]; // parent canvas node IDs (the DAG edge in-canvas)
    skill: string; // which skill governed this generation
}
```

`derivedFrom` makes the canvas node graph a queryable lineage graph — the same role as `derived_from[]` in the Frame contract from the Claude design. This enables future features: re-run downstream, replace a reference and propagate, cost/provenance reporting.

---

## 13. Initial Implementation Scope

Phase 1 — foundation:

- [ ] Director with `plan_production` tool (replaces `plan_image_generation` + `plan_video_generation`)
- [ ] Flat skill bundles for `t2i`, `i2v`, `t2s` (markdown files, loaded at runtime)
- [ ] PromptEngineer as a separate LlmAgent called per-node in the execute-plan route
- [ ] DAG plan schema with edges (topological execution order in runner)
- [ ] `derivedFrom` on canvas nodes

Phase 2 — multi-agent execution:

- [ ] ImageAgent and VideoAgent as separate ADK agents (currently handled inline)
- [ ] AudioAgent with TTS execution
- [ ] Parallel execution of independent plan nodes

Phase 3 — richer primitives:

- [ ] `i2i` (edit/inpaint), `i2v2` (bracketed video), `concat`
- [ ] AudioAgent music/SFX stubs → real implementations
- [ ] PostAgent (concatenation, audio mixing)

---

## 14. Design Decisions & Rationale

| Decision                    | Choice                              | Why                                                                                                 |
| --------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| Multi-agent vs single agent | Multi-agent                         | Parallel scene execution is the only path to acceptable latency on complex jobs                     |
| PromptEngineer placement    | Runner-side (not Director tool)     | Keeps Director context clean; prompt engineering is deterministic per-node, not a creative decision |
| Skill bundles format        | Markdown files, loaded at runtime   | Static, versioned, auditable; fits the open/no-lock-in value; faster to iterate than code           |
| Plan granularity            | Fine-grained DAG (RISC-style)       | User reviews and edits individual nodes; coarse plans hide cost and drift                           |
| Asset registry              | Canvas nodes + derivedFrom          | Reuses existing infrastructure; no separate database needed                                         |
| Workflow hardcoding         | None                                | Primitives + skills cover all use cases; hardcoded workflows become stale                           |
| Music/speech                | Architecturally placed, stubs first | In scope for design, deferred for execution — avoids blocking Phase 1 on unavailable models         |
