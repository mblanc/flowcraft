# Composability PRD (Adapted for FlowCraft)

**Status:** Draft
**Target Release:** 1.0 (Composability Update)
**Based on:** Generic Composability PRD & FlowCraft Architecture

---

## 1. Overview

### 1.1 Summary
The Composability feature allows FlowCraft users to encapsulate entire workflows as reusable nodes (Sub-Graphs). This enables a "Workflow as a Function" paradigm, where complex logic can be bundled, versioned, and reused across multiple projects, significantly accelerating workflow creation and promoting modularity.

### 1.2 Core Concept: Recursion & Encapsulation
- **Workflow-as-Node**: A published workflow becomes a black-box node with defined inputs and outputs.
- **Infinite Operations**: A workflow can contain other workflows, which can contain others, ad infinitum (checked for circular dependencies).
- **Strict Interfaces**: Inputs/Outputs are strictly typed to ensure runtime stability.

### 1.3 Architecture Alignment
FlowCraft's current stack (Next.js, React Flow, Zod, Firestore) is well-suited for this adaptation.
- **Frontend**: `@xyflow/react` handles the visual graph; new custom node types will represent inputs/outputs/sub-flows.
- **Backend**: Next.js API Routes will handle publishing and versioning.
- **Runtime**: The proprietary `WorkflowEngine` will be upgraded to support recursive graph flattening.

---

## 2. User Experience

### 2.1 Defining Interfaces
Users define the boundary of their reusable workflow using special nodes:
- **Workflow Input Node**: Acts as a parameter for the "function".
    - Properties: `name` (e.g., "topic"), `type` (e.g., "string"), `defaultValue`.
- **Workflow Output Node**: Acts as the return value.
    - Properties: `name` (e.g., "blog_post"), `type` (e.g., "text").

### 2.2 Publishing
Once a workflow is tested, the user clicks **"Publish"**.
- Validates the graph (no cycles, valid connections).
- Freezes the version (saving a snapshot).
- Computes the "Signature" (Inputs/Outputs).
- Makes it available in the **"My Library"** section of the toolbox.

### 2.3 Consumption
- Users see their published workflows in the toolbox.
- Dragging a "Blog Generator v1.0" node into the canvas creates a **Custom Workflow Node**.
- This node has handles matching the defined Inputs and Outputs.
- It "just works" like a native node.

---

## 3. Technical Implementation

### 3.1 Data Model Extensions (`lib/schemas.ts`)

New Zod schemas will be added to the `NodeDataSchema` union:

#### Workflow Input Node
```typescript
{
  type: "workflow-input",
  name: string,       // e.g. "user_prompt"
  dataType: "string" | "image" | "video" | "file",
  required: boolean,
  defaultValue?: any
}
```

#### Workflow Output Node
```typescript
{
  type: "workflow-output",
  name: string,       // e.g. "final_video"
  dataType: "string" | "image" | "video" | "file"
}
```

#### Custom Workflow Node (The Instance)
```typescript
{
  type: "custom-workflow",
  workflowId: string, // Reference to the definition
  version: string,    // Frozen version ID
  name: string,       // Copied for display
  inputs: Record<string, any> // Hardcoded values (if any)
}
```

### 3.2 Flow Schema Updates (`Flow`)
The Firestore `Flow` document will be extended to include publishing metadata:
```typescript
interface Flow {
  // ...existing fields
  isPublished: boolean;
  publishedVersion?: string; // semver
  interface?: {
    inputs: { id: string; name: string; type: string }[];
    outputs: { id: string; name: string; type: string }[];
  };
}
```

### 3.3 Execution Engine Upgrade (`lib/workflow-engine.ts`)
The engine currently executes a flat list of nodes. The upgrade adds a **Preprocessor Phase**:
1.  **Flattening**: Before execution, `WorkflowEngine` recursively resolves `custom-workflow` nodes.
2.  **Substitution**: Each `custom-workflow` node is replaced by its internal graph.
3.  **Rewiring**: External edges connected to the `custom-workflow` instance are reconnected to the internal `workflow-input` and `workflow-output` nodes of the sub-graph.
4.  **Cycle Detection**: Critical check during flattening to prevent infinite recursion.

### 3.4 Node Registry
We will register three new node types in `NodeRegistry` (`lib/node-registry.ts`):
- `WorkflowInput`: Configurable execution (passes data through).
- `WorkflowOutput`: Configurable execution (passes data through).
- `CustomWorkflow`: Placeholder type (execution logic acts as a pass-through or is flattened out).

---

## 4. Work Streams

1.  **Core Types & Schemas**: Update Zod schemas in `lib/schemas.ts` and types in `lib/types.ts`.
2.  **UI - Interface Nodes**: Create `WorkflowInputNode` and `WorkflowOutputNode` components.
3.  **Backend - Publishing**: Add `POST /api/flows/:id/publish` to handle validation and snapshotting.
4.  **Engine - Flattening**: Implement the graph flattening algorithm in `lib/workflow-engine.ts`.
5.  **UI - Discovery**: Update the Toolbox to verify available published workflows.

---

## 5. Questions / Risks
- **Cycle Detection**: Must be robust. A workflow cannot contain itself (directly or indirectly).
- **Versioning**: For MVP, we might treat every publish as a new immutable reference or strict version string.
- **Permissions**: Verify if `custom-workflow` nodes respect the permissions of the underlying flow (usually "read" access is implied by usage).
