# Spec: Unified Primitive Registry Refactoring

## Objective

To standardise all generative and processing capabilities (flow nodes, canvas nodes, and agent tools) under a single **Primitive Registry**. This refactoring resolves the current fragmentation where adding a single capability requires touching up to 15 different files and maintaining duplicate logic (such as resize hooks and data schemas).

### User Stories / Success Outcomes

- **As a Developer**, I can add a new generative capability (e.g., music generation) by creating one directory with its definition, components, and prompts, and registering it in a single line. I do not have to touch the core execution engine, the agent tools, or the layout/config components.
- **As an End User**, my existing saved workflows, active agent chat sessions, and generated library files continue to function perfectly without data corruption or service interruption.

---

## Tech Stack

- **Framework & Language**: Next.js 15 (App Router), React 19, TypeScript
- **State & Flow**: Zustand (state management), `@xyflow/react` (visual workflow builder)
- **Database & Storage**: Google Cloud Firestore, Google Cloud Storage (GCS)
- **AI Integrations**: `@google/genai` (Vertex AI), `@google/adk` (Agent Development Kit)
- **Styling**: Tailwind CSS v4, Radix UI
- **Package Manager & Runner**: Bun

---

## Commands

```bash
# Start development server
bun run dev

# Run TypeScript compilation and type-check (no emit)
bun run check

# Run ESLint validation
bun run lint

# Format codebase with Prettier
bun run format

# Run Vitest unit & integration tests
bun run test

# Complete validation gate (format + check + lint + test)
bun run preflight
```

---

## Project Structure

All primitives live inside `src/lib/primitives/`. Each primitive capability has its own self-contained directory containing its execution logic, client-side React components, and prompt engineering instructions.

```
src/
├── app/
│   └── api/
│       └── primitives/
│           └── [primitiveId]/
│               └── execute/
│                   └── route.ts         # Unified server-side execution endpoint
├── hooks/
│   └── use-media-node-resize.ts         # Unified, store-agnostic resize hook
└── lib/
    └── primitives/
        ├── types.ts                      # Core Primitive type definitions
        ├── registry.ts                   # Server-safe registry mapping primitive ID -> Primitive
        ├── component-registry.ts         # Client-safe registry mapping primitive ID -> Components
        ├── adapters.ts                   # Adapter converting Primitive -> NodeDefinition for flow compatibility
        └── <primitiveId>/                 # e.g., image, video, upscale, resize, llm
            ├── definition.ts             # Server-safe primitive definition (no React)
            ├── FlowNode.tsx              # 'use client' flow-canvas React node component
            ├── CanvasNode.tsx            # 'use client' freeform-canvas React node component
            ├── ConfigPanel.tsx           # 'use client' sidebar configuration panel
            └── SKILL.md                  # System prompt / instructions for the agent
```

---

## Code Style

### 1. Primitive Definition (`definition.ts`)

To ensure Next.js server/client bundle boundary isolation, **no React imports** are allowed in `definition.ts` files.

```typescript
// src/lib/primitives/image/definition.ts
import { z } from "zod";
import type { Primitive } from "../types";

export const imageRequestSchema = z.object({
    prompt: z.string(),
    aspectRatio: z.string().optional(),
    model: z.string().optional(),
});

export const imageOutputSchema = z.object({
    images: z.array(z.string()),
});

export const imagePrimitive: Primitive<
    FlowImageData,
    CanvasImageData,
    z.infer<typeof imageRequestSchema>,
    z.infer<typeof imageOutputSchema>
> = {
    id: "image",
    label: "Image Generation",
    mediaType: "image",
    requestSchema: imageRequestSchema,
    outputShape: imageOutputSchema,

    execute: async (inputs, ctx) => {
        // Single server-side execution endpoint (calls Gemini/Imagen)
        const result = await geminiService.generateImage({
            prompt: inputs.prompt,
            aspectRatio: inputs.aspectRatio,
            model: inputs.model,
            userId: ctx.userId,
        });
        return { images: [result.url] };
    },

    flow: {
        type: "image",
        inputs: { prompt: "text", image: "image" },
        outputs: { image: "image" },
        gatherInputs: (node, edges, getSourceData) => {
            // Flow-side: resolve multimodal / context variables into requestSchema
            return {
                prompt: resolveMentions(node.data.prompt, getSourceData),
                aspectRatio: node.data.aspectRatio,
                model: node.data.model,
            };
        },
        mergeResults: (results) => {
            // Handle workflow engine batch merging
            return {
                mediaUrls: results.flatMap((r) => r.mediaUrls || []),
            };
        },
        saveToLibrary: async (node, result, ctx) => {
            await libraryService.saveImage({
                url: result.images[0],
                userId: ctx.userId,
            });
        },
    },

    canvas: {
        type: "canvas-image",
        toCanvasData: (step, result) => {
            return {
                mediaUrl: result.images[0],
                status: "ready",
            };
        },
        toRequest: (step, ctx) => {
            // Map GenerationStep into canonical requestSchema
            return {
                prompt: step.prompt,
                aspectRatio: step.aspectRatio,
                model: step.model,
            };
        },
    },

    agent: {
        skillPath: "src/lib/primitives/image/SKILL.md",
        operationId: "t2i",
    },
};
```

---

## Testing Strategy

1. **Unit Testing**:
    - Verify registry registration and correctness of retrieval methods (`get`, `getByFlowType`, `getByCanvasType`).
    - Validate execution mapping for individual primitives (mapping schema input/output).
2. **Integration Testing**:
    - Test the unified API route `/api/primitives/[primitiveId]/execute` using mocked request payloads.
    - Verify the adapters: ensure `toNodeDefinition` correctly creates standard `NodeDefinition` representations that the workflow engine executes.
3. **Regression / Preflight Check**:
    - Run existing flow and canvas execution tests (`bun run test`). They must pass without modifications during Phase 1-4.

---

## Boundaries

### Always Do

- Run `bun run check` and `bun run preflight` to verify typings, lint, and formatting.
- Guarantee that all primitive definitions (`definition.ts`) are **completely server-safe** and contain zero imports of client React components.
- Maintain backward compatibility: keep existing database type identifiers (`"image"`, `"canvas-image"`) and agent operation IDs (`"t2i"`, `"i2v"`, etc.).
- Maintain deprecated API facades (like `/api/generate-image`) forwarding to the registry until Phase 4 is complete and fully verified.

### Ask First

- Changing database schemas or GCP service integration abstractions.
- Adding third-party libraries/dependencies.

### Never Do

- Skip `bun run preflight` before finalizing a phase.
- Put React UI code or imports in `src/lib/primitives/registry.ts` or any `definition.ts` file.
- Change the structure of stored Firestore records.

---

## Success Criteria

1. **Standardized Operations**: All 12 nodes (generative + structural) are migrated to register under the primitive system.
2. **No Hardcoded Switches**: Zero hardcoded switches based on node type string inside `workflow-engine.ts`, `prompt-engineer.ts`, `generation.ts`, `tools.ts`, and `config-panel.tsx`.
3. **Zero-Touch Addition**: Adding a new capability (e.g. music generation) requires touching only the `src/lib/primitives/music` directory and registering it in `registry.ts` and `component-registry.ts`.
4. **Preflight Passes**: `bun run preflight` successfully passes.

---

## Open Questions

_None: Clarifications completed and verified._
