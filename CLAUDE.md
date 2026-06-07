# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # Start Next.js dev server
bun run build        # Production build
bun run check        # TypeScript type-check (no emit)
bun run lint         # ESLint
bun run format       # Prettier
bun run test         # Vitest (run once)
bun run test:ui      # Vitest with browser UI
bun run preflight    # format + check + lint + test (pre-merge gate)
```

Run a single test file:

```bash
bun run test src/__tests__/workflow-engine.test.ts
```

The pre-commit hook runs lint-staged (format + lint on staged files). Never skip it with `--no-verify`.

## Architecture

Flowcraft is a **Next.js 15 / React 19** app with two distinct product surfaces built on the same stack.

### 1. Flow Editor (`/flow/[id]`)

A node-based pipeline builder powered by **@xyflow/react**. Users wire together nodes (LLM, image, video, text, file, upscale, resize, list, router, custom-workflow, workflow-input/output) into DAGs that execute sequentially or in batch.

Key layers:

- **`src/lib/schemas.ts`** — Zod schemas for all node `data` shapes; single source of truth for types (re-exported via `src/lib/types.ts`).
- **`src/lib/node-registry.ts`** — Central registry mapping `NodeType → NodeDefinition`. Every node exports a `NodeDefinition` from `src/lib/nodes/<type>.ts` with `gatherInputs` and `execute` methods.
- **`src/lib/workflow-engine.ts`** — Orchestrates execution: detects batch mode, fans out requests at `BATCH_CONCURRENCY`, and calls each node's executor via the registry.
- **`src/lib/store/use-flow-store.ts`** — Zustand store (sliced into `graph-slice` + `ui-slice`). Persisted to `localStorage` with transient fields stripped (`executing`, `batchProgress`, etc.).
- **`src/lib/nodes/shared/`** — Shared helpers: `mention-resolver.ts` resolves `@node` references in prompts; `execute-api-call.ts` wraps API routes; `node-helpers.ts` has `gatherInputs` utilities.

Adding a new node type: create `src/lib/nodes/<type>.ts` exporting a `NodeDefinition`, add it to `src/lib/nodes/index.ts`, add the type to `NodeType` in `src/lib/types.ts`, register a Zod schema in `schemas.ts`, and add a React component in `src/components/nodes/`.

### 2. Canvas (`/canvas/[id]`)

A freeform media workspace where an AI agent (Director/Agent A) orchestrates image and video generation via chat.

Key layers:

- **`src/lib/canvas/adk/runner.ts`** — `CanvasAgentRunner` wraps the Google ADK. Two variants:
    - **Agent A** (`variant: "a"`): streaming LLM for simple image/video plans. Uses SSE streaming.
    - **Agent B / Director** (`variant: "b"`): multi-turn agentic loop with `ThinkingLevel.LOW`. Uses `StreamingMode.NONE` because SSE closes after the first turn. Loads pattern skills from `src/lib/canvas/adk/skills/patterns/`.
- **`src/lib/canvas/adk/tools.ts`** — ADK tool definitions: `planImageGenerationTool`, `planVideoGenerationTool`, `planProductionTool`, `suggestActionsTool`.
- **`src/lib/canvas/adk/topology.ts`** — Kahn's algorithm (`topoSort`) for DAG-aware parallel execution of production plans. Only `depends_on` edges create ordering constraints.
- **`src/lib/canvas/adk/prompt-engineer.ts`** — `PromptEngineer`: single-turn agent that enriches `PlanNode.promptIntent` → `PlanNode.prompt` using primitive skill docs from `src/lib/canvas/adk/skills/primitives/`.
- **`src/lib/canvas/adk/step-mapper.ts`** — Maps Director tool-call outputs into `GenerationStep[]`.
- **`src/lib/canvas/generation.ts`** — `executePlan`: resolves step references (canvas node URIs + inter-step dependencies), calls `geminiService`/`storageService`, streams `StepEvent`s.
- **`src/lib/canvas/types.ts`** — All Canvas-specific types: `CanvasNode`, `ProductionPlan`, `PlanNode`, `PlanEdge`, `MediaOperation`, `GenerationStep`, `ChatMessage`.
- **`src/lib/store/use-canvas-store.ts`** — Zustand store for canvas state (nodes, messages, viewport).

Canvas API routes:

- `POST /api/canvases/[id]/chat` — streams `AgentEvent`s from the ADK runner (SSE).
- `POST /api/canvases/[id]/execute-plan` — runs an approved `AgentPlan` through `generation.ts` (SSE, `maxDuration: 300`).

### Shared Infrastructure

- **Auth**: `next-auth` v5 with Google provider (`src/auth.ts`). All API routes call `auth()` for session.
- **Persistence**: Firestore via `src/lib/firestore.ts`. Services in `src/lib/services/` wrap Firestore collections (`flow.service`, `canvas.service`, `library.service`, etc.).
- **Storage**: GCS via `src/lib/services/storage.service.ts`. Signed URLs cached in `src/lib/cache/signed-url-cache.ts` (pre-warmed after generation).
- **AI**: `@google/genai` for Gemini API calls; `@google/adk` for the canvas agent framework. Both use Vertex AI (configured in `src/lib/config.ts`).
- **UI**: shadcn/ui components in `src/components/ui/` (Radix primitives + Tailwind CSS v4). Flow node components in `src/components/nodes/`, config panels in `src/components/panels/`.

### Path alias

`@/` resolves to `src/` everywhere (configured in `tsconfig.json` and `vitest.config.ts`).

## Testing

Tests live in `src/__tests__/`. Vitest with jsdom. Integration tests (`.integration.test.ts`) hit real Gemini endpoints and require env vars — they are slow and not part of the default CI gate.

Coverage thresholds: 60% lines/statements, 50% functions, 45% branches.
