# AGENTS.md

This file provides guidance to ai agents when working with code in this repository.

## Wiki & Documentation

The [wiki/architecture/architecture.md](file:///Users/mblanc/projects/flowcraft/wiki/architecture/architecture.md) file contains a comprehensive codebase map and architectural overview. Before implementing features or refactoring, consult this document to understand the system design.

**IMPORTANT**: You MUST maintain both [AGENTS.md](file:///Users/mblanc/projects/flowcraft/AGENTS.md) and [wiki/architecture/architecture.md](file:///Users/mblanc/projects/flowcraft/wiki/architecture/architecture.md) up to date when implementing tasks that modify the codebase structure, core layers, or commands.

## Commands

```bash
bun run dev          # Start Next.js dev server
bun run build        # Production build
bun run check        # TypeScript type-check (no emit)
bun run lint         # ESLint
bun run format       # Prettier
bun run test         # Vitest (run once)
bun run test:eval    # Run agent evaluation tests (checks planning)
bun run test:eval:e2e # Run isolated live end-to-end media generation evaluation tests (Gemini judge)
bun run test:ui      # Vitest with browser UI
bun run preflight    # format + check + lint + test (pre-merge gate)
```

Run a single test file or specific pattern:

```bash
bun run test src/__tests__/workflow-engine.test.ts
bun run test:eval -- canvas-e2e
```

The pre-commit hook runs lint-staged (format + lint on staged files). Never skip it with `--no-verify`.

## Architecture

Flowcraft is a **Next.js 16 / React 19** app with two distinct product surfaces built on the same stack.

### 1. Flow Editor (`/flow/[id]`)

A node-based pipeline builder powered by **@xyflow/react**. Users wire together nodes (LLM, image, video, music, text, file, upscale, resize, list, router, custom-workflow, workflow-input/output) into DAGs that execute sequentially or in batch.

Key layers:

- **`src/lib/schemas.ts`** — Zod schemas for all node `data` shapes; single source of truth for types (re-exported via `src/lib/types.ts`).
- **`src/lib/flow/node-registry.ts`** — Central registry mapping `NodeType → NodeDefinition`. Every node is adapted from a primitive (located in `src/primitives/`) and registered via `src/lib/node-adapters/index.ts`.
- **`src/lib/flow/workflow-engine.ts`** — Orchestrates execution: detects batch mode, fans out requests at `BATCH_CONCURRENCY`, and calls each node's executor via the registry.
- **`src/lib/store/use-flow-store.ts`** — Zustand store (sliced into `graph-slice` + `ui-slice`). Persisted to `localStorage` with transient fields stripped (`executing`, `batchProgress`, etc.).
- **`src/lib/node-adapters/utils/`** — Shared helpers: `mention-resolver.ts` resolves `@node` references in prompts; `execute-api-call.ts` wraps API routes; `node-helpers.ts` has `gatherInputs` utilities.

Adding a new node type: create a primitive definition in `src/primitives/<type>/definition.ts` along with `execute.ts`, `FlowNode.tsx`, and `ConfigPanel.tsx`, register it in `src/primitives/registry.ts`, `src/primitives/server-registry.ts`, and `src/primitives/component-registry.ts`, adapt it using `toNodeDefinition` in `src/lib/node-adapters/index.ts` (adding it to `allNodeDefinitions`), add the type to `NodeType` in `src/lib/types.ts`, and register its Zod schema in `src/lib/schemas.ts`.

### 2. Canvas (`/canvas/[id]`)

A freeform media workspace where an AI agent (Director/Agent A) orchestrates image and video generation via chat.

Key layers:

- **`src/lib/canvas/agent/agent-runner.ts`** — `CanvasAgentRunner` wraps the Google ADK. Two variants:
    - **Agent A** (`variant: "a"`): streaming LLM for simple image/video plans. Uses SSE streaming.
    - **Agent B / Director** (`variant: "b"`): multi-turn agentic loop with `ThinkingLevel.LOW`. Uses `StreamingMode.NONE` because SSE closes after the first turn. Loads pattern skills from `src/lib/canvas/agent/skills/patterns/` (e.g., `character-generation`, `long-video`, `storyboard`, `virtual-tryon`, `vox-director`).
- **`src/lib/canvas/agent/tools.ts`** — ADK tool definitions: `planImageGenerationTool`, `planVideoGenerationTool`, `planProductionTool`, `planTextNodesTool`, `suggestActionsTool`, `askUserTool`.
- **`src/lib/canvas/agent/topology.ts`** — Kahn's algorithm (`topoSort`) for DAG-aware parallel execution of production plans. Only `depends_on` edges create ordering constraints.
- **`src/lib/canvas/agent/prompt-engineer.ts`** — `PromptEngineer`: single-turn agent that enriches `PlanNode.promptIntent` → `PlanNode.prompt` using primitive skill docs from `src/lib/canvas/agent/skills/primitives/`.
- **`src/lib/canvas/agent/step-mapper.ts`** — Maps Director tool-call outputs into `GenerationStep[]`.
- **`src/lib/canvas/generation.ts`** — `executePlan`: enriches prompts via `PromptEngineer`, resolves step references (canvas node URIs + inter-step dependencies), calls `geminiService`/`storageService`, validates images against active rulesets, streams `StepEvent`s.
- **`src/lib/canvas/types.ts`** — All Canvas-specific types: `CanvasNode`, `ProductionPlan`, `PlanNode`, `PlanEdge`, `MediaOperation`, `GenerationStep`, `ChatMessage`.
- **`src/lib/store/use-canvas-store.ts`** — Zustand store for canvas state (nodes, messages, viewport).

Canvas API routes:

- `POST /api/canvases/[id]/chat` — streams `AgentEvent`s from the ADK runner (SSE).
- `POST /api/canvases/[id]/execute-plan` — runs an approved `AgentPlan` through `generation.ts` (SSE, `maxDuration: 300`).

### Shared Infrastructure

- **Auth**: `next-auth` v5 with Google provider (`src/auth.ts`). All API routes call `auth()` for session.
- **Persistence**: Firestore via `src/lib/firestore.ts`. Services in `src/lib/services/` wrap Firestore collections (`flow.service`, `canvas.service`, `library.service`, etc.).
- **Storage**: GCS via `src/lib/services/storage.service.ts`. Signed URLs cached in `src/lib/cache/signed-urls.ts` (pre-warmed after generation).
- **AI**: `@google/genai` for Gemini API calls; `@google/adk` for the canvas agent framework. Both use Vertex AI (configured in `src/lib/config.ts`).
- **UI**: shadcn/ui components in `src/components/ui/` (Radix primitives + Tailwind CSS v4). Node components (`FlowNode.tsx`, `CanvasNode.tsx`, `ConfigPanel.tsx`) live in `src/primitives/<type>/` with shared wrappers in `src/components/nodes/`.

### Path alias

`@/` resolves to `src/` everywhere (configured in `tsconfig.json` and `vitest.config.ts`).

## Testing

Tests live in `src/__tests__/`. Vitest with jsdom.

- **Unit and Integration Tests**: Run with `bun run test`. Integration tests (`.integration.test.ts`) hit real Gemini endpoints and require env vars — they are slow and not part of the default CI gate.
- **Agent Evaluation Tests**: Live under `src/__tests__/eval/` (`*.eval.test.ts`) and execute scenarios using real Gemini models to score agent planning, tool usage, and prompt engineering rules. Run via `bun run test:eval`.
- **E2E Live Generation Tests**: Run real image/video generations and evaluate visual quality using Gemini-as-a-judge with high media resolution. These are isolated and run via `bun run test:eval:e2e` (or filtered using `bun run test:eval -- canvas-e2e`).

Coverage thresholds: 60% lines/statements, 50% functions, 45% branches.
