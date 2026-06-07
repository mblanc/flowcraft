# Architecture Analysis: Towards a Unified Primitive System

> Status: Draft — basis for refactoring planning  
> Scope: Flow editor, Canvas agent, ADK skills

---

## 1. Current State

### 1.1 The Flow Editor

Each capability is a **NodeDefinition** in `src/lib/nodes/<type>.ts`:

```
NodeDefinition<T extends NodeData, I extends NodeInputs>
  type         — string identifier ("image", "video", etc.)
  inputs       — port declarations { handleId: mediaType }
  outputs      — port declarations { handleId: mediaType }
  gatherInputs — wires DAG edges into typed inputs
  execute      — calls the API, returns Partial<NodeData>
```

Node types: `llm`, `text`, `image`, `video`, `file`, `upscale`, `resize`, `list`, `router`, `workflow-input`, `workflow-output`, `custom-workflow`.

Each also needs:

- A Zod schema in `schemas.ts`
- A React component in `src/components/nodes/`
- An optional config panel in `src/components/panels/`
- A manual entry in `src/lib/nodes/index.ts`

### 1.2 The Canvas Agent

Canvas nodes: `canvas-image`, `canvas-video`, `canvas-text` — simpler data shapes than their flow equivalents, with their own store, components, and types in `src/lib/canvas/types.ts`.

The Director agent has two layers of "skills":

- **Primitives** (`src/lib/canvas/adk/skills/primitives/`): Markdown docs that tell the PromptEngineer how to write prompts for a single operation. Currently: `image-generation`, `video-generation`, `t2s`.
- **Patterns** (`src/lib/canvas/adk/skills/patterns/`): Multi-step ADK skills loaded by the Director at runtime. Currently: `character-generation`, `multi-shot-video`, `storyboard`, `virtual-tryon`.

The **PromptEngineer** maps `GenerationStep.type → SKILL.md` via a hardcoded `SKILL_FOR_TYPE` record, enriches the plain-language intent into a structured prompt, and passes it to `generation.ts`.

**`generation.ts`** runs the actual API calls, resolves inter-step dependencies, and streams `StepEvent`s back. It also has a hardcoded switch on step type.

---

## 2. The Problem: Everything Is Disconnected

Adding a new primitive capability (e.g., **music generation**) today requires touching **at least 12 different places**, with no single source of truth connecting them:

| What to do                  | Where                                                            |
| --------------------------- | ---------------------------------------------------------------- |
| Add API route               | `src/app/api/generate-music/route.ts`                            |
| Add Zod request schema      | `src/lib/schemas.ts`                                             |
| Add flow node data schema   | `src/lib/schemas.ts`                                             |
| Add NodeType entry          | `src/lib/types.ts`                                               |
| Add NodeDefinition          | `src/lib/nodes/music-node.ts`                                    |
| Register in node index      | `src/lib/nodes/index.ts`                                         |
| Add flow React component    | `src/components/nodes/music-node.tsx`                            |
| Add canvas node type        | `src/lib/canvas/types.ts` (`CanvasMusicData`, union)             |
| Add canvas component        | `src/components/canvas/nodes/canvas-music-node.tsx`              |
| Add to GenerationStep.type  | `src/lib/canvas/types.ts`                                        |
| Add to MediaOperation       | `src/lib/canvas/types.ts`                                        |
| Add SKILL.md                | `src/lib/canvas/adk/skills/primitives/music-generation/SKILL.md` |
| Add to SKILL_FOR_TYPE       | `src/lib/canvas/adk/prompt-engineer.ts`                          |
| Add to mergeResults()       | `src/lib/workflow-engine.ts`                                     |
| Add to generation.ts switch | `src/lib/canvas/generation.ts`                                   |
| Add to library save logic   | `src/lib/workflow-engine.ts`                                     |

None of these are mechanically linked — miss one, and something silently fails.

### 2.1 Specific Duplication & Drift Risks

**Duplicate resize hooks**: `use-node-resize.ts` (flow) and `use-canvas-node-resize.ts` (canvas) are near-identical implementations — same mouse tracking, same aspect-ratio logic, different stores.

**Dual data models**: `ImageData` (flow) and `CanvasImageData` (canvas) model the same concept with different field names (`images[]`/`sourceUrl`, `executing`/`status`). Over time these drift.

**Hardcoded type switches** in three places:

- `mergeResults()` in `workflow-engine.ts` — switches on node type to merge batch results
- `SKILL_FOR_TYPE` in `prompt-engineer.ts` — maps step type to SKILL.md name
- `saveToLibrary()` in `workflow-engine.ts` — switches on node type to decide what to save

**Step type ↔ canvas node type mismatch**: `GenerationStep.type` is `"image" | "video" | "concat"`, canvas nodes are `"canvas-image" | "canvas-video"` — manual string mapping required everywhere.

**Canvas has no execution abstraction**: Flow nodes have `NodeDefinition.execute()`. Canvas generation is a monolithic `executePlan()` with a big switch. No concept of "execute this step type."

---

## 3. The Target: A Primitive Registry

The core idea: a **primitive** is the single source of truth for one generative capability. From it, everything else is derived.

```
Primitive                                               ← server-safe, no React imports
  id            — "image", "video", "music"            (canonical, matches existing Firestore type strings)
  label         — "Image Generation"
  mediaType     — "image" | "video" | "audio" | ...

  // Schemas
  requestSchema — Zod schema for the unified API request body
  outputShape   — Zod schema for the node/canvas data

  // Server-side execution — ONE implementation, called by /api/primitives/[id]/execute
  execute       — (inputs: RequestSchema, ctx: ServerContext) → Promise<OutputShape>

  ─── Flow surface (server-safe: no React) ──────────────────────────────────
  flow: {
    type          — "image"  (the NodeType string, must match Firestore)
    ports         — input/output handle declarations
    gatherInputs  — (node, edges, getSourceData) → Inputs
    mergeResults  — (results[]) → Partial<Data>  (batch merge, explicit per primitive)
    saveToLibrary — (result, ctx) → Promise<void>
  } | null

  ─── Canvas surface (server-safe: no React) ────────────────────────────────
  canvas: {
    type          — "canvas-image"  (must match Firestore)
    toCanvasData  — (step: GenerationStep) → CanvasNodeData
  } | null

  ─── Agent surface ─────────────────────────────────────────────────────────
  agent: {
    skillPath     — absolute path to SKILL.md (for PromptEngineer)
    operationId   — "t2i", "i2v", etc.  (must match strings in Firestore chat history)
  } | null
```

React components are **not part of the primitive object** — they live co-located in the primitive's directory and are registered separately in a `ComponentRegistry` (see §3.2).

A **primitive registry** replaces `src/lib/nodes/index.ts`, the `SKILL_FOR_TYPE` map, the `mergeResults` switch, and the `saveToLibrary` switch with a single `getPrimitive(id)` lookup.

### 3.1 Adding Music Generation Under the New System

1. Create `src/lib/primitives/music/`:
    - `definition.ts` — the `Primitive` object: schemas, `execute()`, `gatherInputs()`, `mergeResults()`, `toCanvasData()` — **no React imports**
    - `SKILL.md` — prompt engineering spec for the Director
    - `FlowNode.tsx` — `'use client'` flow canvas component
    - `CanvasNode.tsx` — `'use client'` canvas component
    - `ConfigPanel.tsx` — `'use client'` config sidebar (omit if no config)
2. Register definition in `src/lib/primitives/registry.ts`
3. Register components in `src/lib/primitives/component-registry.ts`
4. Done.

The unified API route, `GenerationStep` support, `PromptEngineer` mapping, batch merge, `saveToLibrary`, and the config sidebar switch are all derived automatically. Zero changes to any existing file.

### 3.2 Execution Context Asymmetry

The flow and canvas systems run in fundamentally different environments — this shapes the entire primitive interface.

**Flow execution (client-side):**

```
WorkflowEngine (browser) → node.execute() → fetch("/api/primitives/[id]/execute") → server
```

`NodeDefinition.execute()` is a browser function. It feeds mention-resolved multimodal `parts[]` (text + interleaved image URLs) and carries retry logic and `onNodeUpdate` progress callbacks.

**Canvas execution (server-side):**

```
/api/canvases/[id]/execute-plan → generation.ts → primitive.execute() → Gemini
```

`generation.ts` runs server-side. It passes a plain prompt string plus resolved reference URLs, and handles GCS uploads inline. No HTTP hop — `primitive.execute()` is called directly.

**Input shapes diverge by design.** Flow sends `{ parts: ContentPart[], aspectRatio, model }` (multimodal, mention-resolved). Canvas sends `{ prompt: string, images: [{url, type}], systemInstruction }` (flat, reference-resolved). These are not the same schema and should not be forced into one.

**Consequence for the interface:**

- `primitive.execute()` is a **server-only** function receiving a canonical `requestSchema`-typed input
- `primitive.flow.gatherInputs()` translates the flow-side multimodal inputs into that schema before the HTTP call
- `generation.ts` maps `GenerationStep` fields into that same schema before calling `primitive.execute()` directly
- The unified API route `/api/primitives/[id]/execute` is the HTTP surface — not a new execution path, just an HTTP wrapper around `primitive.execute()`

### 3.3 React Component Split (Server/Client Boundary)

In Next.js 15, any module that transitively imports a `'use client'` component cannot be used in server components or API routes. If `FlowNode: React.ComponentType` lived in the same object as `primitive.execute()`, the primitive definition would be poisoned for server-side use.

**Solution: two registries.**

```typescript
// src/lib/primitives/registry.ts  — server-safe, imported anywhere
export const registry = new PrimitiveRegistry();
// registry.get("image") → Primitive (no React)

// src/lib/primitives/component-registry.ts  — client-only, imported in React trees
export const componentRegistry = new ComponentRegistry();
// componentRegistry.get("image") → { FlowNode, CanvasNode, ConfigPanel }
```

File layout per primitive:

```
src/lib/primitives/image/
  definition.ts       ← server-safe (no React imports)
  FlowNode.tsx        ← 'use client'
  CanvasNode.tsx      ← 'use client'
  ConfigPanel.tsx     ← 'use client'  (omit if no config)
  SKILL.md
```

`config-panel.tsx` (the top-level switcher) imports `componentRegistry` and becomes:

```tsx
const { ConfigPanel } = componentRegistry.get(selectedNode.data.type) ?? {};
return ConfigPanel ? <ConfigPanel data={data} nodeId={id} /> : null;
```

Zero hardcoded type checks. Adding a new primitive requires zero changes to `config-panel.tsx`.

---

## 4. What Gets Unified

### 4.1 Shared Data Shape

Flow nodes and canvas nodes for the same primitive should share a core data interface:

```typescript
// Base — shared between flow and canvas variants
interface ImageNodeBase {
    prompt?: string;
    aspectRatio?: string;
    model?: string;
    mediaUrl?: string; // canonical (replaces "image", "sourceUrl", "images[0]")
    mediaUrls?: string[]; // batch — replaces "images[]", "videoUrls[]"
}

// Flow-specific additions
interface FlowImageData extends ImageNodeBase {
    type: "image";
    executing?: boolean;
    batchTotal?: number;
    batchProgress?: number;
    error?: string;
    generatedAt?: number;
    // ...
}

// Canvas-specific additions
interface CanvasImageData extends ImageNodeBase {
    type: "canvas-image";
    status: "pending" | "ready" | "generating" | "error";
    sourceUrl: string; // keeps backward-compat while transitioning
    // ...
}
```

The unified base eliminates the URL field naming zoo (`image`, `imageUrl`, `sourceUrl`, `images[]`, `videoUrl`, `videoUrls[]`) while keeping surface-level types distinct.

### 4.2 Shared Resize Hook

```typescript
// src/hooks/use-media-node-resize.ts — works for both flow and canvas
export function useMediaNodeResize(
    id,
    dataWidth,
    dataHeight,
    options,
    onCommit,
);
```

`onCommit` receives the final dimensions — callers pass either `updateNodeData` (flow) or `updateNode` (canvas). Same logic, store-agnostic.

### 4.3 Unified Execution Contract

**Server-side** — `primitive.execute()` is the single implementation of a primitive's generation logic:

```typescript
// /api/primitives/[id]/execute/route.ts
export const POST = withAuth(async (req, { params }) => {
    const primitive = registry.get(params.primitiveId);
    if (!primitive)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    const parsed = primitive.requestSchema.safeParse(await req.json());
    if (!parsed.success)
        return NextResponse.json(
            { error: "Validation failed" },
            { status: 400 },
        );
    const result = await primitive.execute(parsed.data, { userId: req.userId });
    return NextResponse.json(result);
});
```

**Flow nodes** call this over HTTP (client → server), exactly as they called `/api/generate-image` before:

```typescript
// Inside flow.gatherInputs + the client-side execute wrapper
const result = await fetch(`/api/primitives/${primitive.id}/execute`, {
    method: "POST",
    body: JSON.stringify(inputs),
});
```

**Canvas generation** (`generation.ts`) calls `primitive.execute()` directly — no HTTP hop:

```typescript
const primitive = registry.getByCanvasType(`canvas-${step.type}`);
const result = await primitive.execute(toRequestSchema(step), serverContext);
```

`WorkflowEngine` calls `primitive.flow.mergeResults()` — no more switch.
`generation.ts` calls `primitive.execute()` directly — no more switch.

### 4.4 Patterns vs Primitives Relationship

Patterns remain as ADK SKILL.md files. The Director composes primitives by calling the planning tools; patterns just teach it _how_ to compose them for specific use cases. No architectural change here — patterns stay in `skills/patterns/`.

What changes: the Director's tool schema (`planProductionTool`) should enumerate the registered primitive IDs dynamically from the registry, rather than being hardcoded. This way, adding a new primitive automatically exposes it to the Director.

---

## 5. Migration Strategy

The registry is additive — the existing `NodeDefinition` system remains untouched while primitives are added alongside. Migration happens primitive-by-primitive:

**Phase 1 — Foundation**

- Define the `Primitive` interface and `PrimitiveRegistry` class
- Implement shared `useMediaNodeResize` hook
- Add the `Primitive` → `NodeDefinition` adapter so existing flow code requires zero changes

**Phase 2 — Migrate existing primitives one-by-one**

- `image` → wrap existing `imageNodeDefinition` + `CanvasImageData` into a `Primitive`
- `video` → same
- `upscale` → same
- Verify each step with existing tests before moving on

**Phase 3 — Derive agent tooling from registry**

- Replace hardcoded `SKILL_FOR_TYPE` with `primitive.skillPath`
- Replace hardcoded `plan_production` operation enum with `registry.primitiveIds()`
- Replace hardcoded `generation.ts` switch with `primitive.executor.execute()`

**Phase 4 — New primitive: music generation**

- Drop in `src/lib/primitives/music/` and register
- Zero touches to existing files

---

## 6. Backward Compatibility

The refactoring must not break existing Firestore documents, live API clients, or in-flight agent sessions.

### Firestore — zero migration

Existing flow nodes are stored as `{ type: "image", data: { prompt, aspectRatio, ... } }`. Existing canvas nodes as `{ type: "canvas-image", data: { sourceUrl, ... } }`.

**Constraint:** primitive IDs must match existing type strings. Register the image primitive with `id: "image"`, `flow.type: "image"`, `canvas.type: "canvas-image"`. Do not rename. The `requestSchema` and `outputShape` must be compatible with the existing Zod schemas in `schemas.ts`. No database migration required.

### API endpoints — deprecated facades

Old routes (`/api/generate-image`, `/api/generate-video`) stay alive until all flow nodes migrate to the unified endpoint. Rewrite them as thin wrappers:

```typescript
// src/app/api/generate-image/route.ts  (Deprecated — forwards to unified executor)
export const POST = withAuth(async (req) => {
    const body = await req.json();
    const result = await registry
        .get("image")!
        .execute(body, { userId: req.userId });
    return NextResponse.json({ imageUrl: result.images[0] });
});
```

This ensures stale browser tabs and any cached client code continue working during rollout. Delete old routes only after Phase 2 is fully merged.

### Live agent session — operation key preservation

The Director agent persists `plan_production` tool calls in Firestore chat history. If the `operation` enum in `planProductionTool` changes, historical messages fail to validate on replay.

**Constraint:** `primitive.agent.operationId` must equal the existing operation strings (`"t2i"`, `"i2v"`, `"t2v"`, etc.). The registry-derived tool schema must remain a superset of what is already in Firestore.

### UI color/icon mapping

Hardcoded `node.type === "image"` checks in style or rendering code should be replaced with:

```typescript
export function getPrimitiveColor(type: string): string {
    return registry.get(type)?.mediaType === "image" ? "#..." : "#6b7280";
}
```

This lets new primitives inherit correct styling without touching rendering code.

---

## 7. Decisions & Open Questions

### Decided

**All node types enter the primitive registry** — including `text`, `file`, `list`, `router`, `workflow-input`, `workflow-output`, `custom-workflow`. For non-generative ones, `canvas`, `skill`, and `agentToolSchema` are `null`. The registry becomes the single source of truth for _all_ node types, not just media-generative ones. This also means `config-panel.tsx` becomes a pure lookup with no hardcoded switches.

**`llm` is generative** — it enters the registry with a `skill` path (for any prompt-engineering guidance) and full executor. It has no canvas node today but `canvas: null` is valid.

**`concat` is a primitive** — `flow: null`, `canvas: "canvas-concat"`. It models the canvas-only video concatenation operation. This makes `GenerationStep.type` and `MediaOperation` fully derivable from registered primitive IDs.

**`primitive.execute()` is server-only** — it is the single canonical implementation of a primitive's generation logic. The flow surface's client-side execute wrapper is a `fetch()` to `/api/primitives/[id]/execute`, derived automatically — not a second implementation. Canvas `generation.ts` calls `primitive.execute()` directly on the server, skipping the HTTP hop.

**React components are not part of the primitive definition object** — a separate `ComponentRegistry` maps `primitiveId → { FlowNode, CanvasNode, ConfigPanel }`. This enforces the Next.js server/client bundle boundary: `registry.ts` (execution) can be safely imported in API routes; `component-registry.ts` is imported only inside React trees. Co-locate components in the primitive's directory (`src/lib/primitives/image/FlowNode.tsx`) but never import them from `definition.ts`.

**`ConfigPanel` lives inside the primitive directory** — `src/lib/primitives/image/ConfigPanel.tsx` rather than `src/components/panels/image-config.tsx`. Registered in `component-registry.ts`. The top-level `config-panel.tsx` becomes a pure lookup:

```tsx
const { ConfigPanel } = componentRegistry.get(selectedNode.data.type) ?? {};
return ConfigPanel ? <ConfigPanel data={data} nodeId={id} /> : null;
```

Adding a new primitive requires zero changes to `config-panel.tsx`.

### Open

1. **Patterns that compose multiple primitives** — a `multi-shot-video` pattern produces both images and videos. Pattern SKILL.md files may need to reference primitive IDs explicitly. Do we formalize this link, or leave patterns as free-form Markdown?

2. **Batch merge defaults** — decided: each primitive implements its own `mergeResults()` explicitly (Option A). The strategies aren't uniform enough to abstract (image uses flatMap, video doesn't; field names differ), and with ~10 primitives the boilerplate is minimal. No merge strategy helpers.

---

## 8. Summary: What the Refactoring Delivers

| Today                                        | After                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| 15+ files to touch for a new primitive       | 1 directory, 2 registry lines                                                      |
| Hardcoded type switches in 5+ places         | `getPrimitive(type).method()`                                                      |
| Duplicate resize hooks                       | Single shared hook                                                                 |
| Diverging ImageData / CanvasImageData        | Shared base + thin surface types                                                   |
| Director tool schema hand-maintained         | Derived from registered primitive IDs                                              |
| `SKILL_FOR_TYPE` hardcoded                   | `primitive.agent.skillPath`                                                        |
| `generation.ts` monolithic switch            | `primitive.execute()` called directly                                              |
| `config-panel.tsx` hardcoded switch          | `componentRegistry.get(type).ConfigPanel` lookup                                   |
| Node types disconnected from canvas types    | One primitive ID = one canonical type                                              |
| `concat` has no formal home                  | First-class primitive with `flow: null`                                            |
| LLM treated as non-generative                | Full primitive with skill + executor                                               |
| `/api/generate-image` separate per primitive | Unified `/api/primitives/[id]/execute` + deprecated facades                        |
| Firestore migration risk if types renamed    | Primitive IDs === existing type strings — zero migration                           |
| Operation keys hardcoded in tool schema      | Derived from `primitive.agent.operationId` (backward-compatible strings preserved) |
| React components mixed with server logic     | Two registries: execution (server-safe) + component (client-only)                  |
