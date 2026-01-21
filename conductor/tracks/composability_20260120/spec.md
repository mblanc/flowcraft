# Track Specification: Workflow Composability (Sub-Graphs)

## Overview
Enable users to create, publish, and reuse workflows as nested nodes (Sub-Graphs). This transforms workflows into modular components, allowing for infinite nesting and "Workflow as a Function" abstractions (`Output = Workflow(Input)`).

## Functional Requirements

### 1. Interface Definition (IO Nodes)
- **Workflow Input Node:**
    - A new node type (`workflow-input`) that defines an entry point for data into a workflow.
    - Properties: `name` (unique handle), `type` (string, image, video, json), `required` (boolean), `defaultValue`.
    - Output: One port that provides data to internal nodes.
- **Workflow Output Node:**
    - A new node type (`workflow-output`) that defines an exit point for data.
    - Properties: `name` (unique handle), `type` (string, image, video, json).
    - Input: One port that receives data from internal nodes.

### 2. Publishing & Versioning
- **Publish Action:** A mechanism to snapshot a workflow as an immutable version (e.g., `1.0.0`).
- **Validation:** Publish is only allowed if:
    - The graph is a DAG (no cycles).
    - At least one Input and one Output node are defined.
    - All connections match the strict type compatibility matrix.
- **Metadata:** Store version history, visibility (private/public), and changelogs in Firestore.

### 3. Consumption (Custom Workflow Node)
- **Sub-Graph Node:** A node type (`custom-workflow`) that represents a published workflow.
- **Dynamic Interface:** The node's input and output ports are dynamically generated based on the `workflow-input` and `workflow-output` nodes defined in the sub-workflow's source graph.
- **Gallery:** A UI to browse and add published workflows to the canvas.

### 4. Execution Engine
- **Recursive Execution:** The `WorkflowEngine` will handle `custom-workflow` nodes by instantiating a nested `WorkflowEngine` instance.
- **Data Passing:** Inputs from the parent node are mapped to the sub-graph's input nodes; results from the sub-graph's output nodes are mapped back to the parent node's outputs.

## Non-Functional Requirements
- **Strict Typing:** Connections are strictly validated in the UI. Incompatible types (e.g., `image` -> `string`) are rejected with visual feedback.
- **Immutability:** Once a version is published, its graph cannot be modified. Updates require a new semantic version.

## Acceptance Criteria
- [ ] User can add `Workflow Input` and `Workflow Output` nodes to a graph.
- [ ] User can publish a workflow, creating an immutable version entry in Firestore.
- [ ] User can drag a published workflow from a "Gallery" into a new graph.
- [ ] The `custom-workflow` node correctly displays ports matching the sub-graph's interface.
- [ ] Executing a workflow containing sub-graphs successfully resolves and produces data.
- [ ] Circular dependencies (A contains B, B contains A) are detected and blocked.

## Out of Scope
- Global graph "flattening" or cross-graph optimization (using recursive execution for now).
- Real-time collaborative editing of sub-graphs.
