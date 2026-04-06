# Technical specification — Media generation & editing agent

**Status:** Draft
**Author:** CTO
**Last updated:** April 2026
**Companion docs:** `media_agent_prd.md`, `media_agent_architecture.md`

---

## 1. Design philosophy

Three principles govern every technical decision in this system.

**Primitives are dumb, the agent is smart.** Primitives do one thing well and know nothing about each other. All compositional intelligence lives in the agent layer. This means a new workflow never requires new primitives — only a new plan.

**Everything is a DAG.** Every user request, no matter how simple, is modeled as a directed acyclic graph of primitive calls. A single-step "remove background" is a one-node DAG. A full movie pipeline is a 30-node DAG. The execution engine doesn't care — same code path, same retry logic, same checkpointing.

**Fail fast, recover cheap.** Every primitive call can fail. The system is designed around this assumption: typed validation at plan time catches structural errors before execution; runtime failures trigger automatic retry with provider fallback; cached intermediate results mean recovery never re-runs successful upstream nodes.

---

## 2. System architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  Web app (React) · API (REST + WebSocket) · SDK (TS/Python)     │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                      GATEWAY / API LAYER                         │
│  Auth · Rate limiting · Request validation · WebSocket manager   │
│  Stack: Hono on Cloudflare Workers (or Node/Fastify)             │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                       AGENT LAYER                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              Orchestrator agent                       │       │
│  │  LLM backbone (Gemini) with google-adk                │       │
│  │  Intent parsing · Plan generation · Dispatch          │       │
│  └───────┬──────────┬──────────┬──────────┬─────────────┘       │
│          │          │          │          │                       │
│  ┌───────▼──┐ ┌─────▼────┐ ┌──▼───────┐ ┌▼──────────┐          │
│  │  Image   │ │  Video   │ │  Audio   │ │  Review   │  ...      │
│  │ subagent │ │ subagent │ │ subagent │ │ subagent  │           │
│  └───────┬──┘ └─────┬────┘ └──┬───────┘ └┬──────────┘          │
│          │          │          │          │                       │
│          └──────────┴──────────┴──────────┘                      │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                   ORCHESTRATION LAYER                             │
│  DAG executor · Job queue · Checkpoints · Retry / fallback       │
│  Stack: Google Cloud Workflows + Cloud Tasks                     │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                   PRIMITIVE ADAPTER LAYER                         │
│  Unified interface per primitive type                            │
│  Provider routing · Cost estimation · Caching · Validation       │
│  Stack: TypeScript adapters, one per primitive                   │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                  MODEL PROVIDER LAYER (Vertex AI)                │
│  Gemini 3.1 Image · Veo · Lyria · Gemini 3 TTS · Multimodal      │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                     STORAGE LAYER                                │
│  Cloud Storage (assets) · Firestore (metadata)                  │
│  Cloud Memorystore (cache) · BigQuery (analytics)               │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Agent design

This is the core of the system. The agent layer is not a monolithic LLM call — it is a hierarchy of specialized agents coordinated by an orchestrator.

### 3.1 Taxonomy: commands, skills, subagents

These three concepts form a strict hierarchy. Understanding the boundary between them is critical.

#### Commands

**What they are.** User-facing entry points. A command is a named action the user can invoke explicitly or that the orchestrator infers from natural language. Commands are the "API surface" of the agent.

**Characteristics:**

- Stateless — a command is a request, not a running process.
- Maps to exactly one workflow (which may be a single primitive or a multi-step DAG).
- Has a typed input schema (what the user must provide) and output schema (what they get back).
- Can be invoked via chat ("remove the background from this image"), via API (`POST /commands/background-remove`), or via template ("run the weekly social bundle").

**Examples:**

| Command                   | Input                                   | Maps to                                               |
| ------------------------- | --------------------------------------- | ----------------------------------------------------- |
| `generate-image`          | prompt, style, resolution               | Single primitive call                                 |
| `remove-background`       | image                                   | Single primitive call                                 |
| `create-product-ad`       | product image, headline, CTA, brand kit | Multi-step workflow (image subagent + video subagent) |
| `produce-explainer-video` | script, style, duration                 | Complex DAG across multiple subagents                 |
| `validate-content`        | media file, policy set                  | Review subagent workflow                              |

**Design rule:** If a user can describe it in one sentence, it's a command. Commands are discovered by the orchestrator agent through a command registry — a structured catalog the LLM sees as available tools.

#### Skills

**What they are.** Atomic capabilities that subagents use internally. A skill wraps exactly one primitive adapter and provides the subagent with a tool-use interface to invoke it.

**Characteristics:**

- Internal — users never invoke skills directly.
- Stateless and side-effect-free (except for the media artifact they produce).
- Typed input/output matching the underlying primitive adapter.
- A subagent's "toolbox" is its set of available skills.
- Skills are registered per-subagent at configuration time.

**Examples:**

| Skill              | Belongs to      | Wraps                                    |
| ------------------ | --------------- | ---------------------------------------- |
| `text-to-image`    | Image subagent  | text→image primitive adapter             |
| `segment`          | Image subagent  | segmentation primitive adapter           |
| `inpaint`          | Image subagent  | inpaint/outpaint primitive adapter       |
| `remove-bg`        | Image subagent  | background removal primitive adapter     |
| `upscale`          | Image subagent  | super-resolution primitive adapter       |
| `generate-video`   | Video subagent  | text→video primitive adapter             |
| `trim-video`       | Video subagent  | video trim/cut primitive adapter         |
| `overlay-text`     | Video subagent  | text/graphic overlay primitive adapter   |
| `generate-music`   | Audio subagent  | text→music primitive adapter             |
| `text-to-speech`   | Audio subagent  | TTS primitive adapter                    |
| `mix-audio`        | Audio subagent  | audio mix primitive adapter              |
| `classify-content` | Review subagent | content classification primitive adapter |
| `score-aesthetic`  | Review subagent | aesthetic scoring primitive adapter      |

**Design rule:** One skill = one primitive = one model call (or one deterministic processing step). If a skill needs to call two models sequentially, it should be split into two skills. The subagent handles sequencing.

#### Subagents

**What they are.** Domain-specialized agent instances, each with their own LLM context, skill set, and domain expertise. A subagent receives a scoped task from the orchestrator and autonomously plans and executes within its domain using its skills.

**Characteristics:**

- Stateful within a task — maintains context about what it has done and what remains.
- Has a focused system prompt encoding domain expertise (image editing best practices, video composition rules, audio mixing conventions).
- Has access only to its own skills — cannot call skills from other subagents.
- Can request assets from the orchestrator (e.g., "I need the brand kit" or "I need the output from the image subagent").
- Returns structured output to the orchestrator: the produced artifact(s) + metadata + quality assessment.

**The subagent roster:**

| Subagent   | Domain                                      | Skills                                                                                                                                                                               | System prompt focus                                                                                               |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Image**  | Image generation, editing, understanding    | text-to-image, image-to-image, inpaint, outpaint, remove-bg, upscale, style-transfer, color-correct, segment, detect-objects, estimate-depth, caption, OCR                           | Prompt engineering for image models, composition rules, resolution/aspect ratio handling, ControlNet conditioning |
| **Video**  | Video generation, editing, compositing      | generate-video, animate-image, trim-video, merge-video, add-transitions, overlay-text, overlay-graphic, render-subtitles, stabilize, interpolate-frames, detect-scenes, track-motion | Video timeline logic, transition selection, pacing, frame rate handling, codec selection                          |
| **Audio**  | Music, speech, SFX, mixing                  | generate-music, generate-sfx, text-to-speech, transcribe, mix-audio, denoise, separate-sources, eq                                                                                   | Audio levels, mixing best practices, music genre conventions, voice cloning ethics, loudness normalization        |
| **3D**     | 3D asset generation, rendering              | text-to-3d, image-to-3d, render-turntable                                                                                                                                            | Mesh quality, texture resolution, format compatibility (GLB/USDZ), lighting setup                                 |
| **Review** | Quality assurance, brand compliance, policy | classify-content, score-aesthetic, detect-faces, check-brand, evaluate-policy                                                                                                        | Gemini 3.1 Pro multimodal reasoning, safety filtering, brand guideline interpretation                             |

**Design rule:** A subagent should be able to handle any task within its domain without calling back to the orchestrator for planning help. The orchestrator defines _what_ needs to happen; the subagent decides _how_. If a subagent consistently needs orchestrator guidance for routine tasks, its system prompt needs more domain knowledge.

### 3.2 The orchestrator agent

The orchestrator is the brain. It receives user intent and produces an execution plan.

#### System prompt structure

```
You are the orchestrator of a media generation and editing system.

You have access to the following commands: [command registry]
You can dispatch tasks to the following subagents: [subagent roster]
The LLM backbone is Gemini 3.1 Pro / Flash via google-genai and google-adk.
The user's workspace has the following brand kit: [brand kit summary]
The user's current asset library contains: [recent asset index]

Your job:
1. Parse the user's intent.
2. Decompose it into a plan: an ordered list of subagent tasks with dependencies.
3. Present the plan to the user for approval.
4. Dispatch tasks to subagents and collect results.
5. If a subagent fails or produces low-quality output, decide whether to retry,
   fall back to an alternative approach, or ask the user for guidance.
6. Assemble final output and present to user.

Rules:
- Never call skills directly. Always dispatch to the appropriate subagent.
- Always estimate cost and duration before execution.
- Insert checkpoints before expensive or irreversible steps.
- When multiple approaches exist, prefer the one with fewer steps and lower cost
  unless the user has specified quality requirements that demand more.
```

#### Tool-use schema for the orchestrator

The orchestrator's tools are not primitives — they are higher-level dispatch operations:

```typescript
// The orchestrator's tool definitions (registered with the LLM)

interface DispatchToSubagent {
    tool: "dispatch";
    subagent: "image" | "video" | "audio" | "3d" | "review";
    task: string; // natural language task description
    inputs: Asset[]; // references to input assets (from storage or upstream nodes)
    constraints: {
        max_cost_usd?: number;
        max_duration_sec?: number;
        quality?: "draft" | "standard" | "premium";
        brand_kit?: boolean;
    };
    checkpoint?: boolean; // pause for user approval after this step
}

interface PresentPlan {
    tool: "present_plan";
    steps: PlanStep[];
    estimated_cost: number;
    estimated_duration: string;
}

interface RequestUserInput {
    tool: "request_input";
    question: string;
    options?: string[]; // optional multiple-choice
}

interface LookupAsset {
    tool: "lookup_asset";
    query: string; // semantic search in asset library
}

interface LoadBrandKit {
    tool: "load_brand_kit";
    workspace_id: string;
}
```

#### Plan generation example

User: "Take this product photo, make a studio shot, add my logo, and give me versions for Instagram feed and story."

Orchestrator produces:

```json
{
    "plan": [
        {
            "id": "step_1",
            "subagent": "image",
            "task": "Remove background from uploaded product photo and generate a studio backdrop with soft lighting",
            "inputs": ["upload://product_photo.jpg"],
            "depends_on": [],
            "checkpoint": true,
            "estimated_cost": 0.08
        },
        {
            "id": "step_2",
            "subagent": "image",
            "task": "Overlay brand logo in bottom-right corner at 10% of image width, following brand kit placement guidelines",
            "inputs": ["step_1.output", "brand_kit://logo.svg"],
            "depends_on": ["step_1"],
            "checkpoint": false,
            "estimated_cost": 0.02
        },
        {
            "id": "step_3a",
            "subagent": "image",
            "task": "Export at 1080x1080 for Instagram feed with 5% safe margin",
            "inputs": ["step_2.output"],
            "depends_on": ["step_2"],
            "checkpoint": false,
            "estimated_cost": 0.01
        },
        {
            "id": "step_3b",
            "subagent": "image",
            "task": "Export at 1080x1920 for Instagram story, recompose vertically with product centered upper third",
            "inputs": ["step_2.output"],
            "depends_on": ["step_2"],
            "checkpoint": false,
            "estimated_cost": 0.02
        }
    ],
    "total_estimated_cost": 0.13,
    "total_estimated_duration": "45 seconds",
    "parallel_branches": [["step_3a", "step_3b"]]
}
```

Steps 3a and 3b are independent and execute in parallel.

### 3.3 Subagent internal design

Each subagent is itself an LLM agent with tool-use. When the orchestrator dispatches a task, the subagent:

1. Receives the task description + input assets + constraints.
2. Plans its own sequence of skill calls (internally, not shown to user).
3. Executes skills sequentially (or occasionally in parallel within its domain).
4. Validates output quality.
5. Returns result to orchestrator.

#### Example: Image subagent handling "Remove background and generate studio backdrop"

```
Image subagent receives:
  task: "Remove background from product photo and generate studio backdrop"
  inputs: [product_photo.jpg]
  constraints: { quality: "premium", brand_kit: true }

Internal plan:
  1. Call skill: remove-bg(product_photo.jpg) → product_masked.png
  2. Call skill: text-to-image(
       prompt: "professional product photography studio backdrop, soft gradient,
                warm lighting, brand colors: {brand_kit.primary_color}",
       resolution: "1024x1024"
     ) → backdrop.png
  3. Call skill: composite(product_masked.png, backdrop.png, position: "center") → studio_shot.png
  4. Call skill: color-correct(studio_shot.png, adjustments: "match lighting") → final.png
  5. Call skill: score-aesthetic(final.png) → quality_score
  6. If quality_score < 0.7, retry step 2 with modified prompt

Returns: final.png + metadata
```

The orchestrator never sees these internal skill calls. It just gets the result.

### 3.4 Communication protocol between orchestrator and subagents

```typescript
// Orchestrator → Subagent
interface SubagentRequest {
    request_id: string;
    task: string;
    inputs: AssetReference[];
    constraints: TaskConstraints;
    context: {
        brand_kit?: BrandKit;
        workflow_id: string;
        upstream_metadata?: Record<string, any>; // info from prior steps
    };
}

// Subagent → Orchestrator
interface SubagentResponse {
    request_id: string;
    status: "success" | "partial" | "failed";
    outputs: AssetReference[];
    metadata: {
        quality_score?: number;
        cost_usd: number;
        duration_ms: number;
        model_used: string;
        retry_count: number;
    };
    error?: {
        code: string;
        message: string;
        recoverable: boolean;
        suggestion?: string; // "try with a different prompt" / "input image too low-res"
    };
}
```

### 3.5 When to use what: decision framework

```
User says something
        │
        ▼
Is it a single, well-known action?
(remove bg, upscale, generate image)
        │
   YES  │  NO
   ▼    │  ▼
Command │  Does it span multiple domains?
maps to │  (image + video + audio)
single  │       │
skill   │  YES  │  NO
via one │  ▼    │  ▼
sub-    │  Orchestrator    Orchestrator
agent   │  plans multi-    dispatches to
        │  subagent DAG    single subagent
        │       │          with complex task
        │       │               │
        ▼       ▼               ▼
   Subagent  Subagents      Subagent
   executes  execute in     plans multi-
   1 skill   parallel/      skill sequence
             sequence       internally
```

**Key boundary:** The orchestrator handles _cross-domain_ coordination. A subagent handles _within-domain_ complexity. If a task involves only image operations (even complex ones like "remove background, replace with studio shot, color match, overlay logo, upscale"), it goes to the image subagent as a single dispatch. The image subagent chains its skills internally.

---

## 4. Primitive adapter layer

### 4.1 Adapter interface

Every primitive adapter implements this interface:

```typescript
interface PrimitiveAdapter<TInput, TOutput> {
    // Identity
    readonly name: string;
    readonly domain: "image" | "video" | "audio" | "3d" | "text";
    readonly inputSchema: z.ZodSchema<TInput>;
    readonly outputSchema: z.ZodSchema<TOutput>;

    // Provider management
    readonly providers: ProviderConfig[];
    selectProvider(input: TInput, constraints: TaskConstraints): ProviderConfig;

    // Cost & time estimation (called at plan time)
    estimate(input: TInput, provider?: ProviderConfig): CostEstimate;

    // Execution
    execute(
        input: TInput,
        provider?: ProviderConfig,
    ): AsyncGenerator<Progress, TOutput>;

    // Post-execution validation
    validate(output: TOutput): ValidationResult;

    // Caching
    cacheKey(input: TInput): string;
}

interface ProviderConfig {
    id: string; // "vertex-imagen-3", "vertex-veo-v1"
    provider: string; // "google", "self-hosted"
    model: string;
    tier: "draft" | "standard" | "premium";
    cost_per_call: number; // estimated USD
    avg_latency_ms: number;
    max_resolution?: string;
    supports_controlnet?: boolean;
    supports_lora?: boolean;
    rate_limit?: number; // calls per minute
}

interface CostEstimate {
    cost_usd: number;
    duration_ms: number;
    quality_tier: string;
    provider: string;
}

interface Progress {
    percent: number;
    stage: string; // "queued", "processing", "finalizing"
    preview_url?: string; // intermediate preview if available
}
```

### 4.2 Provider routing

The adapter layer handles model selection transparently:

```typescript
function selectProvider(
    input: TInput,
    constraints: TaskConstraints,
): ProviderConfig {
    const eligible = this.providers
        .filter((p) => meetsQualityTier(p, constraints.quality))
        .filter((p) => meetsResolution(p, input.resolution))
        .filter((p) => underBudget(p, constraints.max_cost_usd))
        .filter((p) => underRateLimit(p));

    // Sort by: quality (desc) → cost (asc) → latency (asc)
    return eligible.sort(multiCriteriaSort)[0];
}
```

If the selected provider fails, the adapter automatically retries with the next provider in the sorted list. This is invisible to the subagent — it just sees a retry.

### 4.3 Concrete adapter examples

#### Text-to-image adapter

```typescript
const textToImageAdapter: PrimitiveAdapter<TextToImageInput, ImageOutput> = {
    name: "text-to-image",
    domain: "image",
    inputSchema: z.object({
        prompt: z.string().max(2000),
        negative_prompt: z.string().optional(),
        width: z.number().int().min(256).max(4096).default(1024),
        height: z.number().int().min(256).max(4096).default(1024),
        seed: z.number().int().optional(),
        style_preset: z
            .enum(["photo", "illustration", "3d", "anime"])
            .optional(),
        controlnet: z
            .object({
                type: z.enum(["canny", "depth", "pose", "reference"]),
                image: z.string(), // asset reference
                strength: z.number().min(0).max(1).default(0.7),
            })
            .optional(),
        lora: z
            .object({
                id: z.string(),
                weight: z.number().min(0).max(1).default(0.8),
            })
            .optional(),
        num_variants: z.number().int().min(1).max(8).default(1),
    }),
    outputSchema: z.object({
        images: z.array(
            z.object({
                url: z.string(),
                width: z.number(),
                height: z.number(),
                seed: z.number(),
            }),
        ),
        model_used: z.string(),
        cost_usd: z.number(),
    }),
    providers: [
        {
            id: "gemini-3.1-pro-image",
            provider: "google",
            model: "gemini-3.1-pro-image",
            tier: "premium",
            cost_per_call: 0.04,
            avg_latency_ms: 8000,
        },
        {
            id: "gemini-3.1-flash-image",
            provider: "google",
            model: "gemini-3.1-flash-image",
            tier: "standard",
            cost_per_call: 0.02,
            avg_latency_ms: 4000,
        },
        {
            id: "gemini-3.1-pro",
            provider: "google",
            model: "gemini-3.1-pro",
            tier: "premium",
            cost_per_call: 0.03,
            avg_latency_ms: 6000,
        },
    ],
    // ...
};
```

#### Video trim/cut adapter (local processing, no model call)

```typescript
const videoTrimAdapter: PrimitiveAdapter<VideoTrimInput, VideoOutput> = {
    name: "video-trim",
    domain: "video",
    providers: [
        {
            id: "local-ffmpeg",
            provider: "self-hosted",
            model: "ffmpeg",
            tier: "standard",
            cost_per_call: 0,
            avg_latency_ms: 2000,
        },
    ],
    // This adapter uses FFmpeg locally — no external API call.
    // Cost is zero. Latency depends on video length.
};
```

### 4.4 Caching strategy

```typescript
// Cache key is a hash of: primitive name + provider + all input parameters
// Excludes: seed (if random), timestamp
function cacheKey(input: TInput): string {
    const normalized = sortKeys(omit(input, ["seed"]));
    return `${this.name}:${hash(JSON.stringify(normalized))}`;
}
```

Cache is stored in Cloud Memorystore with a 7-day TTL. Asset files are stored in GCS and referenced by URL. Cache hits bypass the provider entirely and return the stored asset reference.

---

## 5. Orchestration engine

### 5.1 Why Google Cloud Workflows

The orchestration layer uses **Google Cloud Workflows** for serverless, durable workflow execution.

**Why Cloud Workflows?**

- Fully managed, serverless, and scales to zero.
- Native integration with other Google Cloud services (Cloud Run, Cloud Tasks, Vertex AI).
- Handles long-running wait states (up to 1 year) via callbacks, perfect for human-in-the-loop checkpoints.
- Durable state management and automatic retries.

**Why not a DAG orchestrator (Airflow, Dagster)?**

- Those are designed for scheduled batch pipelines, not interactive user-triggered workflows.
- They don't support human-in-the-loop checkpoints natively.
- They're heavyweight for the latency requirements we have (sub-second dispatch).

### 5.2 Workflow definition

```typescript
// Google Cloud Workflows (YAML/JSON definition)
// Shown here in pseudo-code for logic equivalence
async function mediaWorkflow(input: WorkflowInput) {
    // ... logic similar to previous definitions but using Cloud Workflows YAML logic
}
```

### 5.3 Parallel execution

Independent branches in the DAG execute concurrently:

```typescript
// Detect parallel branches
const parallelGroups = findParallelBranches(plan.steps);

// Execute groups concurrently
for (const group of parallelGroups) {
    if (group.length === 1) {
        results[group[0].id] = await executeStep(group[0]);
    } else {
        const parallel = group.map((step) => executeStep(step));
        const groupResults = await Promise.all(parallel);
        group.forEach((step, i) => {
            results[step.id] = groupResults[i];
        });
    }
}
```

### 5.4 Checkpoint and human-in-the-loop

```typescript
// Client sends approval via WebSocket → API → Cloud Workflows callback
websocket.on("checkpoint_response", async (data) => {
    await workflowsClient.sendWorkflowCallback({
        name: data.callback_url,
        payload: {
            action: data.action,
            feedback: data.feedback,
        },
    });
});
```

Checkpoints can wait up to 24 hours. After timeout, the workflow is paused and the user is notified.

---

## 6. Storage layer

### 6.1 Asset storage

```
Cloud Storage bucket: lumen-assets
├── uploads/                    # user uploads (raw input)
│   └── {workspace_id}/{upload_id}/{filename}
├── intermediates/              # intermediate outputs (cached, 7-day TTL)
│   └── {workflow_id}/{step_id}/{filename}
├── outputs/                    # final deliverables (permanent)
│   └── {workspace_id}/{workflow_id}/{filename}
└── brand-kits/                 # brand assets
    └── {workspace_id}/logo.svg, palette.json, fonts/...
```

### 6.2 Database schema (PostgreSQL)

```sql
-- Core entities (Firestore Collections)
-- workspaces { id: UUID, name: TEXT, brand_kit: MAP, settings: MAP, created_at: TIMESTAMP }
-- workflows { id: UUID, workspace_id: UUID, user_id: UUID, command: TEXT, user_input: TEXT, plan: MAP, status: TEXT, cost_usd: NUMBER, created_at: TIMESTAMP, completed_at: TIMESTAMP }
-- workflow_steps { id: UUID, workflow_id: UUID, step_index: NUMBER, subagent: TEXT, task: TEXT, inputs: MAP, outputs: MAP, status: TEXT, cost_usd: NUMBER, duration_ms: NUMBER, provider: TEXT, retry_count: NUMBER, error: MAP, started_at: TIMESTAMP, completed_at: TIMESTAMP }
-- assets { id: UUID, workspace_id: UUID, workflow_id: UUID, step_id: UUID, type: TEXT, mime_type: TEXT, gcs_path: TEXT, metadata: MAP, tags: ARRAY, created_at: TIMESTAMP }
-- templates { id: UUID, workspace_id: UUID, name: TEXT, description: TEXT, plan: MAP, variables: MAP, created_at: TIMESTAMP }
```

### 6.3 Cache layer (Redis)

```
# Primitive result cache (7-day TTL)
cache:{primitive_name}:{input_hash} → { asset_url, metadata, expires_at }

# Active workflow progress (streamed to WebSocket clients)
progress:{workflow_id} → { current_step, completed_steps, percent, preview_urls }

# Rate limit counters per provider
ratelimit:{provider_id} → counter (TTL = window size)

# Brand kit cache (avoid DB reads on every step)
brandkit:{workspace_id} → { logo_url, colors, fonts, guidelines_text }
```

---

## 7. Technology stack

### 7.1 Core services

| Layer              | Technology                    | Rationale                                                        |
| ------------------ | ----------------------------- | ---------------------------------------------------------------- |
| **API gateway**    | Cloud Run (Node.js/Hono)      | Fully managed, auto-scaling, integrated with GCP Auth.           |
| **Agent backbone** | Google Gemini (3.1 Pro/Flash) | State-of-the-art multi-modal reasoning.                          |
| **Framework**      | google-adk                    | Specialized framework for Gemini agents.                         |
| **Orchestration**  | Google Cloud Workflows        | Serverless orchestration for human-in-the-loop steps.            |
| **Job queue**      | Google Cloud Tasks            | Managed task distribution.                                       |
| **Database**       | Firestore                     | NoSQL document store for high-scale metadata and real-time sync. |
| **Cache**          | Cloud Memorystore (Redis)     | State and result caching.                                        |
| **Asset storage**  | Cloud Storage (GCS)           | Blob storage for media.                                          |
| **CDN**            | Google Cloud CDN              | Edge delivery.                                                   |
| **Analytics**      | BigQuery                      | Log and cost analysis at scale.                                  |
| **Real-time**      | Firestore / WebSockets        | Native real-time listeners for workflow state.                   |

### 7.2 Media processing libraries

| Library                                 | Purpose                                                                                                           | Where it runs                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **FFmpeg** (via fluent-ffmpeg)          | Video trim/cut/merge, format conversion, audio extraction, muxing, subtitle burn-in                               | Self-hosted workers                        |
| **Sharp**                               | Image resize, crop, composite, format conversion, metadata extraction                                             | Self-hosted workers                        |
| **sox / audiowaveform**                 | Audio waveform visualization, basic audio processing                                                              | Self-hosted workers                        |
| **Remotion**                            | Programmatic video composition with React components (for animated overlays, motion graphics, webapp demo videos) | Self-hosted render farm or Remotion Lambda |
| **Konva** (server-side via node-canvas) | Complex image compositing (text overlays with precise typography, logo placement, multi-layer composition)        | Self-hosted workers                        |
| **Puppeteer**                           | Screenshot capture for webapp video overviews, scrolling simulation                                               | Self-hosted workers                        |

### 7.3 Model provider SDKs

| Provider         | SDK / Integration                                  | Primitives served                                                                                                       |
| ---------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Google GenAI** | `google-genai` / `google-adk`                      | Gemini 3.1 (Orchestration, Review, Understanding)                                                                       |
| **Vertex AI**    | `@google-cloud/vertexai`                           | Gemini 3.1 Image (Image), Veo (Video), Lyria (Audio), Gemini 3 TTS (Speech)                                             |
| **Google Cloud** | `@google-cloud/storage`, `@google-cloud/workflows` | Infrastructure services                                                                                                 |
| **Self-hosted**  | Direct inference via Docker                        | Background removal (RMBG-2.0), upscaling (Real-ESRGAN), segmentation (SAM-2), OCR (Surya), face detection (InsightFace) |

### 7.4 Language and monorepo structure

```
lumen/
├── apps/
│   ├── api/                    # Hono API server
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── websocket/
│   ├── web/                    # React frontend (Next.js or Vite)
│   ├── workers/                # Cloud Run job workers
│   └── cli/                    # CLI tool for power users
├── packages/
│   ├── agent/                  # Orchestrator + subagent definitions
│   │   ├── orchestrator.ts
│   │   ├── subagents/
│   │   │   ├── image.ts
│   │   │   ├── video.ts
│   │   │   ├── audio.ts
│   │   │   ├── three-d.ts
│   │   │   └── review.ts
│   │   └── commands/           # Command registry
│   ├── adapters/               # Primitive adapters
│   │   ├── text-to-image.ts
│   │   ├── text-to-video.ts
│   │   ├── remove-bg.ts
│   │   ├── ...
│   │   └── adapter-interface.ts
│   ├── orchestration/          # Cloud Workflows definitions and callbacks
│   │   ├── workflows/
│   │   └── activities/
│   ├── storage/                # GCS + Cloud SQL + Memorystore clients
│   ├── brand-kit/              # Brand kit management
│   ├── types/                  # Shared TypeScript types
│   └── utils/                  # Hashing, cost estimation, format detection
├── infrastructure/
│   ├── docker/                 # Dockerfiles for workers, self-hosted models
│   ├── terraform/              # Cloud infrastructure
│   └── workflows/              # Workflow YAML and state config
├── sdk/
│   ├── typescript/             # Published TS/JS SDK
│   └── python/                 # Published Python SDK
└── docs/
```

**Language:** TypeScript everywhere. Python only for self-hosted ML model inference servers (which run in isolated Docker containers and expose HTTP APIs). The agent, orchestration, adapters, API — all TypeScript. This eliminates serialization boundaries and keeps the type system continuous from API input to primitive execution.

**Package manager:** pnpm workspaces.

**Build:** Turborepo for monorepo task orchestration.

---

## 8. API design

### 8.1 REST endpoints

```
POST   /v1/workflows              Create and execute a workflow from natural language
GET    /v1/workflows/:id          Get workflow status, plan, and outputs
POST   /v1/workflows/:id/signal   Send checkpoint approval/rejection
DELETE /v1/workflows/:id          Cancel a running workflow

POST   /v1/commands/:name         Execute a named command directly
GET    /v1/commands               List available commands with schemas

GET    /v1/assets                 List assets (filterable by workspace, type, tags)
GET    /v1/assets/:id             Get asset metadata and download URL
DELETE /v1/assets/:id             Delete an asset

GET    /v1/brand-kit              Get current workspace brand kit
PUT    /v1/brand-kit              Update brand kit

POST   /v1/templates              Create a workflow template
GET    /v1/templates              List templates
POST   /v1/templates/:id/run      Execute a template with variables

WebSocket /v1/ws                  Real-time: workflow progress, checkpoint prompts, live previews
```

### 8.2 Webhook events

For async integrations, clients register webhook URLs:

```
workflow.started
workflow.step.completed
workflow.checkpoint.waiting
workflow.completed
workflow.failed
asset.created
```

### 8.3 SDK usage example

```typescript
import { Lumen } from "@lumen/sdk";

const lumen = new Lumen({ apiKey: "..." });

// Simple: one-step command
const image = await lumen.commands.execute("generate-image", {
    prompt: "product photography, wireless headphones, white background",
    resolution: "1024x1024",
    variants: 4,
});

// Complex: natural language workflow
const workflow = await lumen.workflows.create({
    input: "Create a 15-second Instagram Reel ad for these headphones with upbeat music and our logo",
    assets: [await lumen.assets.upload("./headphones.jpg")],
    brand_kit: true,
    quality: "premium",
    checkpoints: ["after_studio_shot"],
});

// Stream progress
for await (const event of workflow.stream()) {
    if (event.type === "checkpoint") {
        console.log("Preview:", event.preview_url);
        await workflow.approve(event.step_id); // or .reject(feedback)
    }
    if (event.type === "progress") {
        console.log(`${event.percent}% — ${event.stage}`);
    }
}

const outputs = await workflow.result();
// outputs.files → [{ url, format, dimensions, duration }]
```

---

## 9. Self-hosted model infrastructure

### 9.1 What runs locally vs. externally

**Self-host** primitives that are: (a) called extremely frequently, (b) cheap to run on GPU, and (c) have strong open-source models. This eliminates per-call API costs and latency for high-volume operations.

| Self-hosted         | Model                | GPU requirement | Rationale                                                  |
| ------------------- | -------------------- | --------------- | ---------------------------------------------------------- |
| Background removal  | RMBG-2.0             | 1× A10          | Called on nearly every product workflow. API costs add up. |
| Upscaling           | Real-ESRGAN 4x       | 1× A10          | Same. Sub-second latency needed.                           |
| Segmentation        | SAM-2                | 1× A10          | Foundation for inpainting, try-on, compositing.            |
| Depth estimation    | Depth Anything V2    | 1× A10          | Required for 3D and novel-view workflows.                  |
| OCR                 | Surya                | CPU             | Fast, accurate, no GPU needed.                             |
| Face detection      | InsightFace          | 1× T4           | Needed for face swap, validation, moderation.              |
| Captioning          | Florence-2 or CogVLM | 1× A10          | High-volume understanding primitive.                       |
| Audio transcription | Whisper large-v3     | 1× A10          | Frequent, cost-sensitive.                                  |

**Keep external** anything that is expensive to run, rapidly improving (so we always want the latest model), or infrequently called: text→image, text→video, music generation, TTS.

### 9.2 Deployment

Self-hosted models run as Docker containers behind an internal load balancer, exposing a REST API that matches the primitive adapter interface. Deployed on a GPU cluster (RunPod, Lambda Labs, or dedicated cloud instances).

```
Internal network:
  model-rmbg.internal:8000      /predict  POST { image_base64 } → { mask_base64 }
  model-esrgan.internal:8000    /predict  POST { image_base64, scale } → { image_base64 }
  model-sam2.internal:8000      /predict  POST { image_base64, prompt } → { masks[] }
  model-whisper.internal:8000   /predict  POST { audio_base64 } → { transcript, segments[] }
```

Autoscaling via Kubernetes HPA on GPU utilization, with scale-to-zero on idle (RunPod serverless or Karpenter on EKS).

---

## 10. Observability and cost tracking

### 10.1 Per-primitive telemetry

Every primitive call emits a structured event to ClickHouse:

```typescript
interface PrimitiveEvent {
    timestamp: Date;
    workspace_id: string;
    workflow_id: string;
    step_id: string;
    primitive: string;
    provider: string;
    model: string;
    input_hash: string;
    cost_usd: number;
    duration_ms: number;
    quality_score?: number;
    cache_hit: boolean;
    retry_count: number;
    error?: string;
    input_metadata: {
        resolution?: string;
        duration_sec?: number;
        file_size_bytes?: number;
    };
    output_metadata: {
        resolution?: string;
        duration_sec?: number;
        file_size_bytes?: number;
    };
}
```

### 10.2 Dashboards

| Dashboard       | Metrics                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- |
| **Cost**        | Daily/weekly spend by primitive, by provider, by workspace. Cost per workflow. Trending. |
| **Quality**     | Aesthetic scores over time. Retry rates by primitive. Provider quality comparison.       |
| **Latency**     | P50/P95/P99 by primitive. End-to-end workflow duration. Bottleneck identification.       |
| **Usage**       | Workflows/day, primitives/workflow distribution, command popularity, template adoption.  |
| **Reliability** | Error rates by provider. Fallback frequency. Cache hit ratio.                            |

### 10.3 Alerts

- Provider error rate > 10% over 5 minutes → page on-call, activate fallback provider.
- Workflow completion rate < 60% over 1 hour → investigate planning failures.
- Daily spend exceeds 120% of trailing 7-day average → cost alert to workspace owner.
- Self-hosted model latency P95 > 5s → scale up GPU pool.

---

## 11. Security and compliance

### 11.1 Data handling

- All assets are encrypted at rest (GCS Managed Keys) and in transit (TLS 1.3).
- Workspace isolation: assets, workflows, and brand kits are scoped per-workspace. Cross-workspace access is impossible at the storage layer.
- User uploads are scanned for malware before processing.
- Generated content is tagged with provenance metadata (model used, timestamp, workspace).

### 11.2 Content safety

- All generated images and videos pass through the content classification primitive before delivery.
- Face swap and lip sync require explicit consent flags in the API call.
- C2PA metadata is embedded in all generated media (provenance standard for synthetic content).
- Rate limiting on face-related primitives (max 100 calls/day per workspace).
- NSFW content generation is disabled by default; opt-in requires workspace admin approval.

### 11.3 Model provider data policies

- No training on user data: all provider contracts include data retention clauses prohibiting use of inputs/outputs for model training.
- Self-hosted models have zero data egress by design.
- Provider selection can be constrained per-workspace (e.g., "EU providers only" or "no OpenAI") for compliance requirements.

---

## 12. Development phases (mapped to PRD)

### Phase 1 — Foundation (months 1–3)

**Engineering focus:** Primitive adapters + single subagent + basic orchestrator.

| Deliverable                                                                                                                                             | Effort  | Owner         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------- |
| Adapter interface + 10 P0 adapters (text→image, text→video, image→video, TTS, remove-bg, inpaint, upscale, video trim, text overlay, format conversion) | 6 weeks | Platform team |
| Image subagent (fully functional with all image skills)                                                                                                 | 3 weeks | Agent team    |
| Basic orchestrator (template-matching only, no novel composition)                                                                                       | 3 weeks | Agent team    |
| 5 hardcoded workflow templates                                                                                                                          | 2 weeks | Agent team    |
| Cloud Workflows integration (basic execution, no checkpoints yet)                                                                                       | 3 weeks | Platform team |
| API + WebSocket server                                                                                                                                  | 3 weeks | API team      |
| Asset storage (GCS + Firestore)                                                                                                                         | 2 weeks | Platform team |
| Web app MVP (chat + inline previews + download)                                                                                                         | 4 weeks | Frontend team |
| Brand kit (basic: logo + colors)                                                                                                                        | 1 week  | Platform team |
| Self-hosted models: RMBG-2.0, Real-ESRGAN, Whisper                                                                                                      | 2 weeks | Infra team    |

### Phase 2 — Composition (months 4–6)

| Deliverable                                                                     | Effort  | Owner         |
| ------------------------------------------------------------------------------- | ------- | ------------- |
| Video, Audio, Review subagents                                                  | 4 weeks | Agent team    |
| Novel composition in orchestrator (LLM-powered planning over primitive catalog) | 4 weeks | Agent team    |
| Checkpoint / human-in-the-loop                                                  | 2 weeks | Platform team |
| Template system (create, save, parameterize, re-run)                            | 3 weeks | Platform team |
| Asset library with tagging and semantic search                                  | 3 weeks | Platform team |
| Reviewer layer (quality + brand + policy validation)                            | 3 weeks | Agent team    |
| Render queue with async notifications                                           | 2 weeks | Platform team |
| 10 additional adapters (P1 primitives)                                          | 4 weeks | Platform team |
| ClickHouse analytics + cost dashboards                                          | 2 weeks | Infra team    |
| Self-hosted models: SAM-2, Depth Anything, InsightFace, Florence-2              | 2 weeks | Infra team    |

### Phase 3 — Scale (months 7–12)

| Deliverable                                                               | Effort  | Owner            |
| ------------------------------------------------------------------------- | ------- | ---------------- |
| 3D subagent + adapters                                                    | 4 weeks | Agent + Platform |
| P2 primitives (lip sync, face swap, motion tracking, frame interpolation) | 6 weeks | Platform team    |
| End-to-end video production pipeline                                      | 4 weeks | Agent team       |
| Localization pipeline                                                     | 3 weeks | Agent team       |
| Public SDK (TypeScript + Python)                                          | 4 weeks | API team         |
| Team collaboration (shared workspaces, approval flows)                    | 6 weeks | Full stack       |
| Template marketplace                                                      | 4 weeks | Full stack       |
| C2PA provenance + content safety hardening                                | 3 weeks | Security team    |

---

## Appendix A — Decision log

| Decision           | Chosen                                     | Alternatives considered       | Rationale                                                                                    |
| ------------------ | ------------------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------- |
| Workflow engine    | Cloud Workflows                            | Cloud Tasks, Airflow          | Managed, serverless, scales to zero. Native integration with Vertex AI.                      |
| Language           | TypeScript everywhere                      | Python, mixed TS/Python       | Type continuity from API to adapter. Python only in isolated model inference containers.     |
| Agent backbone     | Gemini 3.1 Pro                             | GPT-4o, Claude                | State-of-the-art on Google Cloud. Multimodal native.                                         |
| Self-hosted models | Selective (high-volume, cheap-to-run only) | All self-hosted, all external | Balances cost optimization with maintenance burden.                                          |
| Asset storage      | GCS + Firestore                            | Cloud Storage, Cloud SQL      | Firestore for its native real-time sync and scalability.                                     |
| Monorepo           | pnpm workspaces + Turborepo                | Nx, separate repos            | Simplest setup for team of 5–15. Turborepo caching speeds CI. Migrate to Nx if needed later. |
