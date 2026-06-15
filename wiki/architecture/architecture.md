# Flowcraft — Developer Architecture Guide

A practical map of the codebase for engineers joining the project. Read this before touching anything.

---

## Table of Contents

1. [Big Picture](#1-big-picture)
2. [Product Surfaces](#2-product-surfaces)
3. [The Primitive System — the Spine of Everything](#3-the-primitive-system--the-spine-of-everything)
4. [Flow Editor Deep-Dive](#4-flow-editor-deep-dive)
5. [Canvas Deep-Dive](#5-canvas-deep-dive)
6. [Shared Infrastructure](#6-shared-infrastructure)
7. [Data Flow: End-to-End](#7-data-flow-end-to-end)
8. [Where to Look When Adding Features](#8-where-to-look-when-adding-features)
9. [Key Files Cheat Sheet](#9-key-files-cheat-sheet)

---

## 1. Big Picture

Flowcraft is a **Next.js 15 / React 19** app with **two distinct product surfaces** — a node-based pipeline builder (Flow) and a chat-driven media workspace (Canvas) — both backed by the same infrastructure stack.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser / Client                          │
│                                                                   │
│   ┌──────────────────────┐    ┌──────────────────────────────┐   │
│   │   Flow Editor        │    │   Canvas                     │   │
│   │   /flow/[id]         │    │   /canvas/[id]               │   │
│   │                      │    │                              │   │
│   │  Node graph UI       │    │  Freeform media board        │   │
│   │  (xyflow/react)      │    │  + AI chat panel             │   │
│   └──────────┬───────────┘    └───────────────┬──────────────┘   │
│              │                                │                   │
│        useFlowStore                    useCanvasStore             │
│        (Zustand)                       (Zustand)                  │
└──────────────┼────────────────────────────────┼──────────────────┘
               │           Next.js App Router    │
               ▼                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API Routes                                │
│                                                                   │
│  /api/flows/[id]          /api/canvases/[id]/chat    (SSE)       │
│  /api/primitives/[id]/execute                                     │
│  /api/canvases/[id]/execute-plan                     (SSE)       │
│  /api/upload-file    /api/signed-url                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   ┌───────────┐    ┌────────────┐    ┌───────────────┐
   │ Firestore │    │  Gemini /  │    │  Google Cloud │
   │  (DB)     │    │  ADK       │    │  Storage (GCS)│
   └───────────┘    └────────────┘    └───────────────┘
```

**Tech stack at a glance:**

| Concern         | Technology                                  |
| --------------- | ------------------------------------------- |
| Framework       | Next.js 15 (App Router)                     |
| UI              | React 19, shadcn/ui, Tailwind CSS v4        |
| Flow graph      | @xyflow/react                               |
| State           | Zustand (sliced, persisted to localStorage) |
| AI models       | @google/genai (Gemini direct API)           |
| Agent framework | @google/adk (for Canvas AI agent)           |
| Database        | Firestore                                   |
| File storage    | Google Cloud Storage (signed URLs)          |
| Auth            | next-auth v5 (Google OAuth)                 |
| Runtime         | Bun                                         |

---

## 2. Product Surfaces

### Flow Editor (`/flow/[id]`)

A **node-based pipeline builder** where users wire together nodes into a DAG that executes sequentially or in batch.

```
 ┌────────┐     ┌────────┐     ┌─────────┐
 │  File  │────▶│  LLM   │────▶│  Image  │
 └────────┘     └────────┘     └─────────┘
                                    │
                               ┌────▼────┐
                               │ Upscale │
                               └─────────┘

Nodes execute level-by-level (topological sort).
Batch mode: when an input node emits a list,
downstream nodes fan-out automatically.
```

### Canvas (`/canvas/[id]`)

A **freeform media workspace** where an AI agent (powered by Google ADK) orchestrates image and video generation via a chat interface.

```
  User types:  "make 3 variations of this image, then animate the best one"
                              │
                    ┌─────────▼──────────┐
                    │  CanvasAgentRunner │  (Google ADK)
                    │  - builds plan     │
                    │  - enriches prompts│
                    └─────────┬──────────┘
                              │  AgentPlan (GenerationStep[])
                    ┌─────────▼──────────┐
                    │  User approves     │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  executePlan()     │  topology.ts (Kahn's algo)
                    │  - parallel where  │  → geminiService
                    │    no dependency   │  → storageService
                    └─────────┬──────────┘
                              │
                    CanvasNode[] added to board
```

---

## 3. The Primitive System — the Spine of Everything

The most important concept in the codebase. A **Primitive** is a single descriptor object that tells the whole system everything it needs to know about a media capability (image generation, video, LLM, etc.).

```
src/primitives/
├── types.ts              ← Primitive<> interface definition
├── registry.ts           ← shared PrimitiveRegistry (client-safe)
├── server-registry.ts    ← server-side registry (with execute fns)
├── component-registry.ts ← React components (client-only)
│
└── image/
│   ├── definition.ts     ← THE primitive object
│   ├── execute.ts        ← server-side execution (API calls to Gemini)
│   ├── FlowNode.tsx      ← React node rendered in the flow editor
│   ├── CanvasNode.tsx    ← React node rendered on the canvas board
│   └── ConfigPanel.tsx   ← Side-panel config UI
│
└── video/ llm/ music/ upscale/ resize/ ... (same structure)
```

### What a Primitive looks like

```typescript
interface Primitive {
    id: string; // "image"
    label: string; // "Image Generation"
    mediaType: string; // "image"
    requestSchema: ZodType; // input validation
    outputShape: ZodType; // output validation
    execute: fn | null; // server-only: calls Gemini

    flow: {
        // describes the Flow Editor surface
        type: string; // NodeType: "image"
        gatherInputs: fn; // pull data from connected nodes
        mergeResults: fn; // merge batch results
        saveToLibrary: fn; // auto-save to media library
    } | null;

    canvas: {
        // describes the Canvas surface
        type: string; // "canvas-image"
        toCanvasData: fn; // generation result → canvas node data
        toRequest: fn; // GenerationStep → API request
    } | null;

    agent: {
        // ADK agent integration
        skillPath: string; // path to skill markdown docs
        operationId: string; // "t2i", "i2v" — used in prompts
    } | null;
}
```

### Three registries — know which one to use

| Registry            | File                               | Used by         | Contains                            |
| ------------------- | ---------------------------------- | --------------- | ----------------------------------- |
| `registry`          | `primitives/registry.ts`           | Client + Server | definition only (no execute)        |
| `serverRegistry`    | `primitives/server-registry.ts`    | API routes      | definition + execute fns            |
| `componentRegistry` | `primitives/component-registry.ts` | React UI        | FlowNode / CanvasNode / ConfigPanel |

This split is intentional: `execute` imports heavy server libraries; React components import browser-only code. The `registry` is the safe shared layer.

---

## 4. Flow Editor Deep-Dive

### Execution path

```
User clicks "Run"
      │
      ▼
use-flow-execution.ts
  → new WorkflowEngine(nodes, edges, onNodeUpdate, context)
  → engine.run()
        │
        ├─ getExecutionLevels()      topological sort → level[][]
        │
        └─ for each level (parallel):
               executeNodeSync(nodeId)
                    │
                    ├─ gatherInputs()       ← calls definition.gatherInputs()
                    │                         resolves upstream node data
                    │
                    ├─ detectBatchPlan()    ← is any input a list?
                    │
                    ├─ if batch:            fan-out at BATCH_CONCURRENCY
                    │     definition.execute() × N → mergeResults()
                    │
                    └─ if single:
                          definition.execute()
                               │
                               ▼
                     /api/primitives/[id]/execute
                               │
                               ▼
                      serverRegistry.execute()
                               │
                               ▼
                         geminiService / storageService
```

### Key files

| File                              | Responsibility                                                           |
| --------------------------------- | ------------------------------------------------------------------------ |
| `src/lib/schemas.ts`              | Zod schemas for every node's `data` shape — source of truth              |
| `src/lib/types.ts`                | TypeScript types, re-exported from schemas; `NodeType`, `NodeDefinition` |
| `src/lib/flow/workflow-engine.ts` | DAG execution, batch fan-out, sub-workflow recursion                     |
| `src/lib/flow/node-registry.ts`   | `getNodeDefinition(type)` — bridges old NodeDefinition to Primitive      |
| `src/lib/store/graph-slice.ts`    | Zustand graph state (nodes, edges, add/remove operations)                |
| `src/lib/store/ui-slice.ts`       | Zustand UI state (selectedNode, panel state)                             |
| `src/lib/store/use-flow-store.ts` | Combines slices, persists to localStorage                                |
| `src/hooks/use-flow-execution.ts` | React hook: triggers WorkflowEngine, streams updates to store            |

### Node anatomy

Every primitive in `src/primitives/<type>/` must export:

```
definition.ts    → Primitive object (no React, no heavy imports)
execute.ts       → async fn that calls Gemini/GCS (server-only)
FlowNode.tsx     → React component shown in the graph canvas
ConfigPanel.tsx  → (optional) side-panel for node configuration
CanvasNode.tsx   → (optional) React component for canvas board
```

### Adding a new Flow node type

1. Create `src/primitives/<type>/definition.ts` — export a `Primitive` object
2. Create `src/primitives/<type>/execute.ts` — server execution logic
3. Create `src/primitives/<type>/FlowNode.tsx` — React node UI
4. Register in `src/primitives/registry.ts` → `registry.register(...)`
5. Register in `src/primitives/server-registry.ts` → `serverRegistry.register({...primitive, execute})`
6. Register in `src/primitives/component-registry.ts` → `componentRegistry.register(id, {...})`
7. Add the type string to `NodeType` in `src/lib/types.ts`
8. Add a Zod schema in `src/lib/schemas.ts`

---

## 5. Canvas Deep-Dive

### Agent architecture

The canvas AI runs via **Google ADK** (Agent Development Kit). The agent is configured at runtime, not at build time — it reads skill docs from the filesystem.

```
src/lib/canvas/agent/
├── agent-runner.ts      ← CanvasAgentRunner — entry point, orchestrates everything
├── canvas-agent.ts      ← builds the ADK LlmAgent with tools + skills
├── prompts.ts           ← system instruction builders (context, style, defaults)
├── content-builder.ts   ← formats user message + attachments for ADK
├── event-extractor.ts   ← ADK events → typed AgentEvent stream
├── step-mapper.ts       ← tool call results → GenerationStep[]
├── prompt-engineer.ts   ← enriches step prompts via a second LLM call
├── session.ts           ← ADK session service (in-memory)
├── tools.ts             ← ADK tool definitions (planImageGenerationTool, etc.)
└── skills/
    ├── primitives/      ← Markdown docs fed to PromptEngineer
    └── patterns/        ← Markdown skill docs loaded into the agent
```

### Chat → Plan → Execute flow

```
POST /api/canvases/[id]/chat
        │
        ▼
CanvasAgentRunner.stream(input)
        │
        ├── buildDirectorInstruction()    build system prompt with:
        │     + buildCanvasContext()        - current board state
        │     + buildStyleInstruction()     - active style
        │     + imageDefaults/videoDefaults
        │
        ├── CanvasAgent.build()           ADK LlmAgent with tools:
        │     planImageGenerationTool      - planImageGenerationTool
        │     planVideoGenerationTool      - planVideoGenerationTool
        │     planProductionTool           - planProductionTool (multi-step)
        │     suggestActionsTool
        │
        ├── runner.runAsync()             ADK inference loop
        │
        ├── extractAgentEvents()          parse ADK events → AgentEvent stream
        │
        └── if event.type === "plan":
              promptEngineer.enrichSteps()   ← second LLM call per step
              yield enriched plan
              (user sees plan, must approve)
                    │
                    ▼ (user clicks Approve)
POST /api/canvases/[id]/execute-plan
        │
        ▼
executePlan(plan, canvasNodes)
        │
        ├── topoSort(steps)              Kahn's algorithm on dependsOn edges
        │
        └── for each topological level (parallel):
              resolveStepInputs()        resolve node URIs + inter-step refs
              primitive.canvas.toRequest()
              serverRegistry.execute()
              storageService.upload()
              → StepEvent stream → client adds CanvasNode to board
```

### Key canvas types (`src/lib/canvas/types.ts`)

| Type             | What it is                                                                          |
| ---------------- | ----------------------------------------------------------------------------------- |
| `CanvasNode`     | A node on the board (`canvas-image`, `canvas-video`, `canvas-text`, `canvas-audio`) |
| `GenerationStep` | A single AI generation task (image or video), with dependencies                     |
| `AgentPlan`      | `{ steps: GenerationStep[] }` — what the agent produces                             |
| `ChatMessage`    | A message in the chat panel, may carry a plan                                       |
| `AgentEvent`     | SSE event: `text`, `thought`, `plan`, `agent_action`, `done`, `error`               |
| `CanvasDocument` | Firestore document: nodes + messages + viewport                                     |

---

## 6. Shared Infrastructure

### Authentication

`src/auth.ts` — next-auth v5 with Google provider. Every API route calls `auth()` to get the session. User ID is passed into `ExecutionContext` for library saving.

### Persistence (Firestore)

```
src/lib/db/firestore.ts          ← Firestore client + document types
src/lib/services/
├── flow.service.ts              ← CRUD for Flow documents
├── canvas.service.ts            ← CRUD for Canvas documents
├── library.service.ts           ← Media library (generated assets)
├── custom-node.service.ts       ← User-defined reusable sub-flows
├── storage.service.ts           ← GCS upload/download
├── gemini.service.ts            ← Gemini API wrappers
└── concat.service.ts            ← Video concatenation
```

### File storage (GCS)

Files are stored in GCS. The app never exposes raw GCS URIs to the browser — it fetches short-lived signed URLs via `/api/signed-url`. These are cached in `src/lib/cache/signed-urls.ts` and pre-warmed after each generation so there's no flash on first render.

### AI services (`src/lib/services/gemini.service.ts`)

Wraps `@google/genai` for:

- Image generation (Imagen)
- Video generation (Veo)
- LLM text generation
- Upscale / resize operations

Vertex AI credentials are configured in `src/lib/config.ts`.

### State management

```
Flow surface:                         Canvas surface:
┌─────────────────────────────┐       ┌────────────────────────────┐
│ use-flow-store.ts           │       │ use-canvas-store.ts        │
│                             │       │                            │
│  graph-slice.ts             │       │  nodes[]                   │
│    nodes[], edges[]         │       │  messages[]                │
│    add/remove/update ops    │       │  viewport                  │
│                             │       │  executingPlan             │
│  ui-slice.ts                │       │  pendingPlan               │
│    selectedNodeId           │       └────────────────────────────┘
│    panel state              │
└─────────────────────────────┘

Both: Zustand, persisted to localStorage (transient fields stripped on save)
```

---

## 7. Data Flow: End-to-End

### Flow execution (single node, no batch)

```
1.  User clicks "Run node"
2.  useFlowExecution hook → WorkflowEngine.executeNode(nodeId)
3.  WorkflowEngine.gatherInputs(node)
       → reads upstream nodes from nodesMap + executionResults
       → calls primitive.flow.gatherInputs(node, edges, getSourceData)
       → returns typed request object (e.g., ImageRequest)
4.  primitive.flow.execute is delegated to the API:
       POST /api/primitives/image/execute  { body: ImageRequest }
5.  API route: auth() → serverRegistry.execute(inputs, {userId})
       → geminiService.generateImage(...)
       → storageService.upload(buffer) → GCS URI
       → return { imageUrl: "gs://..." }
6.  WorkflowEngine receives result
       → prewarmSignedUrls(result)   (pre-fetch signed URL)
       → onNodeUpdate(nodeId, { ...result, executing: false })
       → Zustand store updates → React re-renders node
7.  fire-and-forget: saveToLibrary(node, result)
```

### Canvas generation (after user approves plan)

```
1.  User clicks "Approve" on a plan in chat
2.  useCanvasStore.approvePlan()
       → POST /api/canvases/[id]/execute-plan  { plan, canvasNodes }
3.  Route: auth() → executePlan(plan, canvasNodes)
4.  topoSort(steps) groups steps by dependency level
5.  For each level, parallel:
       a. resolveStepInputs() — map nodeIds to signed URLs / GCS URIs
       b. primitive.canvas.toRequest(step, ctx)
       c. serverRegistry.execute(request, ctx)
       d. storageService.upload(result)
       e. yield StepEvent { type: "step_done", nodeId, ... }
6.  Client SSE reader appends CanvasNode to store
7.  useCanvasPersistence debounces save to Firestore
```

---

## 8. Where to Look When Adding Features

### Adding a new node type to the Flow editor

| Step                  | Where                                                        |
| --------------------- | ------------------------------------------------------------ |
| Define the data shape | `src/lib/schemas.ts` — add a new Zod schema                  |
| Add the type string   | `src/lib/types.ts` — `NodeType` union                        |
| Create the primitive  | `src/primitives/<type>/definition.ts`                        |
| Server execution      | `src/primitives/<type>/execute.ts`                           |
| Flow node UI          | `src/primitives/<type>/FlowNode.tsx`                         |
| Config panel          | `src/primitives/<type>/ConfigPanel.tsx` (optional)           |
| Register everywhere   | `registry.ts`, `server-registry.ts`, `component-registry.ts` |

### Adding a new canvas node type

| Step                            | Where                                                |
| ------------------------------- | ---------------------------------------------------- |
| Extend `CanvasNode` type        | `src/lib/canvas/types.ts`                            |
| Add canvas surface to primitive | `primitive.canvas.{ type, toCanvasData, toRequest }` |
| Canvas UI component             | `src/primitives/<type>/CanvasNode.tsx`               |
| Register component              | `componentRegistry.register(id, { CanvasNode })`     |

### Changing how the AI agent plans

| Goal                           | Where                                                    |
| ------------------------------ | -------------------------------------------------------- |
| Modify system prompt           | `src/lib/canvas/agent/prompts.ts`                        |
| Add/remove ADK tools           | `src/lib/canvas/agent/tools.ts` + `canvas-agent.ts`      |
| Change prompt enrichment logic | `src/lib/canvas/agent/prompt-engineer.ts`                |
| Add agent skill knowledge      | `src/lib/canvas/agent/skills/patterns/` (markdown files) |
| Change how tool calls → steps  | `src/lib/canvas/agent/step-mapper.ts`                    |

### Changing persistence

| Goal                     | Where                                                            |
| ------------------------ | ---------------------------------------------------------------- |
| Add a field to a Flow    | `src/lib/db/firestore.ts` (document type) + `src/lib/schemas.ts` |
| Add a field to a Canvas  | `src/lib/canvas/types.ts` (CanvasDocument)                       |
| Change Firestore queries | `src/lib/services/<surface>.service.ts`                          |

### Changing execution infrastructure

| Goal                        | Where                                                       |
| --------------------------- | ----------------------------------------------------------- |
| Adjust batch concurrency    | `src/lib/flow/workflow-engine.ts` (`BATCH_CONCURRENCY`)     |
| Adjust sub-workflow logic   | `WorkflowEngine.executeSubWorkflow()`                       |
| Change how GCS URLs resolve | `src/lib/cache/signed-urls.ts` + `src/lib/utils/gcs-uri.ts` |
| Add a new Gemini model      | `src/lib/constants.ts` (`MODELS`)                           |

---

## 9. Key Files Cheat Sheet

```
src/
├── lib/
│   ├── schemas.ts                ★ Zod schemas for all node data — start here
│   ├── types.ts                  ★ NodeType, NodeDefinition, re-exports
│   ├── constants.ts              ★ MODELS, BATCH_CONCURRENCY, etc.
│   ├── config.ts                 Vertex AI / GCP config
│   │
│   ├── flow/
│   │   ├── workflow-engine.ts    ★ DAG execution, batch, sub-workflows
│   │   └── node-registry.ts     bridges Primitive → NodeDefinition interface
│   │
│   ├── canvas/
│   │   ├── types.ts              ★ CanvasNode, AgentPlan, ChatMessage, etc.
│   │   ├── generation.ts         ★ executePlan() — resolves + executes a plan
│   │   └── agent/
│   │       ├── agent-runner.ts   ★ CanvasAgentRunner (entry point)
│   │       ├── canvas-agent.ts   ADK LlmAgent builder
│   │       ├── tools.ts          ADK tool definitions
│   │       ├── prompts.ts        system instruction builders
│   │       ├── prompt-engineer.ts prompt enrichment
│   │       ├── event-extractor.ts ADK events → AgentEvent
│   │       └── step-mapper.ts    tool output → GenerationStep
│   │
│   ├── store/
│   │   ├── use-flow-store.ts     ★ Zustand store for flow editor
│   │   ├── use-canvas-store.ts   ★ Zustand store for canvas
│   │   ├── graph-slice.ts        flow graph state + operations
│   │   └── ui-slice.ts           flow UI state
│   │
│   ├── db/
│   │   ├── firestore.ts          Firestore client + document types
│   │   └── storage.ts            GCS client helpers
│   │
│   └── services/
│       ├── gemini.service.ts     ★ Gemini API wrappers
│       ├── storage.service.ts    GCS upload/download
│       ├── flow.service.ts       Flow CRUD
│       └── canvas.service.ts     Canvas CRUD
│
├── primitives/
│   ├── types.ts                  ★ Primitive<> interface
│   ├── registry.ts               ★ shared PrimitiveRegistry + registrations
│   ├── server-registry.ts        ★ server-side registry (with execute fns)
│   ├── component-registry.ts     ★ React component registry
│   └── <type>/
│       ├── definition.ts         ★ THE primitive descriptor
│       ├── execute.ts            server-side execution
│       ├── FlowNode.tsx          flow editor UI
│       ├── CanvasNode.tsx        canvas board UI (if applicable)
│       └── ConfigPanel.tsx       config side-panel (if applicable)
│
├── app/api/
│   ├── primitives/[primitiveId]/execute/route.ts  ★ unified execution endpoint
│   ├── canvases/[id]/chat/route.ts                ★ canvas agent SSE stream
│   └── canvases/[id]/execute-plan/route.ts        ★ plan execution SSE stream
│
└── hooks/
    ├── use-flow-execution.ts   ★ triggers WorkflowEngine, bridges to store
    └── use-canvas-persistence.ts  debounced canvas save to Firestore
```

---

## Mental Models to Internalize

**Primitive = everything about a capability in one place.** Before adding code anywhere, ask: does this belong in the primitive's `definition.ts`? If it's about what a node does, how it gathers inputs, or how it saves results — yes.

**Three registries, three concerns.** `registry` (shared logic) vs `serverRegistry` (adds execute) vs `componentRegistry` (adds React). Never import `execute.ts` or React components from server code.

**Canvas and Flow share primitives but not execution paths.** Flow uses `WorkflowEngine` + `primitive.flow.*`. Canvas uses `executePlan()` + `primitive.canvas.*`. The Primitive type makes this explicit.

**SSE everywhere for long-running operations.** Both the canvas agent (`/chat`) and plan execution (`/execute-plan`) stream Server-Sent Events. The client reads them in `useCanvasStore` action handlers.

**Signed URLs hide GCS.** Raw `gs://` URIs live only on the server. The browser always sees short-lived HTTPS URLs fetched via `/api/signed-url`, pre-warmed and cached in `signed-urls.ts`.
