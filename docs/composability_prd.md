# Product Requirements Document

## Workflow Composability (Sub-Graphs)

---

## 1. Overview

### 1.1 Summary

Enable users to publish workflows as reusable nodes (Sub-Graphs) that can be embedded in other workflows, creating an infinitely nestable, function-like abstraction system.

### 1.2 Core Concept: "Workflow as a Function"

A workflow behaves like a code function: `Output = Workflow(Input)`

- **Encapsulation**: Users see custom nodes as single "black boxes"
- **Infinite Nesting**: Workflow A can contain Workflow B which contains Workflow C...
- **Strict Typing**: The UI enforces connection validity between ports
- **Version Pinning**: References point to specific `workflowId + version`

### 1.3 Tech Stack

| Layer            | Technology                                    |
| ---------------- | --------------------------------------------- |
| Frontend         | Next.js, React 19, TypeScript, Tailwind CSS 4 |
| State Management | Zustand                                       |
| Database         | Google Firestore                              |
| File Storage     | Google Cloud Storage                          |
| AI Provider      | Google Vertex AI                              |

### 1.4 Success Metrics

- Users can publish and reuse workflows as nodes
- Zero circular dependency errors reach runtime
- Component discovery increases workflow creation velocity

---

## 2. User Stories

| ID  | Story                                                                                     | Acceptance Criteria                                                                                        |
| --- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| C1  | As a user, I want to add `WorkflowInput` nodes to define external inputs to my workflow   | Input nodes appear in editor toolbox; each defines one typed port                                          |
| C2  | As a user, I want to add `WorkflowOutput` nodes to define what data leaves my workflow    | Output nodes appear in editor toolbox; each defines one typed port                                         |
| C3  | As a user, I want to publish my workflow as a reusable node                               | "Publish" action validates graph and creates versioned, immutable snapshot                                 |
| C4  | As a user, I want to set my published workflow as private or public                       | Visibility toggle on publish; private = only me, public = all users                                        |
| C5  | As a user, I want to browse a gallery of available workflows (mine + public)              | Gallery with search, filter by author/tags, sorted by usage                                                |
| C6  | As a user, I want to drag a published workflow into my editor and use it as a single node | Node renders with input ports matching `WorkflowInput` nodes, output ports matching `WorkflowOutput` nodes |
| C7  | As a user, I want connections to be validated by type                                     | Invalid connections refused or shown in error state                                                        |
| C8  | As a user, I want my usage of a sub-workflow pinned to a specific version                 | Version stored in node data; parent unaffected by sub-workflow updates                                     |
| C9  | As a user, I want to see when a newer version is available and choose to upgrade          | Visual indicator on node; upgrade action remaps connections if compatible                                  |
| C10 | As a user, I want to be prevented from creating circular dependencies                     | System rejects save/publish if cycle detected                                                              |

---

## 3. Data Models

### 3.1 Collections Overview

```
/workflows/{workflowId}
```

Single collection handles both "workflows" and "published components" — a published workflow IS a component.

### 3.2 Workflow Document

```typescript
interface Workflow {
    id: string;
    userId: string;
    name: string;
    description?: string;

    // Versioning
    version: string; // Semantic: "1.0.0"
    parentWorkflowId?: string; // Points to previous version (for version chain)
    isLatestVersion: boolean;

    // Graph Structure
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];

    // Interface Contract (derived from WORKFLOW_INPUT/OUTPUT nodes)
    inputs: WorkflowPort[];
    outputs: WorkflowPort[];

    // Publishing State
    isPublished: boolean; // false = draft, true = immutable & usable
    visibility: "private" | "public";
    tags: string[];

    // Stats
    usageCount: number;

    // Timestamps
    createdAt: Timestamp;
    updatedAt: Timestamp;
    publishedAt?: Timestamp;
}
```

### 3.3 Node Structure

```typescript
type NodeCategory =
    | "NATIVE_FUNCTION" // Built-in AI operations
    | "CUSTOM_WORKFLOW" // Embedded sub-graph
    | "WORKFLOW_INPUT" // Defines external input port
    | "WORKFLOW_OUTPUT"; // Defines external output port

type NativeFunctionId =
    | "text-prompt"
    | "image-gen"
    | "video-gen"
    | "text-transform"
    | "image-transform"
    | "image-to-text"
    | "video-to-frames";

interface WorkflowNode {
    id: string; // Unique within workflow (e.g., "node_abc123")
    category: NodeCategory;
    position: { x: number; y: number };

    // For NATIVE_FUNCTION
    functionId?: NativeFunctionId;

    // For CUSTOM_WORKFLOW
    subWorkflowId?: string;
    subWorkflowVersion?: string;

    // For WORKFLOW_INPUT / WORKFLOW_OUTPUT
    portName?: string; // User-defined label (e.g., "product_name")
    portType?: PortDataType; // Data type for this port
    portRequired?: boolean; // For inputs: is this required?
    portDefaultValue?: any; // For inputs: default if not provided

    // Static configuration set in UI
    data: Record<string, any>;
}
```

### 3.4 Edge Structure

```typescript
interface WorkflowEdge {
    id: string;
    source: string; // Node ID
    sourceHandle: string; // Output port name (e.g., "image", "text")
    target: string; // Node ID
    targetHandle: string; // Input port name (e.g., "prompt", "source_image")
}
```

### 3.5 Port Definition

```typescript
type PortDataType =
    | "string"
    | "number"
    | "boolean"
    | "image"
    | "video"
    | "json";

interface WorkflowPort {
    id: string; // Matches the WORKFLOW_INPUT/OUTPUT node ID
    name: string; // User-defined label
    dataType: PortDataType;
    required: boolean;
    defaultValue?: any;
    description?: string;
}
```

### 3.6 Type Compatibility Matrix

| Source Type | Valid Targets                 |
| ----------- | ----------------------------- |
| `string`    | `string`                      |
| `number`    | `number`, `string`            |
| `boolean`   | `boolean`, `string`, `number` |
| `image`     | `image`                       |
| `video`     | `video`                       |
| `json`      | `json`, `string`              |

### 3.7 Firestore Indexes

```javascript
// workflows collection
{ userId: 'asc', isPublished: 'asc', createdAt: 'desc' }     // My workflows
{ isPublished: 'asc', visibility: 'asc', usageCount: 'desc' } // Public gallery
{ isPublished: 'asc', visibility: 'asc', tags: 'array-contains' } // Filter by tag
{ parentWorkflowId: 'asc', version: 'desc' }                  // Version history
```

---

## 4. System Architecture

### 4.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
├─────────────────────────────────────────────────────────────────┤
│  Workflow Editor        │  Workflow Gallery    │  Version       │
│  - Node toolbox         │  - Search/filter     │    Manager     │
│  - Canvas (React Flow)  │  - Preview cards     │  - History     │
│  - Connection validation│  - Add to editor     │  - Upgrade UI  │
└─────────┬───────────────┴─────────┬────────────┴───────┬────────┘
          │                         │                    │
          ▼                         ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                  API Layer (Next.js API Routes)                  │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/workflows           - Save/create workflow           │
│  POST /api/workflows/:id/publish - Publish as component         │
│  GET  /api/workflows           - List (with filters)            │
│  GET  /api/workflows/:id       - Get single workflow            │
│  GET  /api/workflows/:id/versions - Get version history         │
└─────────┬───────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                               │
├─────────────────────────────────────────────────────────────────┤
│  WorkflowService      │  ValidationService   │  VersionService  │
│  - CRUD operations    │  - DAG cycle check   │  - Create version│
│  - Publish logic      │  - Type validation   │  - Compare ports │
│                       │  - Nesting check     │  - Migration     │
└─────────┬─────────────┴─────────┬────────────┴─────────┬────────┘
          │                       │                      │
          ▼                       ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Google Firestore                           │
│                    /workflows/{workflowId}                       │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Execution Architecture (Reference)

At execution time, the engine must "flatten" nested workflows into a single resolved graph before processing. This is handled by the Execution Engine (separate from this PRD).

```
User's Workflow                     Flattened Graph
┌─────────────────┐                ┌─────────────────────────────┐
│ [Input]         │                │ [Input]                     │
│    ↓            │                │    ↓                        │
│ [SubWorkflow A] │  ──flatten──▶  │ [A's internal node 1]       │
│    ↓            │                │    ↓                        │
│ [Output]        │                │ [A's internal node 2]       │
└─────────────────┘                │    ↓                        │
                                   │ [Output]                    │
                                   └─────────────────────────────┘
```

---

## 5. API Specifications

### 5.1 Save Workflow

```typescript
// POST /api/workflows
// Creates new or updates existing draft workflow

interface SaveWorkflowRequest {
    id?: string; // If provided, updates existing
    name: string;
    description?: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    tags?: string[];
}

interface SaveWorkflowResponse {
    success: boolean;
    workflow: Workflow;
    validation: {
        isValid: boolean;
        errors: ValidationError[];
        warnings: ValidationWarning[];
    };
}

interface ValidationError {
    code:
        | "CYCLE_DETECTED"
        | "INVALID_CONNECTION"
        | "MISSING_REQUIRED_PORT"
        | "SELF_REFERENCE";
    message: string;
    nodeIds?: string[];
    edgeIds?: string[];
}

interface ValidationWarning {
    code: "DISCONNECTED_NODE" | "DEPRECATED_SUBWORKFLOW";
    message: string;
    nodeIds?: string[];
}
```

### 5.2 Publish Workflow

```typescript
// POST /api/workflows/:id/publish
// Creates immutable, versioned snapshot

interface PublishWorkflowRequest {
    visibility: "private" | "public";
    changelog?: string; // Description of changes from previous version
}

interface PublishWorkflowResponse {
    success: boolean;
    workflow: Workflow; // The published version
    version: string; // e.g., "1.0.0"

    // Derived interface (for display)
    interface: {
        inputs: WorkflowPort[];
        outputs: WorkflowPort[];
    };
}

// Errors:
// - 400: Validation failed (cycle, invalid connections, etc.)
// - 400: No WORKFLOW_INPUT or WORKFLOW_OUTPUT nodes defined
// - 409: Workflow already published (must create new version)
```

### 5.3 List Workflows (Gallery)

```typescript
// GET /api/workflows

interface ListWorkflowsRequest {
    filter: "mine" | "public" | "all";
    isPublished?: boolean;
    tags?: string[];
    search?: string;
    page: number;
    pageSize: number;
    sortBy?: "createdAt" | "usageCount" | "name";
    sortOrder?: "asc" | "desc";
}

interface ListWorkflowsResponse {
    workflows: WorkflowSummary[];
    totalCount: number;
    hasMore: boolean;
}

interface WorkflowSummary {
    id: string;
    name: string;
    description?: string;
    version: string;
    visibility: "private" | "public";
    tags: string[];
    usageCount: number;

    // Quick reference for UI
    inputCount: number;
    outputCount: number;

    // Author info
    userId: string;
    authorName?: string;

    createdAt: Timestamp;
    publishedAt?: Timestamp;
}
```

### 5.4 Get Version History

```typescript
// GET /api/workflows/:id/versions

interface GetVersionsResponse {
    versions: WorkflowVersionSummary[];
}

interface WorkflowVersionSummary {
    id: string; // This version's workflow ID
    version: string; // e.g., "1.0.0", "1.1.0"
    changelog?: string;
    publishedAt: Timestamp;

    // Interface at this version
    inputs: WorkflowPort[];
    outputs: WorkflowPort[];

    // Compatibility info
    isLatest: boolean;
    breakingChanges: boolean; // vs previous version
}
```

### 5.5 Check for Updates

```typescript
// GET /api/workflows/:id/check-updates
// Called for CUSTOM_WORKFLOW nodes to see if newer version exists

interface CheckUpdatesRequest {
    currentVersion: string;
}

interface CheckUpdatesResponse {
    hasUpdate: boolean;
    latestVersion?: string;
    latestWorkflowId?: string;
    changelog?: string;

    compatibility: {
        isCompatible: boolean; // Can upgrade without breaking connections
        addedInputs: WorkflowPort[];
        removedInputs: WorkflowPort[];
        addedOutputs: WorkflowPort[];
        removedOutputs: WorkflowPort[];
        typeChanges: {
            portId: string;
            portName: string;
            oldType: PortDataType;
            newType: PortDataType;
        }[];
    };
}
```

---

## 6. UI/UX Specifications

### 6.1 Node Toolbox

```
┌─────────────────────────────────────┐
│  Node Toolbox                       │
├─────────────────────────────────────┤
│                                     │
│  📥 INPUTS/OUTPUTS                  │
│  ┌─────────────────────────────┐   │
│  │ ➡️  Workflow Input          │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ ⬅️  Workflow Output         │   │
│  └─────────────────────────────┘   │
│                                     │
│  🔧 NATIVE FUNCTIONS                │
│  ┌─────────────────────────────┐   │
│  │ 💬 Text Prompt              │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 🖼️  Image Generation        │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 🎬 Video Generation         │   │
│  └─────────────────────────────┘   │
│  ...                                │
│                                     │
│  📦 MY WORKFLOWS                    │
│  ┌─────────────────────────────┐   │
│  │ 📦 Product Image Gen v1.2   │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 📦 Style Transfer v2.0      │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Browse Gallery...]                │
│                                     │
└─────────────────────────────────────┘
```

### 6.2 Workflow Input Node (Expanded)

```
┌─────────────────────────────────────┐
│  ➡️ Workflow Input                  │
├─────────────────────────────────────┤
│                                     │
│  Name: [product_name_______]        │
│                                     │
│  Type: [string ▼]                   │
│         ├── string                  │
│         ├── number                  │
│         ├── boolean                 │
│         ├── image                   │
│         ├── video                   │
│         └── json                    │
│                                     │
│  Required: [✓]                      │
│                                     │
│  Default: [_______________]         │
│           (optional)                │
│                                     │
│  Description:                       │
│  [The product name to display____]  │
│                                     │
└──────────────────────────────●──────┘
                               ↑
                          output port
                       (connects to other nodes)
```

### 6.3 Workflow Output Node

```
┌──────●──────────────────────────────┐
│      ↑                              │
│  input port                         │
│  (receives data from workflow)      │
├─────────────────────────────────────┤
│  ⬅️ Workflow Output                 │
├─────────────────────────────────────┤
│                                     │
│  Name: [generated_image____]        │
│                                     │
│  Type: [image ▼]                    │
│                                     │
│  Description:                       │
│  [The final generated product___]   │
│                                     │
└─────────────────────────────────────┘
```

### 6.4 Custom Workflow Node (When Used in Another Workflow)

```
                    ┌─────────────────────────────────┐
         ●──────────│  📦 Product Image Generator     │──────────●
    product_name    │     v1.2.0                      │   generated_image
      (string)      │                                 │     (image)
                    │  ┌───────────────────────────┐  │
         ●──────────│  │ [⚠️ v1.3.0 available]     │  │
    background      │  └───────────────────────────┘  │
      (string)      │                                 │
                    │  [👁️ View] [⬆️ Upgrade]         │
                    └─────────────────────────────────┘

Left side: Input ports (from WorkflowInput nodes)
Right side: Output ports (from WorkflowOutput nodes)
```

### 6.5 Connection Validation States

```
Valid Connection (types match):
    [Node A]●━━━━━━━━━━━━●[Node B]
            ↑            ↑
         string       string
         (green line)

Valid Connection (implicit cast):
    [Node A]●━━━━━━━━━━━━●[Node B]
            ↑            ↑
         number       string
         (green line, shows cast icon)

Invalid Connection (incompatible types):
    [Node A]●╌ ╌ ╌ ╌ ╌ ╌●[Node B]
            ↑            ↑
         image        string
         (red dashed, connection refused)

Tooltip: "Cannot connect image to string"
```

### 6.6 Publish Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Publish Workflow                                         [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Name: [Product Image Generator_________________________]       │
│                                                                  │
│  Description:                                                    │
│  [Creates product images with AI-generated backgrounds.____]    │
│  [Supports multiple aspect ratios and styles.______________]    │
│                                                                  │
│  Tags: [product] [image] [e-commerce] [+ Add tag]               │
│                                                                  │
│  Visibility:                                                     │
│  (•) Private - Only you can use this                            │
│  ( ) Public  - Anyone can discover and use this                 │
│                                                                  │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│  INTERFACE PREVIEW                                               │
│                                                                  │
│  Inputs:                           Outputs:                      │
│  ┌─────────────────────────┐      ┌─────────────────────────┐   │
│  │ • product_name (string) │      │ • generated_image (image)│   │
│  │   Required              │      │                          │   │
│  │ • background (string)   │      └─────────────────────────┘   │
│  │   Default: "white"      │                                    │
│  │ • aspect_ratio (string) │                                    │
│  │   Default: "1:1"        │                                    │
│  └─────────────────────────┘                                    │
│                                                                  │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│  Version: 1.0.0  (first publish)                                │
│                                                                  │
│  Changelog: (optional for first version)                        │
│  [Initial release_________________________________________]     │
│                                                                  │
│                                                                  │
│                        [Cancel]  [Publish v1.0.0]               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.7 Workflow Gallery

```
┌─────────────────────────────────────────────────────────────────┐
│  Workflow Gallery                                         [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [🔍 Search workflows...________________________]               │
│                                                                  │
│  Filter: [My Workflows]  [Public]  [All]                        │
│                                                                  │
│  Tags: [product] [image] [video] [text] [style] [clear]        │
│                                                                  │
│  Sort: [Most Used ▼]                                            │
│                                                                  │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  │ 📦               │  │ 📦               │  │ 📦               │
│  │ Product Image    │  │ Video Creator    │  │ Style Transfer   │
│  │ Generator        │  │                  │  │                  │
│  │                  │  │                  │  │                  │
│  │ Creates product  │  │ Generates short  │  │ Applies artistic │
│  │ images with AI   │  │ videos from...   │  │ styles to...     │
│  │ backgrounds      │  │                  │  │                  │
│  │                  │  │                  │  │                  │
│  │ v1.2.0           │  │ v2.0.0           │  │ v1.0.0           │
│  │ 👤 You           │  │ 👤 @jane         │  │ 👤 You           │
│  │ 📊 Used 142x     │  │ 📊 Used 1.2k     │  │ 📊 Used 45x      │
│  │                  │  │                  │  │                  │
│  │ Inputs: 3        │  │ Inputs: 2        │  │ Inputs: 2        │
│  │ Outputs: 1       │  │ Outputs: 1       │  │ Outputs: 1       │
│  │                  │  │                  │  │                  │
│  │ [+ Add to Editor]│  │ [+ Add to Editor]│  │ [+ Add to Editor]│
│  └──────────────────┘  └──────────────────┘  └──────────────────┘
│                                                                  │
│                         [1] [2] [3] ... [12]                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.8 Version Upgrade Dialog

```
┌─────────────────────────────────────────────────────────────────┐
│  Upgrade Available                                        [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📦 Product Image Generator                                     │
│                                                                  │
│  Current Version: v1.2.0                                        │
│  Latest Version:  v1.3.0                                        │
│                                                                  │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│  CHANGELOG                                                       │
│  • Added support for transparent backgrounds                    │
│  • Improved image quality for small products                    │
│  • New "style_preset" input for quick styling                   │
│                                                                  │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│  INTERFACE CHANGES                                               │
│                                                                  │
│  ✅ Compatible - No breaking changes                            │
│                                                                  │
│  Added Inputs:                                                   │
│  • style_preset (string) - Optional, default: "none"           │
│  • transparent_bg (boolean) - Optional, default: false         │
│                                                                  │
│  Removed Inputs: None                                           │
│  Changed Types: None                                            │
│                                                                  │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│                    [Keep v1.2.0]  [⬆️ Upgrade to v1.3.0]         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘


// If breaking changes exist:

│  INTERFACE CHANGES                                               │
│                                                                  │
│  ⚠️ Breaking Changes Detected                                   │
│                                                                  │
│  Removed Inputs:                                                 │
│  • background_color (string) - ⚠️ You have this connected       │
│                                                                  │
│  Changed Types:                                                  │
│  • aspect_ratio: string → enum - ⚠️ May need remapping         │
│                                                                  │
│  After upgrade, you will need to fix 2 broken connections.      │
│                                                                  │
```

---

## 7. State Machines

### 7.1 Workflow Lifecycle

```
                         ┌─────────┐
            create()     │  Draft  │
           ─────────────▶│         │◀─────────┐
                         └────┬────┘          │
                              │               │
                              │ edit()        │ createNewVersion()
                              ▼               │
                         ┌─────────┐          │
                         │  Draft  │──────────┘
                         │(modified)│
                         └────┬────┘
                              │
                              │ publish()
                              │ (validates, snapshots)
                              ▼
                         ┌───────────┐
                         │ Published │
                         │(immutable)│
                         └─────┬─────┘
                               │
               ┌───────────────┼───────────────┐
               │               │               │
               ▼               ▼               ▼
        usageCount++     deprecate()      newVersion()
        (when added     (soft warning)    (creates new
         to workflow)                      Draft copy)
```

### 7.2 Validation State (On Save/Publish)

```
         ┌──────────────┐
         │ Validate DAG │
         └──────┬───────┘
                │
        ┌───────┴───────┐
        │               │
        ▼               ▼
   ┌─────────┐    ┌───────────┐
   │ Cycles  │    │ No Cycles │
   │ Detected│    │           │
   └────┬────┘    └─────┬─────┘
        │               │
        ▼               ▼
   ┌─────────┐    ┌───────────────┐
   │ REJECT  │    │ Validate Types│
   │ (error) │    └───────┬───────┘
   └─────────┘            │
                   ┌──────┴──────┐
                   │             │
                   ▼             ▼
             ┌──────────┐  ┌───────────┐
             │ Invalid  │  │   Valid   │
             │Connection│  │           │
             └────┬─────┘  └─────┬─────┘
                  │              │
                  ▼              ▼
             ┌─────────┐   ┌──────────┐
             │ REJECT  │   │ SAVE OK  │
             │ (error) │   │          │
             └─────────┘   └──────────┘
```

### 7.3 Sub-Workflow Node Version State

```
                    ┌──────────────┐
     add to editor  │   Current    │
    ───────────────▶│  (v1.2.0)    │
                    └──────┬───────┘
                           │
                           │ background check
                           ▼
              ┌────────────────────────┐
              │ latestVersion > current?│
              └────────────┬───────────┘
                    ┌──────┴──────┐
                    │             │
                    ▼             ▼
             ┌───────────┐  ┌──────────────┐
             │ Up to Date│  │Update Available│
             │           │  │ (show badge)   │
             └───────────┘  └───────┬───────┘
                                    │
                         ┌──────────┴──────────┐
                         │                     │
                         ▼                     ▼
                   ┌───────────┐         ┌───────────┐
                   │  Dismiss  │         │  Upgrade  │
                   │ (keep old)│         │ (update   │
                   └───────────┘         │  pointer) │
                                         └─────┬─────┘
                                               │
                                               ▼
                                         ┌───────────┐
                                         │ Re-validate│
                                         │ connections│
                                         └───────────┘
```

---

## 8. Validation Rules

### 8.1 Save Validation (Draft)

| Rule                                                | Error Code               | Severity |
| --------------------------------------------------- | ------------------------ | -------- |
| Graph must be a DAG (no cycles)                     | `CYCLE_DETECTED`         | Error    |
| All connections must have valid types               | `INVALID_CONNECTION`     | Error    |
| Sub-workflow references must exist                  | `SUBWORKFLOW_NOT_FOUND`  | Error    |
| Self-reference not allowed (directly or indirectly) | `SELF_REFERENCE`         | Error    |
| Disconnected nodes allowed                          | `DISCONNECTED_NODE`      | Warning  |
| Deprecated sub-workflows                            | `DEPRECATED_SUBWORKFLOW` | Warning  |

### 8.2 Publish Validation (Additional)

| Rule                                               | Error Code              | Severity |
| -------------------------------------------------- | ----------------------- | -------- |
| At least one `WORKFLOW_INPUT` node required        | `NO_INPUTS_DEFINED`     | Error    |
| At least one `WORKFLOW_OUTPUT` node required       | `NO_OUTPUTS_DEFINED`    | Error    |
| All `WORKFLOW_INPUT` nodes must have unique names  | `DUPLICATE_INPUT_NAME`  | Error    |
| All `WORKFLOW_OUTPUT` nodes must have unique names | `DUPLICATE_OUTPUT_NAME` | Error    |
| All `WORKFLOW_OUTPUT` nodes must be connected      | `UNCONNECTED_OUTPUT`    | Error    |
| Name and description required                      | `MISSING_METADATA`      | Error    |

### 8.3 Circular Dependency Detection

The system must prevent:

1. **Direct self-reference**: Workflow A contains Workflow A
2. **Indirect circular reference**: Workflow A contains B, B contains C, C contains A

Detection must occur:

- When saving a workflow that contains sub-workflows
- When publishing a workflow
- Recursively traverse all `CUSTOM_WORKFLOW` nodes and build dependency graph

---

## 9. Zustand Store Definition

```typescript
// stores/workflowEditorStore.ts

interface WorkflowEditorState {
    // Current workflow
    workflow: Workflow | null;
    isDirty: boolean;

    // Selection
    selectedNodeIds: string[];
    selectedEdgeIds: string[];

    // Validation state
    validationResult: ValidationResult | null;

    // UI state
    isPublishModalOpen: boolean;
    isGalleryOpen: boolean;

    // Sub-workflow updates
    availableUpdates: Map<string, UpdateInfo>; // nodeId -> update info

    // Actions - Workflow
    loadWorkflow: (id: string) => Promise<void>;
    saveWorkflow: () => Promise<SaveResult>;
    createNewWorkflow: () => void;

    // Actions - Nodes
    addNode: (
        category: NodeCategory,
        position: { x: number; y: number },
        data?: any,
    ) => void;
    updateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
    removeNode: (nodeId: string) => void;

    // Actions - Edges
    addEdge: (edge: Omit<WorkflowEdge, "id">) => ValidationResult;
    removeEdge: (edgeId: string) => void;

    // Actions - Validation
    validateConnection: (
        source: PortRef,
        target: PortRef,
    ) => ConnectionValidation;
    validateWorkflow: () => Promise<ValidationResult>;

    // Actions - Publishing
    openPublishModal: () => void;
    closePublishModal: () => void;
    publishWorkflow: (options: PublishOptions) => Promise<PublishResult>;

    // Actions - Gallery
    openGallery: () => void;
    closeGallery: () => void;
    addWorkflowFromGallery: (workflowId: string, version: string) => void;

    // Actions - Updates
    checkForUpdates: () => Promise<void>;
    upgradeSubWorkflow: (nodeId: string, newVersion: string) => Promise<void>;
    dismissUpdate: (nodeId: string) => void;
}

interface PortRef {
    nodeId: string;
    handleId: string;
}

interface ConnectionValidation {
    isValid: boolean;
    reason?: string;
    sourceType: PortDataType;
    targetType: PortDataType;
    requiresCast: boolean;
}

interface UpdateInfo {
    currentVersion: string;
    latestVersion: string;
    latestWorkflowId: string;
    isCompatible: boolean;
    changelog?: string;
}

interface PublishOptions {
    visibility: "private" | "public";
    changelog?: string;
}
```

---

## 10. Implementation Phases

### Phase 1: Foundation (Week 1)

| Task | Description                                           | Priority |
| ---- | ----------------------------------------------------- | -------- |
| 1.1  | Create Firestore schema and indexes                   | P0       |
| 1.2  | Implement `WORKFLOW_INPUT` node type in editor        | P0       |
| 1.3  | Implement `WORKFLOW_OUTPUT` node type in editor       | P0       |
| 1.4  | Build port configuration UI for input/output nodes    | P0       |
| 1.5  | Implement type compatibility checking service         | P0       |
| 1.6  | Add connection validation in editor (visual feedback) | P0       |

### Phase 2: Publishing (Week 2)

| Task | Description                                         | Priority |
| ---- | --------------------------------------------------- | -------- |
| 2.1  | Build publish modal UI                              | P0       |
| 2.2  | Implement DAG cycle detection service               | P0       |
| 2.3  | Implement circular dependency detection (nested)    | P0       |
| 2.4  | Create publish API endpoint with validation         | P0       |
| 2.5  | Generate interface contract from input/output nodes | P0       |
| 2.6  | Implement version numbering logic                   | P1       |

### Phase 3: Gallery & Usage (Week 3)

| Task | Description                                        | Priority |
| ---- | -------------------------------------------------- | -------- |
| 3.1  | Build workflow gallery UI                          | P0       |
| 3.2  | Implement gallery listing API with filters         | P0       |
| 3.3  | Implement `CUSTOM_WORKFLOW` node type in editor    | P0       |
| 3.4  | Render custom node with correct input/output ports | P0       |
| 3.5  | Wire up "Add to Editor" from gallery               | P0       |
| 3.6  | Increment usage count on add                       | P2       |

### Phase 4: Versioning (Week 4)

| Task | Description                               | Priority |
| ---- | ----------------------------------------- | -------- |
| 4.1  | Implement version history API             | P0       |
| 4.2  | Build version comparison service          | P1       |
| 4.3  | Add update check for sub-workflow nodes   | P1       |
| 4.4  | Build upgrade dialog UI                   | P1       |
| 4.5  | Implement connection remapping on upgrade | P1       |
| 4.6  | Handle breaking changes gracefully        | P1       |

---

## 11. Acceptance Criteria

### Must Have (P0)

- [ ] User can add `WorkflowInput` nodes with name, type, required flag, default value
- [ ] User can add `WorkflowOutput` nodes with name and type
- [ ] Invalid type connections are visually rejected in the editor
- [ ] User can publish a workflow with at least one input and one output
- [ ] Published workflows are immutable
- [ ] User can set visibility (private/public) on publish
- [ ] User can browse gallery filtered by "mine" and "public"
- [ ] User can search gallery by name
- [ ] User can add a published workflow to editor as a single node
- [ ] Custom workflow node displays correct input/output ports
- [ ] Circular dependencies are detected and rejected on save/publish
- [ ] Each publish creates a new version; previous versions preserved

### Should Have (P1)

- [ ] Version number auto-increments (semantic versioning)
- [ ] User sees badge when sub-workflow has newer version
- [ ] User can view changelog before upgrading
- [ ] Upgrade dialog shows interface changes (added/removed ports)
- [ ] Compatible upgrades auto-remap connections
- [ ] Breaking changes clearly indicated

### Nice to Have (P2)

- [ ] Usage count displayed in gallery
- [ ] Sort gallery by usage/date/name
- [ ] Tags for categorization
- [ ] Deprecation warning for old versions
- [ ] "View internal graph" option for custom nodes

---

## 12. Open Questions

| #   | Question                                             | Recommendation                  | Decision |
| --- | ---------------------------------------------------- | ------------------------------- | -------- |
| 1   | Should draft workflows be sharable?                  | No, only published              |          |
| 2   | Can users delete a published workflow?               | No if in use; deprecate instead |          |
| 3   | Max nesting depth for safety?                        | 50 levels                       |          |
| 4   | Should public workflows require approval/moderation? | No for MVP                      |          |
| 5   | How to handle deleted sub-workflow at runtime?       | Fail with clear error           |          |

---

This PRD is ready for implementation handoff. The algorithms (DAG validation, cycle detection, graph flattening, type checking) should be implemented during development based on the specifications above.
