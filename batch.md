# Batch Processing Implementation Plan (Server-Side)

This document outlines the architecture for enabling **Server-Side Batch Processing** in FlowCraft, supporting concurrent execution and "dozens" of inputs.

## 1. Architecture Overview

We will move the execution logic to the server to ensure reliability and scalability.

**Key Components:**
1.  **Batch Service (`lib/services/batch-service.ts`)**: The core orchestrator. Manages job creation, execution, and persistence.
2.  **Server Workflow Engine (`lib/server-workflow-engine.ts`)**: A Node.js-compatible version of the workflow engine that does *not* depend on React hooks.
3.  **Service Layer (`lib/services/*`)**: Extracted logic from current API routes (Text, Image, Video) to be reusable by both the API and the Batch Engine.
4.  **Job Store (Firestore)**: Persists batch jobs, input queues, and results.
5.  **Concurrency Manager**: Limits the number of parallel flow executions (e.g., 5 concurrent flows).

## 2. Data Model (Firestore)

We will use Firestore to track batch jobs.

**Collection: `batch_jobs`**
-   `id`: string (UUID)
-   `status`: 'pending' | 'processing' | 'completed' | 'failed'
-   `totalRows`: number
-   `completedRows`: number
-   `concurrency`: number (default: 5)
-   `createdAt`: timestamp
-   `flowConfig`: JSON (Snapshot of the flow at runtime)
-   `results`: Array of objects (or sub-collection for scalability)

## 3. Service Layer Extraction

To avoid self-calling API routes (inefficient and prone to timeouts), we will extract core logic.

-   **Current**: `app/api/generate-text/route.ts` contains the Gemini logic.
-   **New**:
    -   `lib/services/ai-service.ts`: Contains `generateText`, `generateImage`, `generateVideo`.
    -   `app/api/generate-text/route.ts`: Imports `generateText` from `ai-service.ts` and handles HTTP req/res.
    -   `ServerWorkflowEngine`: Imports `generateText` from `ai-service.ts` directly.

## 4. Server Workflow Engine

A new class `ServerWorkflowEngine` in `lib/server-workflow-engine.ts`.
-   **Input**: `nodes`, `edges`, `inputs` (for a single run).
-   **Logic**: Similar to `WorkflowEngine` but:
    -   No `onNodeUpdate` callbacks (or simplified logging callbacks).
    -   Uses `lib/services/*` instead of `fetch`.
    -   Returns the final outputs directly.

## 5. Execution Flow

1.  **Upload & Create**:
    -   User uploads CSV.
    -   Frontend parses CSV and sends to `POST /api/batches`.
    -   Server creates a `batch_job` document in Firestore with status `pending`.
2.  **Trigger Run**:
    -   User clicks "Run" (with concurrency setting, e.g., 5).
    -   `POST /api/batches/:id/run` is called.
    -   Server updates status to `processing`.
    -   **Async Execution**:
        -   The server starts the `BatchService.processBatch(jobId)` method.
        -   *Note*: In a serverless env (Vercel), we might need to keep the request open or use a background worker. For this plan, we assume a long-running request or a robust environment. We will implement a "Process Chunk" approach if needed, but standard concurrency control is the goal.
3.  **Concurrent Processing**:
    -   `BatchService` fetches inputs.
    -   Uses a **Concurrency Limiter** (e.g., `p-limit` pattern) to run `ServerWorkflowEngine.execute()` for `X` inputs simultaneously.
    -   As each flow completes:
        -   Save result to Firestore.
        -   Update `completedRows` count.
4.  **Polling**:
    -   Frontend polls `GET /api/batches/:id` to update the progress bar.

## 6. Implementation Steps

### Phase 1: Service Refactoring
1.  Create `lib/services/ai-service.ts`.
2.  Move logic from `app/api/generate-text`, `generate-image`, `generate-video` to this service.
3.  Update API routes to use the service.

### Phase 2: Server Engine
1.  Create `lib/server-workflow-engine.ts`.
2.  Implement `execute(inputs)` method that runs the flow logic without React dependencies.

### Phase 3: Batch Service & API
1.  Create `lib/services/batch-service.ts`.
    -   Implement `createJob`, `getJob`, `runJob`.
    -   Implement concurrency logic:
        ```typescript
        const limit = pLimit(concurrency);
        await Promise.all(inputs.map(input => limit(() => runSingleFlow(input))));
        ```
2.  Create API routes:
    -   `POST /api/batches` (Create)
    -   `POST /api/batches/[id]/run` (Start)
    -   `GET /api/batches/[id]` (Status)

### Phase 4: UI Integration
1.  Update `BatchModal` to use these new API endpoints.
2.  Add "Concurrency" slider to the UI.

## 7. Scalability & Limits
-   **Concurrency**: User can set X (e.g., 1-10).
-   **Timeouts**: If running on Vercel, we must be careful.
    -   *Mitigation*: We can process in "chunks" if needed, but for "dozens", a single long request might survive if < 60s.
    -   *Better*: If the user has a custom server, this works perfectly.

## 8. Verification Plan
-   **Unit Test**: Test `ServerWorkflowEngine` with mock services.
-   **Integration Test**: Create a batch with 2 inputs, run with concurrency 1, verify 2 results in Firestore.
-   **Manual**: Run a batch of 5 items with concurrency 2, watch logs to see overlap.
