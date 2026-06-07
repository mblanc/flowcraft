# SPEC: Migrate Canvas Agent to Google ADK (TypeScript)

## 1. Objective

Migrate the canvas chat agent from a hand-rolled structured-JSON approach to Google ADK (`@google/adk` v1.x) in TypeScript, staying within the existing Next.js monorepo. The goals are:

- **Tool use / function calling**: Replace the monolithic structured-JSON schema with discrete ADK `FunctionTool` definitions (`plan_image_generation`, `plan_video_generation`) so each generation intent is an explicit, typed function call.
- **Session & memory management**: Use ADK's built-in session service (in-memory for dev, Firestore-backed for prod) to manage conversation history, replacing the manual `history` array passed on every request.
- **Multi-agent orchestration**: Introduce a two-agent topology — an `OrchestratorAgent` that handles intent + tool planning, delegating to a `MediaPlannerAgent` that owns the generation tools.
- **No frontend contract change**: Keep the same SSE event stream (`text`, `plan`, `actions`, `done`) from the Next.js API route. The frontend is unaware of the ADK migration.

**Target users**: The same users as today — no UX change. This is a backend refactor.

---

## 2. Architecture Overview

### Current

```
POST /api/canvases/[id]/chat
  → streamAgentResponse() [src/lib/canvas/agent.ts]
      → geminiService.generateStructured() [single-pass structured JSON]
      → yields: text | plan | actions | done

POST /api/canvases/[id]/execute-plan
  → executePlan() [src/lib/canvas/generation.ts]
      → calls Imagen/Veo APIs per step
```

### Target

```
POST /api/canvases/[id]/chat
  → CanvasAgentRunner.stream() [src/lib/canvas/adk/runner.ts]
      → OrchestratorAgent (ADK LlmAgent)
          → delegates to MediaPlannerAgent (sub-agent)
              → FunctionTool: plan_image_generation()
              → FunctionTool: plan_video_generation()
      → ADK session auto-manages history (keyed on canvasId)
      → yields same SSE events: text | plan | actions | done

POST /api/canvases/[id]/execute-plan
  → executePlan() [unchanged — src/lib/canvas/generation.ts]
```

The plan/approve/execute two-step flow is **preserved**: ADK tools return a generation plan (not the actual media). Execution still happens via the separate `/execute-plan` route after user approval.

---

## 3. Project Structure

New files under `src/lib/canvas/adk/`:

```
src/lib/canvas/adk/
├── agents.ts          # OrchestratorAgent + MediaPlannerAgent definitions
├── tools.ts           # plan_image_generation, plan_video_generation FunctionTool definitions
├── runner.ts          # CanvasAgentRunner: wraps ADK runner → yields AgentEvent stream
├── session.ts         # ADK session service (InMemorySessionService dev / Firestore prod)
└── types.ts           # ADK-specific input/output types
```

Existing files that change:

- `src/lib/canvas/agent.ts` — replaced by `src/lib/canvas/adk/runner.ts` (old file removed or kept as re-export shim)
- `src/app/api/canvases/[id]/chat/route.ts` — `streamAgentResponse` import swapped to `CanvasAgentRunner.stream()`

Existing files that stay unchanged:

- `src/lib/canvas/types.ts`
- `src/lib/canvas/generation.ts`
- `src/app/api/canvases/[id]/execute-plan/route.ts`
- All frontend components

---

## 4. ADK Design

### 4.1 Tools (`tools.ts`)

Two function tools, typed with Zod schemas:

**`plan_image_generation`**

- Input: `{ steps: ImageStep[] }` where `ImageStep` = `{ id, prompt, label, aspectRatio?, resolution?, model?, referenceNodeIds?, dependsOn? }`
- Output: `{ steps: ImageStep[] }` (pass-through — the tool is a planning declaration, not execution)

**`plan_video_generation`**

- Input: `{ steps: VideoStep[] }` where `VideoStep` = `{ id, prompt, label, aspectRatio?, resolution?, model?, duration?, generateAudio?, referenceNodeIds?, firstFrameNodeId?, lastFrameNodeId?, dependsOn? }`
- Output: `{ steps: VideoStep[] }` (pass-through)

The tool implementations do not call Imagen/Veo — they just validate and return the steps. The `MediaPlannerAgent` calls these tools and the runner extracts the results to form the `AgentPlan`.

### 4.2 Agents (`agents.ts`)

**`MediaPlannerAgent`** (`LlmAgent`)

- Model: `gemini-2.0-flash` (or overridden)
- Tools: `[plan_image_generation, plan_video_generation]`
- System instruction: focused on media planning — extract generation steps from user intent, apply canvas context, output tool calls
- Stateless — no session

**`OrchestratorAgent`** (`LlmAgent`)

- Model: `gemini-2.5-flash`
- Sub-agents: `[MediaPlannerAgent]`
- Tools: none
- System instruction: conversational handler — decides if media generation is needed, delegates to `MediaPlannerAgent`, writes `conversationalText` and `suggestedActions`
- **Owns the ADK session** (keyed on `canvasId`)

### 4.3 Session (`session.ts`)

```typescript
// Dev: InMemorySessionService (per-process)
// Prod: FirestoreSessionService (keyed on userId+canvasId)
```

Session ID = `${userId}:${canvasId}`

On first message, if ADK session is empty but canvas has existing `messages`, seed the session from Firestore history to preserve continuity.

### 4.4 Runner (`runner.ts`)

`CanvasAgentRunner` wraps the ADK `Runner` and maps ADK events → existing `AgentEvent` type (`text | plan | actions | done`):

- ADK text events → `{ type: "text", delta }`
- Tool call `plan_image_generation` / `plan_video_generation` results → accumulated into `AgentPlan`, emitted as `{ type: "plan", plan }`
- Suggested actions extracted from final assistant message → `{ type: "actions", actions }`
- On stream end → `{ type: "done" }`

The video fallback logic (`applyVideoFallback`) and node ID validation remain in the runner.

---

## 5. Acceptance Criteria

### Functional

- [ ] Chat messages stream correctly (text delta events arrive in order)
- [ ] Single-image request → `plan` event with 1 step
- [ ] Multi-step request ("4 variants") → `plan` event with 4 steps
- [ ] Sequential workflow ("portrait then animate") → plan with `dependsOn` wired
- [ ] Video-with-attachment fallback applied correctly (firstFrameNodeId auto-set)
- [ ] Suggested actions appear after every agent response
- [ ] Canvas context (nodes) injected into agent system prompt correctly
- [ ] Active style applied to all generation steps
- [ ] Session history persists across turns (second message references first without re-sending history)
- [ ] `execute-plan` route unchanged — regeneration still works
- [ ] Auth / unauthorized still returns 401/403

### Non-functional

- [ ] SSE contract identical — no frontend changes required
- [ ] `bun run preflight` passes (lint + types + tests)
- [ ] Existing `canvas-agent.test.ts` updated to cover ADK runner
- [ ] No secrets in source; ADK configured via existing env vars (`PROJECT_ID`, `LOCATION`)

---

## 6. Code Style & Constraints

- TypeScript strict mode, no `any` except at ADK boundary types
- No comments except for non-obvious invariants
- No new env vars; reuse `PROJECT_ID` / `LOCATION` for ADK's Vertex AI backend
- `@google/adk` added to `package.json` dependencies
- Session service injected (not hard-coded) so tests can use InMemory
- `applyVideoFallback` and node ID validation stay in runner (not duplicated in tools)

---

## 7. Testing Strategy

- **Unit tests** (`canvas-agent.test.ts` adapted): mock ADK `Runner`, assert `AgentEvent` output for known inputs (single image, multi-step, sequential video, no-generation text reply)
- **Integration tests**: existing `llm-multimodal.integration.test.ts` pattern — optional, guarded by `INTEGRATION_TEST=true`
- No E2E required for this spec

---

## 8. Boundaries

| Category  | Rule                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------ |
| Always    | Keep SSE contract identical — never change event names or shapes                                       |
| Always    | Session service must be injectable for tests                                                           |
| Always    | Plan validation (hallucinated node IDs) must run in runner, not tools                                  |
| Ask first | If ADK's streaming API differs significantly from what's documented — check before adapting the runner |
| Ask first | If migrating execute-plan to ADK tools seems beneficial after phase 1                                  |
| Never     | Call Imagen/Veo directly from ADK tools — execution stays in generation.ts                             |
| Never     | Store secrets in ADK session state                                                                     |
| Never     | Break the `/execute-plan` route contract                                                               |

---

## 9. Out of Scope

- Migrating the flow/workflow engine nodes to ADK
- Migrating the `/execute-plan` route
- Frontend changes
- Python ADK / separate service
- Deployment to Agent Runtime (can follow as a separate track)
