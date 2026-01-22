# PRD: Batch Execution System

## AI Media Generation Webapp

---

## 1. Overview

### 1.1 Feature Summary

Enable users to execute workflows at scale by providing multiple inputs (via CSV/JSON upload) and receiving structured outputs. Designed for use cases like bulk product catalog generation.

### 1.2 Tech Stack

| Layer            | Technology                                    |
| ---------------- | --------------------------------------------- |
| Frontend         | Next.js, React 19, TypeScript, Tailwind CSS 4 |
| State Management | Zustand                                       |
| Database         | Google Firestore                              |
| File Storage     | Google Cloud Storage (GCS)                    |
| Job Queue        | BullMQ + Redis                                |
| AI Provider      | Google Vertex AI                              |

### 1.3 Key Constraints

- Scale: 100s to 1000s of items per batch
- Execution: Asynchronous via job queue
- Error handling: Continue on item failure, report errors
- Rate limiting: Auto-throttle to respect Vertex AI quotas

---

## 2. User Stories

| ID  | Story                                                                                                | Priority |
| --- | ---------------------------------------------------------------------------------------------------- | -------- |
| B1  | As a user, I want to upload a CSV/JSON file with multiple inputs so I can process many items at once | P0       |
| B2  | As a user, I want the system to auto-map file columns to workflow inputs so setup is faster          | P0       |
| B3  | As a user, I want to manually adjust column mappings when auto-detection is wrong                    | P0       |
| B4  | As a user, I want to see a cost estimate before running a batch so I can budget accordingly          | P1       |
| B5  | As a user, I want to start a batch and see real-time progress (overall + per-item)                   | P0       |
| B6  | As a user, I want failed items to not stop the entire batch so most items still complete             | P0       |
| B7  | As a user, I want to pause a running batch so I can manage costs or fix issues                       | P1       |
| B8  | As a user, I want to resume a paused batch from where it stopped                                     | P1       |
| B9  | As a user, I want to cancel a batch entirely if needed                                               | P1       |
| B10 | As a user, I want to retry only the failed items without re-running successful ones                  | P1       |
| B11 | As a user, I want to view all batch outputs in a gallery/table format                                | P0       |
| B12 | As a user, I want to download all results (CSV/JSON for data, ZIP for media)                         | P1       |
| B13 | As a user, I want to be notified when my batch completes (in-app notification)                       | P2       |

---

## 3. System Architecture

### 3.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USER FLOW                                   │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────────────┐
  │  Upload  │────▶│  Map     │────▶│  Review  │────▶│  Start Batch     │
  │  File    │     │  Columns │     │  & Cost  │     │                  │
  └──────────┘     └──────────┘     └──────────┘     └────────┬─────────┘
                                                              │
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           BACKEND FLOW                                   │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐
  │  Validate    │────▶│  Flatten     │────▶│  Create BatchJob +       │
  │  Inputs      │     │  Graph       │     │  BatchItems in Firestore │
  └──────────────┘     └──────────────┘     └────────────┬─────────────┘
                                                         │
                                                         ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                         REDIS / BULLMQ                                │
  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         ┌─────────┐│
  │  │ Job 1   │ │ Job 2   │ │ Job 3   │ │ Job 4   │   ...   │ Job N   ││
  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘         └─────────┘│
  └──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                      GPU WORKERS (Concurrent)                         │
  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
  │  │  Worker 1  │  │  Worker 2  │  │  Worker 3  │  │  Worker 4  │     │
  │  │            │  │            │  │            │  │            │     │
  │  │ ┌────────┐ │  │ ┌────────┐ │  │ ┌────────┐ │  │ ┌────────┐ │     │
  │  │ │Vertex  │ │  │ │Vertex  │ │  │ │Vertex  │ │  │ │Vertex  │ │     │
  │  │ │AI API  │ │  │ │AI API  │ │  │ │AI API  │ │  │ │AI API  │ │     │
  │  │ └────────┘ │  │ └────────┘ │  │ └────────┘ │  │ └────────┘ │     │
  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │
  └──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  FIRESTORE (Real-time Updates)              GCS (Media Storage)      │
  │  ┌─────────────────────────────┐           ┌─────────────────────┐  │
  │  │ BatchJob: status, progress  │           │ /batches/{id}/      │  │
  │  │ BatchItems: per-item status │           │   output_001.png    │  │
  │  └─────────────────────────────┘           │   output_002.png    │  │
  │                                            └─────────────────────┘  │
  └──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                           ┌──────────────┐
                           │   Frontend   │
                           │  (Realtime   │
                           │   Listener)  │
                           └──────────────┘
```

### 3.2 Component Responsibilities

| Component              | Responsibility                                               |
| ---------------------- | ------------------------------------------------------------ |
| **Next.js API Routes** | Receive uploads, validate, create jobs, return status        |
| **Graph Flattener**    | Resolve all CUSTOM_WORKFLOW nodes into flat executable graph |
| **BullMQ Queue**       | Manage job distribution, retries, rate limiting              |
| **Workers**            | Execute flattened graphs against Vertex AI, store results    |
| **Firestore**          | Persist job/item state, enable real-time UI updates          |
| **GCS**                | Store input files and generated media outputs                |

---

## 4. Data Models

### 4.1 Firestore Collections

```
/batchJobs/{batchJobId}
/batchItems/{batchItemId}
```

### 4.2 BatchJob Document

```typescript
interface BatchJob {
    id: string;
    userId: string;
    workflowId: string;
    workflowVersion: string;

    // Metadata
    name?: string;

    // Input
    inputSource: {
        type: "csv" | "json";
        fileName: string;
        gcsPath: string;
        rowCount: number;
    };

    // Column mapping (CSV column → Workflow input name)
    inputMappings: Record<string, string>;

    // Flattened graph (stored for worker execution)
    flattenedGraphGcsPath: string;

    // Configuration
    config: {
        maxConcurrency: number; // Default: 5
        retryAttempts: number; // Default: 2
        continueOnError: boolean; // Default: true
    };

    // Progress
    status: BatchJobStatus;
    totalItems: number;
    completedItems: number;
    failedItems: number;

    // Cost
    estimatedCost: number;
    actualCost: number;
    currency: string; // 'USD'

    // Timestamps
    createdAt: Timestamp;
    startedAt: Timestamp | null;
    completedAt: Timestamp | null;

    // Error (for system-level failures)
    error?: {
        code: string;
        message: string;
    };
}

type BatchJobStatus =
    | "draft" // Created, not started
    | "validating" // Checking inputs and flattening graph
    | "queued" // Jobs enqueued, waiting for workers
    | "running" // Workers processing
    | "paused" // User paused
    | "completed" // All items processed (success or failed)
    | "cancelled" // User cancelled
    | "failed"; // System-level failure
```

### 4.3 BatchItem Document

```typescript
interface BatchItem {
    id: string;
    batchJobId: string;

    // Position
    rowIndex: number;

    // Input for this row
    inputData: Record<string, any>;

    // Execution
    status: BatchItemStatus;
    attemptCount: number;

    // Output
    outputs?: Record<string, any>; // Non-media outputs
    mediaOutputs?: MediaOutput[];

    // Error
    error?: {
        code: string;
        message: string;
        attemptNumber: number;
        timestamp: Timestamp;
    };

    // Timing
    createdAt: Timestamp;
    startedAt: Timestamp | null;
    completedAt: Timestamp | null;
    processingTimeMs: number | null;
}

type BatchItemStatus =
    | "pending" // Not yet queued
    | "queued" // In BullMQ queue
    | "running" // Worker processing
    | "success" // Completed successfully
    | "failed" // Failed after all retries
    | "cancelled"; // Cancelled before processing

interface MediaOutput {
    portName: string; // Which output port
    type: "image" | "video";
    gcsPath: string;
    publicUrl: string;
    mimeType: string;
    sizeBytes: number;
    metadata?: Record<string, any>;
}
```

### 4.4 Firestore Indexes

```javascript
// batchJobs
{ userId: ASC, createdAt: DESC }           // List user's batches
{ userId: ASC, status: ASC }               // Filter by status

// batchItems
{ batchJobId: ASC, rowIndex: ASC }         // Get items in order
{ batchJobId: ASC, status: ASC }           // Filter by status
{ batchJobId: ASC, status: ASC, rowIndex: ASC }  // Compound filter
```

### 4.5 BullMQ Job Payload

```typescript
interface BatchItemJobPayload {
    // References
    batchJobId: string;
    batchItemId: string;
    userId: string;

    // Execution data
    flattenedGraphGcsPath: string; // Shared across all items
    inputData: Record<string, any>; // This item's inputs

    // Config
    outputGcsPrefix: string; // Where to store media
}
```

---

## 5. API Specification

### 5.1 Create Batch Job

```
POST /api/runs
Content-Type: multipart/form-data
```

**Request:**

```typescript
interface CreateBatchRequest {
    workflowId: string;
    workflowVersion: string;
    file: File; // CSV or JSON
    name?: string;
    config?: {
        maxConcurrency?: number;
        retryAttempts?: number;
    };
}
```

**Response (201 Created):**

```typescript
interface CreateBatchResponse {
    job: BatchJob;

    // Validation results
    validation: {
        isValid: boolean;
        totalRows: number;
        validRows: number;
        issues: ValidationIssue[];
    };

    // Auto-detected mappings
    detectedMappings: {
        column: string;
        suggestedInput: string;
        confidence: "exact" | "fuzzy" | "none";
    }[];

    // Cost estimate
    costEstimate: {
        perItem: number;
        total: number;
        currency: string;
    };
}

interface ValidationIssue {
    rowIndex?: number; // null for file-level issues
    column?: string;
    inputName?: string;
    severity: "error" | "warning";
    code: string;
    message: string;
}
```

**Error Codes:**
| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_FILE_FORMAT` | 400 | File is not valid CSV/JSON |
| `FILE_TOO_LARGE` | 400 | Exceeds 10,000 rows or 50MB |
| `WORKFLOW_NOT_FOUND` | 404 | Workflow/version doesn't exist |
| `WORKFLOW_HAS_CYCLE` | 400 | Graph flattening failed due to cycle |

---

### 5.2 Update Mappings

```
PATCH /api/runs/{runId}/mappings
Content-Type: application/json
```

**Request:**

```typescript
interface UpdateMappingsRequest {
    inputMappings: Record<string, string>; // column → input name
}
```

**Response (200 OK):**

```typescript
interface UpdateMappingsResponse {
    job: BatchJob;
    validation: {
        isValid: boolean;
        issues: ValidationIssue[];
    };
    costEstimate: {
        perItem: number;
        total: number;
        currency: string;
    };
}
```

---

### 5.3 Start Batch

```
POST /api/runs/{runId}/start
```

**Request:** Empty body

**Response (200 OK):**

```typescript
interface StartBatchResponse {
    job: BatchJob; // status will be 'queued' or 'running'
}
```

**Error Codes:**
| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_MAPPINGS` | 400 | Required inputs not mapped |
| `ALREADY_STARTED` | 409 | Job already started |
| `INSUFFICIENT_CREDITS` | 402 | User cannot afford this batch |

---

### 5.4 Get Batch Status

```
GET /api/runs/{runId}
```

**Response (200 OK):**

```typescript
interface GetBatchResponse {
    job: BatchJob;
    summary: {
        pending: number;
        queued: number;
        running: number;
        success: number;
        failed: number;
        cancelled: number;
    };
}
```

---

### 5.5 List Batch Items

```
GET /api/runs/{runId}/items?status={status}&page={page}&pageSize={pageSize}
```

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | all | Filter by status |
| `page` | number | 0 | Page number |
| `pageSize` | number | 50 | Items per page (max 100) |

**Response (200 OK):**

```typescript
interface ListItemsResponse {
    items: BatchItem[];
    pagination: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
        hasMore: boolean;
    };
}
```

---

### 5.6 Pause Batch

```
POST /api/runs/{runId}/pause
```

**Response (200 OK):**

```typescript
interface PauseBatchResponse {
    job: BatchJob; // status will be 'paused'
    itemsPaused: number;
}
```

---

### 5.7 Resume Batch

```
POST /api/runs/{runId}/resume
```

**Response (200 OK):**

```typescript
interface ResumeBatchResponse {
    job: BatchJob; // status will be 'running'
    itemsResumed: number;
}
```

---

### 5.8 Cancel Batch

```
POST /api/runs/{runId}/cancel
```

**Response (200 OK):**

```typescript
interface CancelBatchResponse {
    job: BatchJob; // status will be 'cancelled'
    itemsCancelled: number;
}
```

---

### 5.9 Retry Failed Items

```
POST /api/runs/{runId}/retry
```

**Request:**

```typescript
interface RetryRequest {
    itemIds?: string[]; // Specific items, or all failed if omitted
}
```

**Response (200 OK):**

```typescript
interface RetryResponse {
    job: BatchJob;
    itemsRetried: number;
}
```

---

### 5.10 Export Results

```
POST /api/runs/{runId}/export
```

**Request:**

```typescript
interface ExportRequest {
    format: "csv" | "json" | "zip";
    includeInputs: boolean;
    includeMedia: boolean; // Only for 'zip' format
    statusFilter?: BatchItemStatus[]; // Default: all
}
```

**Response (200 OK):**

```typescript
interface ExportResponse {
    downloadUrl: string; // Signed GCS URL
    expiresAt: Timestamp; // URL expiration
    fileName: string;
    sizeBytes: number;
}
```

---

## 6. State Machines

### 6.1 BatchJob State Machine

```
                            ┌─────────┐
                            │  draft  │
                            └────┬────┘
                                 │ POST /start
                                 ▼
                           ┌───────────┐
                           │ validating│
                           └─────┬─────┘
                   ┌─────────────┼─────────────┐
                   │ validation  │             │ validation
                   │ failed      │ success     │ (has warnings)
                   ▼             ▼             ▼
              ┌────────┐    ┌────────┐    ┌────────┐
              │ failed │    │ queued │    │ queued │
              └────────┘    └───┬────┘    └───┬────┘
                                │             │
                                └──────┬──────┘
                                       │ workers start processing
                                       ▼
                    ┌─────────────┬─────────┬────────────┐
                    │             │         │            │
              POST /pause    all items   POST /cancel   system
                    │          done         │           error
                    ▼             │         ▼            │
               ┌────────┐        │    ┌───────────┐     │
               │ paused │        │    │ cancelled │     │
               └───┬────┘        │    └───────────┘     │
                   │             │                      │
            POST /resume        │                      │
                   │             ▼                      ▼
                   │      ┌───────────┐           ┌────────┐
                   └─────▶│ completed │           │ failed │
                          └───────────┘           └────────┘
```

### 6.2 BatchItem State Machine

```
              ┌─────────┐
              │ pending │
              └────┬────┘
                   │ job starts
                   ▼
              ┌─────────┐
              │ queued  │◀──────────────────┐
              └────┬────┘                   │
                   │ worker picks up        │ retry
                   ▼                        │ (attempts < max)
              ┌─────────┐                   │
              │ running │───────────────────┤
              └────┬────┘                   │
         ┌─────────┴─────────┐              │
         │ success           │ error        │
         ▼                   ▼              │
    ┌─────────┐         ┌─────────┐         │
    │ success │         │  (check)│─────────┘
    └─────────┘         └────┬────┘
                             │ attempts >= max
                             ▼
                        ┌─────────┐
                        │ failed  │
                        └─────────┘

    Note: If job is cancelled/paused while item is 'queued' or 'pending':
          Item transitions to 'cancelled'
```

---

## 7. UI/UX Specifications

### 7.1 Batch Creation Flow

**Step 1: File Upload**

```
┌─────────────────────────────────────────────────────────────────┐
│  New Batch Run                                                   │
│                                                                  │
│  Workflow: [Product Image Generator v2.1 ▼]                     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                              ││
│  │     📁  Drop your CSV or JSON file here                     ││
│  │                                                              ││
│  │         or  [Browse Files]                                  ││
│  │                                                              ││
│  │     Accepted: .csv, .json (max 10,000 rows, 50MB)          ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  📋 Example format:                                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ product_name,background_color,style                         ││
│  │ "Blue Sneaker","#FFFFFF","minimal"                          ││
│  │ "Red Handbag","#F5F5F5","luxury"                            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Step 2: Column Mapping**

```
┌─────────────────────────────────────────────────────────────────┐
│  New Batch Run                                                   │
│                                                                  │
│  ✓ File uploaded: products.csv (1,247 rows)       [× Remove]    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  MAP COLUMNS TO WORKFLOW INPUTS                              ││
│  │                                                              ││
│  │  Your File Columns        Workflow Inputs                   ││
│  │  ───────────────────────────────────────────────────────── ││
│  │                                                              ││
│  │  "product_name"     ───▶  [product_name ▼]      ✓ Auto     ││
│  │   (text, 1247 values)     (string, required)                ││
│  │                                                              ││
│  │  "bg_color"         ───▶  [background_color ▼]  ✓ Auto     ││
│  │   (text, 1247 values)     (string, required)                ││
│  │                                                              ││
│  │  "sku"              ───▶  [── Don't import ── ▼] ○ Skipped ││
│  │   (text, 1247 values)                                       ││
│  │                                                              ││
│  │  ⚠️ Missing required input: "style"                         ││
│  │     [Set default value: _________ ]                         ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Validation: ⚠️ 3 warnings                                       │
│  • Row 45: "bg_color" is empty                                  │
│  • Row 892: "bg_color" is empty                                 │
│  • Row 1201: "product_name" exceeds 200 characters              │
│                                                                  │
│                                              [Back] [Continue]   │
└─────────────────────────────────────────────────────────────────┘
```

**Step 3: Review & Start**

```
┌─────────────────────────────────────────────────────────────────┐
│  New Batch Run                                                   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  SUMMARY                                                     ││
│  │                                                              ││
│  │  Workflow:        Product Image Generator v2.1               ││
│  │  Input file:      products.csv                               ││
│  │  Total rows:      1,247                                      ││
│  │  Valid rows:      1,244                                      ││
│  │  Skipped rows:    3 (missing required data)                  ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  COST ESTIMATE                                               ││
│  │                                                              ││
│  │  Items to process:           1,244                           ││
│  │  Cost per item:              $0.02                           ││
│  │  ─────────────────────────────────────                      ││
│  │  Estimated total:            $24.88 USD                      ││
│  │                                                              ││
│  │  ℹ️ Actual cost may vary based on output complexity          ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  SETTINGS                                                    ││
│  │                                                              ││
│  │  Batch name:      [Product Catalog Q1 2025__________]       ││
│  │  Concurrency:     [5 ▼] parallel items                       ││
│  │  Retry attempts:  [2 ▼] per failed item                      ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│                                  [Back] [Start Batch - $24.88]   │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Batch Progress View

```
┌─────────────────────────────────────────────────────────────────┐
│  Product Catalog Q1 2025                        ● Running       │
│  Started 5 minutes ago                                          │
│                                                     [⏸ Pause]   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                              ││
│  │  ████████████████████████░░░░░░░░░░░░░░░░░  623 / 1,244     ││
│  │                                              50.1%           ││
│  │                                                              ││
│  │  ⏱️ ~12 min remaining   |   💰 $12.46 / $24.88 spent        ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ ⏳ 614    │ │ 🔄 5     │ │ ✅ 618   │ │ ❌ 7     │           │
│  │ Pending  │ │ Running  │ │ Success  │ │ Failed   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                  │
│  Filter: [All ▼]   Search: [________________] [Show errors ☐]  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ #    │ Inputs                  │ Status │ Output   │ Time   ││
│  │──────┼─────────────────────────┼────────┼──────────┼────────││
│  │ 1    │ Blue Sneaker, #FFFFFF   │ ✅     │ 🖼️ View  │ 2.3s   ││
│  │ 2    │ Red Handbag, #F5F5F5    │ ✅     │ 🖼️ View  │ 2.1s   ││
│  │ 3    │ Green Jacket, #EEEEEE   │ 🔄     │ ...      │ --     ││
│  │ 4    │ Yellow Belt, #FFFFFF    │ ❌     │ Error    │ 1.8s   ││
│  │ 5    │ Purple Scarf, #F0F0F0   │ ⏳     │ --       │ --     ││
│  │ ...  │                         │        │          │        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                            Page 1 of 25 [< >]   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  [🔄 Retry Failed (7)]      [📥 Export Results]             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Item Detail Modal (on row click)

```
┌─────────────────────────────────────────────────────────────────┐
│  Item #4                                              [×]       │
│                                                                  │
│  Status: ❌ Failed (after 2 attempts)                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  INPUTS                                                      ││
│  │                                                              ││
│  │  product_name:      "Yellow Belt"                            ││
│  │  background_color:  "#FFFFFF"                                ││
│  │  style:             "minimal"                                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ERROR                                                       ││
│  │                                                              ││
│  │  Code:     VERTEX_CONTENT_FILTERED                          ││
│  │  Message:  "Content was blocked by safety filters"          ││
│  │                                                              ││
│  │  Attempt 1: Failed at 10:23:45                              ││
│  │  Attempt 2: Failed at 10:24:12                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│                                        [Retry This Item]        │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 Batch List View (History)

```
┌─────────────────────────────────────────────────────────────────┐
│  Batch Runs                                    [+ New Batch]    │
│                                                                  │
│  Filter: [All ▼]  [Last 30 days ▼]                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Name                  │ Workflow      │ Progress │ Status   ││
│  │───────────────────────┼───────────────┼──────────┼──────────││
│  │ Product Catalog Q1    │ Product Gen   │ 623/1244 │ 🔄 Running││
│  │ Holiday Assets        │ Banner Gen    │ 500/500  │ ✅ Done   ││
│  │ Test Run              │ Product Gen   │ 10/10    │ ✅ Done   ││
│  │ Failed Experiment     │ Video Gen     │ 3/100    │ ❌ Failed ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Rate Limiting Strategy

### 8.1 Vertex AI Limits (Default)

| Resource           | Limit       | Window     |
| ------------------ | ----------- | ---------- |
| Imagen (image gen) | 60 requests | per minute |
| Veo (video gen)    | 10 requests | per minute |

### 8.2 Implementation Approach

| Component      | Rate Limit Handling                  |
| -------------- | ------------------------------------ |
| **BullMQ**     | Configure `limiter` option on queue  |
| **Workers**    | Token bucket per AI endpoint         |
| **Backoff**    | Exponential backoff on 429 responses |
| **User-level** | `maxConcurrency` config per batch    |

### 8.3 Configuration

```typescript
interface RateLimitConfig {
    vertexImagen: {
        maxPerMinute: 60;
        burstSize: 10;
    };
    vertexVeo: {
        maxPerMinute: 10;
        burstSize: 2;
    };
    perBatch: {
        defaultConcurrency: 5;
        maxConcurrency: 20;
    };
}
```

---

## 9. Error Handling

### 9.1 Error Categories

| Category                                   | Behavior                    | Retry |
| ------------------------------------------ | --------------------------- | ----- |
| **Transient** (rate limit, timeout, 5xx)   | Retry with backoff          | Yes   |
| **Content** (safety filter, invalid input) | Mark failed, continue batch | No    |
| **System** (auth, quota exceeded)          | Pause batch, notify user    | No    |
| **Fatal** (corrupted data, bug)            | Fail batch, alert ops       | No    |

### 9.2 Error Codes

| Code                 | Category  | User Message                         |
| -------------------- | --------- | ------------------------------------ |
| `RATE_LIMITED`       | Transient | "API rate limit hit, retrying..."    |
| `TIMEOUT`            | Transient | "Request timed out, retrying..."     |
| `VERTEX_UNAVAILABLE` | Transient | "AI service temporarily unavailable" |
| `CONTENT_FILTERED`   | Content   | "Content blocked by safety filters"  |
| `INVALID_INPUT`      | Content   | "Input data invalid: {details}"      |
| `QUOTA_EXCEEDED`     | System    | "API quota exceeded, batch paused"   |
| `AUTH_FAILED`        | System    | "Authentication failed"              |
| `INTERNAL_ERROR`     | Fatal     | "An unexpected error occurred"       |

---

## 10. Acceptance Criteria

### 10.1 File Upload & Parsing

- [ ] User can upload CSV files up to 50MB / 10,000 rows
- [ ] User can upload JSON files (array of objects) up to 50MB / 10,000 rows
- [ ] System detects and reports malformed files with specific error location
- [ ] System extracts column names from CSV header row
- [ ] System extracts keys from first JSON object

### 10.2 Column Mapping

- [ ] System auto-maps columns to inputs when names match exactly
- [ ] System suggests fuzzy matches (e.g., "bg_color" → "background_color")
- [ ] User can manually override any mapping via dropdown
- [ ] User can set default values for unmapped required inputs
- [ ] User can mark columns as "Don't import"
- [ ] Validation errors shown per-row with row number

### 10.3 Cost Estimation

- [ ] System displays estimated cost before batch starts
- [ ] Cost estimate updates when mappings change
- [ ] Actual cost tracked and displayed during/after execution

### 10.4 Batch Execution

- [ ] Batch starts within 5 seconds of user clicking "Start"
- [ ] Items are queued to BullMQ in correct order
- [ ] Workers respect configured concurrency limit
- [ ] Workers respect Vertex AI rate limits
- [ ] Failed items retry up to configured attempt limit
- [ ] Successful items never re-execute on retry

### 10.5 Progress & Monitoring

- [ ] Progress bar updates in real-time (within 2 seconds)
- [ ] Per-item status visible in scrollable list
- [ ] User can filter items by status
- [ ] User can search items by input values
- [ ] Clicking item shows detail modal with inputs/outputs/errors

### 10.6 Batch Controls

- [ ] User can pause running batch (new items stop, running items complete)
- [ ] User can resume paused batch (pending items re-queue)
- [ ] User can cancel batch (all non-completed items marked cancelled)
- [ ] User can retry failed items (individually or all at once)

### 10.7 Results & Export

- [ ] Generated media viewable in item detail modal
- [ ] Export to CSV includes all inputs + outputs
- [ ] Export to JSON includes full item data
- [ ] Export to ZIP includes CSV + all media files
- [ ] Download URL valid for 24 hours

---

## 11. Implementation Phases

### Phase 1: Foundation (Week 1)

| Task | Description                                     |
| ---- | ----------------------------------------------- |
| 1.1  | Set up Redis + BullMQ infrastructure            |
| 1.2  | Create Firestore collections and indexes        |
| 1.3  | Implement file upload to GCS                    |
| 1.4  | Build CSV/JSON parsing service                  |
| 1.5  | Implement auto-mapping logic                    |
| 1.6  | Create BatchJob and BatchItem document handlers |

### Phase 2: Execution Engine (Week 2)

| Task | Description                        |
| ---- | ---------------------------------- |
| 2.1  | Implement graph flattener service  |
| 2.2  | Build BullMQ producer (enqueueing) |
| 2.3  | Build BullMQ worker (processing)   |
| 2.4  | Integrate Vertex AI execution      |
| 2.5  | Implement rate limiting            |
| 2.6  | Implement retry logic              |

### Phase 3: API Layer (Week 3)

| Task | Description                               |
| ---- | ----------------------------------------- |
| 3.1  | POST /api/runs (create batch)             |
| 3.2  | PATCH /api/runs/{id}/mappings             |
| 3.3  | POST /api/runs/{id}/start                 |
| 3.4  | GET /api/runs/{id}                        |
| 3.5  | GET /api/runs/{id}/items                  |
| 3.6  | POST /api/runs/{id}/pause, resume, cancel |
| 3.7  | POST /api/runs/{id}/retry                 |
| 3.8  | POST /api/runs/{id}/export                |

### Phase 4: Frontend (Week 4)

| Task | Description                                |
| ---- | ------------------------------------------ |
| 4.1  | File upload component with drag-drop       |
| 4.2  | Column mapping UI                          |
| 4.3  | Cost estimate display                      |
| 4.4  | Batch progress view with real-time updates |
| 4.5  | Item list with filtering/pagination        |
| 4.6  | Item detail modal                          |
| 4.7  | Batch controls (pause/resume/cancel)       |
| 4.8  | Export functionality                       |
| 4.9  | Batch history list view                    |

### Phase 5: Polish (Week 5)

| Task | Description                       |
| ---- | --------------------------------- |
| 5.1  | Error handling and user messaging |
| 5.2  | Loading states and skeletons      |
| 5.3  | Edge case handling                |
| 5.4  | Performance optimization          |
| 5.5  | End-to-end testing                |

---

## 12. Open Questions

| #   | Question                                                | Recommendation        | Decision |
| --- | ------------------------------------------------------- | --------------------- | -------- |
| 1   | Should we support scheduled batches (run at X time)?    | Defer to v2           |          |
| 2   | Should we support webhooks for batch completion?        | Defer to v2           |          |
| 3   | How long to retain batch data and media?                | 90 days, then archive |          |
| 4   | Should users be able to clone/duplicate a batch config? | Nice-to-have, v1.1    |          |
| 5   | Priority queues for paid tiers?                         | Defer to v2           |          |

> > >
