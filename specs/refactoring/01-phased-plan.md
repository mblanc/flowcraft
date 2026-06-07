# Phased Implementation Plan: Primitive Registry Refactoring

> Builds on `00-architecture-analysis.md`.  
> Each phase is independently shippable. Tests must pass at the end of every phase.

---

## Guiding principles

- **Additive first** — the new registry coexists with the existing `NodeDefinition` system until all primitives are migrated. No big-bang cutover.
- **One primitive at a time** — migrate, run preflight, merge. Never migrate two primitives in the same PR.
- **Zero behaviour change per phase** — each phase is a pure refactor unless explicitly noted. Existing tests must stay green; no new features until Phase 5.
- **Delete old code immediately** — once a primitive is migrated and its tests pass, remove the old `src/lib/nodes/<type>.ts`, `src/components/nodes/<type>.tsx`, and `src/components/panels/<type>-config.tsx`. No dead code.

---

## Phase 1 — Foundation: define the interface, shared hook, adapter

**Goal:** The `Primitive` interface exists. Existing code is untouched. One shared resize hook replaces the two duplicates.

### 1.1 — Define `Primitive` interface

Create `src/lib/primitives/types.ts` — **no React imports in this file**:

```typescript
interface Primitive<TFlowData, TCanvasData, TRequest, TOutput> {
    // Identity
    id: string; // "image", "video", "music" — must match existing Firestore type strings
    label: string; // "Image Generation"
    mediaType: "image" | "video" | "audio" | "text" | "any" | null;

    // Schemas
    requestSchema: z.ZodType<TRequest> | null; // input to execute() + unified API endpoint
    outputShape: z.ZodType<TOutput> | null;

    // Server-side execution — ONE implementation; called by unified API route and directly by generation.ts
    execute:
        | ((inputs: TRequest, ctx: ServerContext) => Promise<TOutput>)
        | null;

    // Flow surface (server-safe: no React)
    flow: {
        type: string; // "image" — must match Firestore node type strings
        inputs: Record<string, string>;
        outputs: Record<string, string>;
        gatherInputs: (node, edges, getSourceData) => TRequest;
        mergeResults: (results: Partial<TFlowData>[]) => Partial<TFlowData>;
        saveToLibrary: (
            node,
            result: TOutput,
            ctx: ServerContext,
        ) => Promise<void>;
    } | null;

    // Canvas surface (server-safe: no React)
    canvas: {
        type: string; // "canvas-image" — must match Firestore canvas node type strings
        toCanvasData: (step: GenerationStep, result: TOutput) => TCanvasData;
    } | null;

    // Agent surface
    agent: {
        skillPath: string | null; // absolute path to SKILL.md
        operationId: string; // "t2i", "i2v" — must match strings in existing Firestore chat history
    } | null;
}
```

Create `src/lib/primitives/registry.ts` — **server-safe, imported anywhere**:

```typescript
class PrimitiveRegistry {
    register(primitive: Primitive): void;
    get(id: string): Primitive | undefined;
    getByFlowType(type: string): Primitive | undefined;
    getByCanvasType(type: string): Primitive | undefined;
    flowTypes(): string[];
    canvasTypes(): string[];
    operationIds(): string[]; // for Director tool schema — derived, backward-compatible
    primitiveIds(): string[];
}

export const registry = new PrimitiveRegistry();
```

Create `src/lib/primitives/component-registry.ts` — **client-only, imported only in React trees**:

```typescript
interface PrimitiveComponents<TFlowData, TCanvasData> {
    FlowNode: React.ComponentType<NodeProps<Node<TFlowData>>>;
    CanvasNode: React.ComponentType<CanvasNodeProps<TCanvasData>> | null;
    ConfigPanel: React.ComponentType<{
        data: TFlowData;
        nodeId: string;
    }> | null;
}

class ComponentRegistry {
    register(id: string, components: PrimitiveComponents): void;
    get(id: string): PrimitiveComponents | undefined;
}

export const componentRegistry = new ComponentRegistry();
```

### 1.2 — `Primitive` → `NodeDefinition` adapter

So existing `WorkflowEngine` / `node-registry.ts` code continues working during migration:

```typescript
// src/lib/primitives/adapters.ts
export function toNodeDefinition(p: Primitive): NodeDefinition {
    if (!p.flow) throw new Error(`Primitive ${p.id} has no flow surface`);
    return {
        type: p.flow.type,
        inputs: p.flow.inputs,
        outputs: p.flow.outputs,
        gatherInputs: p.flow.gatherInputs,
        execute: p.flow.execute,
    };
}
```

`src/lib/nodes/index.ts` gains one line per migrated primitive; everything else unchanged.

### 1.3 — Unified API endpoint

Create `src/app/api/primitives/[primitiveId]/execute/route.ts`:

```typescript
export const POST = withAuth(async (req, { params }) => {
    const primitive = registry.get(params.primitiveId);
    if (!primitive?.execute)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    const parsed = primitive.requestSchema!.safeParse(await req.json());
    if (!parsed.success)
        return NextResponse.json(
            { error: "Validation failed", details: parsed.error },
            { status: 400 },
        );
    const result = await primitive.execute(parsed.data, { userId: req.userId });
    return NextResponse.json(result);
});
```

Rewrite old routes as deprecated facades (do **not** delete them yet — stale clients must keep working):

```typescript
// src/app/api/generate-image/route.ts  (Deprecated facade)
export const POST = withAuth(async (req) => {
    const body = await req.json();
    const result = await registry.get("image")!.execute!(body, {
        userId: req.userId,
    });
    return NextResponse.json({ imageUrl: result.images[0] });
});
```

**Acceptance criteria:** new endpoint exists and returns correct results; old endpoints still return correct results with a deprecation warning logged.

### 1.4 — Shared resize hook

Replace the two near-identical hooks with one:

```typescript
// src/hooks/use-media-node-resize.ts
export function useMediaNodeResize(
    id: string,
    dataWidth: number | undefined,
    dataHeight: number | undefined,
    options: ResizeOptions,
    onCommit: (id: string, dims: { width: number; height: number }) => void,
);
```

- Flow nodes pass `updateNodeData` (from `useFlowStore`)
- Canvas nodes pass `updateNode` (from `useCanvasStore`)
- Delete `use-node-resize.ts` and `use-canvas-node-resize.ts` after updating all call sites

**Acceptance criteria:**

- `bun run preflight` passes
- `use-node-resize.ts` and `use-canvas-node-resize.ts` are deleted
- `POST /api/primitives/image/execute` returns a valid image result
- `POST /api/generate-image` still returns a valid result (facade)
- No existing node component changes behaviour

---

## Phase 2 — Migrate media primitives: image, video, upscale, resize

Migrate the four media-generative primitives one PR each. Order: `image` → `video` → `upscale` → `resize` (in dependency order; later ones can reference earlier patterns).

### Per-primitive migration checklist

For each (`image` shown as example):

1. Create `src/lib/primitives/image/`
    - `definition.ts` — the `Primitive` object: `execute()`, schemas, `flow.gatherInputs`, `flow.mergeResults`, `canvas.toCanvasData` — **no React imports**
    - `FlowNode.tsx` — `'use client'`, moved from `src/components/nodes/image-node.tsx`
    - `ConfigPanel.tsx` — `'use client'`, moved from `src/components/panels/image-config.tsx` (omit if none)
    - `CanvasNode.tsx` — `'use client'`, moved from `src/components/canvas/nodes/canvas-image-node.tsx`
    - `SKILL.md` — symlink or copy from `skills/primitives/image-generation/SKILL.md`

2. Register definition in `src/lib/primitives/registry.ts`

3. Register components in `src/lib/primitives/component-registry.ts`:

    ```typescript
    import { FlowNode } from "@/lib/primitives/image/FlowNode";
    import { CanvasNode } from "@/lib/primitives/image/CanvasNode";
    import { ConfigPanel } from "@/lib/primitives/image/ConfigPanel";
    componentRegistry.register("image", { FlowNode, CanvasNode, ConfigPanel });
    ```

4. Add adapter to `src/lib/nodes/index.ts`:

    ```typescript
    import { imagePrimitive } from "@/lib/primitives/image/definition";
    export const imageNodeDefinition = toNodeDefinition(imagePrimitive);
    ```

5. Update `config-panel.tsx` to use `componentRegistry` lookup (once first primitive is done, the switch shrinks by 1 each PR)

6. Verify backward compatibility:
    - Existing flow documents with `type: "image"` still load correctly
    - `POST /api/generate-image` (facade) still returns a valid result
    - Existing canvas documents with `type: "canvas-image"` still render correctly

7. Delete:
    - `src/lib/nodes/image-node.ts`
    - `src/components/nodes/image-node.tsx`
    - `src/components/panels/image-config.tsx`
    - `src/components/canvas/nodes/canvas-image-node.tsx`

8. Run `bun run preflight` — must pass

**Shared data base** (do once, before migrating first primitive):

Extract a shared base for flow+canvas image/video data to stop field-name drift:

```typescript
// src/lib/primitives/image/types.ts
interface ImageNodeBase {
    prompt?: string;
    aspectRatio?: string;
    model?: string;
    // ... shared fields
}
interface FlowImageData extends ImageNodeBase { type: "image"; executing?: boolean; ... }
interface CanvasImageData extends ImageNodeBase { type: "canvas-image"; status: ...; sourceUrl: string; }
```

This is the only phase where types change. Keep a compatibility alias in `src/lib/types.ts` pointing to the new location.

**Acceptance criteria per primitive:**

- All existing tests pass
- Old files deleted
- `config-panel.tsx` has one fewer `if` branch
- `canvas-image-node.tsx` (or equivalent) deleted and replaced

---

## Phase 3 — Migrate non-media flow primitives

Migrate: `llm`, `text`, `file`, `list`, `router`, `workflow-input`, `workflow-output`, `custom-workflow`.

These have `canvas: null` and `agent: null` (except `llm` which gets `agent: { skillPath: null, operationId: "llm" }`).

Same per-primitive checklist as Phase 2, minus the canvas and agent surface.

After this phase: `config-panel.tsx` is a pure registry lookup with no `if` branches. `src/lib/nodes/index.ts` is a list of `toNodeDefinition(registry.get("x")!)` calls.

**Acceptance criteria:**

- `config-panel.tsx` contains zero `if (data.type === ...)` branches
- All tests pass
- All old `src/lib/nodes/<type>.ts` files deleted

---

## Phase 4 — Wire registry into the agent layer

Now that all primitives are registered, replace hardcoded agent-layer code with registry lookups.

### 4.1 — Replace `SKILL_FOR_TYPE` in `prompt-engineer.ts`

```typescript
// Before
const SKILL_FOR_TYPE = { image: "image-generation", video: "video-generation" };
const skillName = SKILL_FOR_TYPE[step.type];

// After
const primitive = registry.getByCanvasType(`canvas-${step.type}`);
const skillPath = primitive?.agent?.skillPath;
```

### 4.2 — Replace `generation.ts` switch

`executePlan` currently has a switch on `step.type` to call the right API. Replace with:

```typescript
const primitive = registry.getByCanvasType(`canvas-${step.type}`);
const request =
    primitive.canvas!.toCanvasData; /* no — use a toRequest adapter */
// Map GenerationStep → requestSchema-typed input, then call execute() directly (no HTTP hop)
const request = mapStepToRequest(step, ctx); // resolves references, maps to requestSchema shape
const output = await primitive.execute!(request, { userId: ctx.userId });
const node = primitive.canvas!.toCanvasData(step, output);
```

### 4.3 — Derive Director tool `operation` enum from registry

`planProductionTool` in `tools.ts` has a hardcoded `operation` enum. Replace with:

```typescript
const operationIds = registry.operationIds();
// used to build the JSON schema for plan_production dynamically
```

### 4.4 — `concat` primitive

Create `src/lib/primitives/concat/definition.ts` with `flow: null`. Wire its `canvas.execute()` into `generation.ts` to replace the current concat branch.

### 4.5 — Replace `mergeResults` and `saveToLibrary` switches in `workflow-engine.ts`

```typescript
// Before
const merged = mergeResults(batchResults, node.data.type); // big switch

// After
const primitive = registry.getByFlowType(node.data.type);
const merged = primitive!.flow!.mergeResults(batchResults);
```

```typescript
// Before
saveToLibrary(node, result, type); // big switch

// After
await primitive!.flow!.saveToLibrary(node, result, ctx);
```

**Acceptance criteria:**

- `workflow-engine.ts` contains no node-type switch
- `prompt-engineer.ts` contains no `SKILL_FOR_TYPE`
- `generation.ts` contains no step-type switch
- `tools.ts` derives operation enum from `registry.operationIds()`
- All deprecated API facades (`/api/generate-image`, `/api/generate-video`) still return correct results
- Existing `plan_production` tool call strings (`"t2i"`, `"i2v"`, etc.) still validate against the derived tool schema
- All tests pass

---

## Phase 5 — First new primitive via the registry: music generation (or any new capability)

This phase validates the refactoring. Adding a new primitive should touch **only**:

1. `src/lib/primitives/music/` — new directory with definition, components, SKILL.md
2. `src/lib/primitives/registry.ts` — one `registry.register(musicPrimitive)` line
3. `src/app/api/generate-music/route.ts` — new API route

Zero changes to: `workflow-engine.ts`, `config-panel.tsx`, `prompt-engineer.ts`, `generation.ts`, `tools.ts`, `types.ts`, `schemas.ts`, `src/lib/nodes/index.ts`.

If any of those files need touching, a phase was incomplete.

Also verify that deprecated API facades can be deleted in this phase (all flow nodes now call `/api/primitives/[id]/execute`) — or explicitly carry the deletion into a cleanup PR if rollout requires a longer overlap window.

---

## Summary

| Phase | Work                                                                              | Risk   | Outcome                                                                                                   |
| ----- | --------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| 1     | Interface + component registry + unified API route + adapter + shared resize hook | Low    | Foundation in place, zero behaviour change; deprecated facades live alongside new endpoint                |
| 2     | Migrate image, video, upscale, resize                                             | Medium | Media primitives self-contained; components in component-registry; backward-compat verified per primitive |
| 3     | Migrate llm, text, file, list, router, etc.                                       | Low    | `config-panel.tsx` switch-free; `component-registry` is the sole UI lookup                                |
| 4     | Wire registry into agent layer                                                    | Medium | All hardcoded switches gone; deprecated API facades can be deleted                                        |
| 5     | Add first new primitive                                                           | Low    | Validates the whole system                                                                                |

Estimated PRs: ~16 (1 per primitive, plus foundation, agent wiring, and deprecated-route cleanup).  
Each PR is independently reviewable and safe to merge.
