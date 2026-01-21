# Implementation Plan - Workflow Composability (Sub-Graphs)

This plan outlines the steps to implement modular, nestable workflows in FlowCraft, allowing workflows to be published as reusable nodes.

## Phase 1: Foundation (IO Nodes & Data Models)
- [x] Task: Define Firestore Schema updates for versioning and interface contracts. 203ef60
- [x] Task: Implement `Workflow Input` node component and registry entry. c1ed01e
- [x] Task: Implement `Workflow Output` node component and registry entry. c1ed01e
- [x] Task: Implement Type Compatibility utility for strict port validation. 7563c74
- [x] Task: Integrate strict connection validation into `FlowCanvas` UI. 12bc2ad
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Foundation' (Protocol in workflow.md)

## Phase 2: Publishing Logic [checkpoint: d825204]
- [x] Task: Implement DAG Cycle Detection utility for graph validation. 43fcdf1
- [x] Task: Implement Recursive Circular Dependency Detection (detecting cycles across nested sub-graphs). 3583b55
- [x] Task: Create Publish API route (`/api/flows/[id]/publish`) to handle snapshotting and validation. 6ec02a1
- [x] Task: Build Publish Modal UI to capture metadata and trigger publishing. bfbc848
- [x] Task: Conductor - User Manual Verification 'Phase 2: Publishing Logic' (Protocol in workflow.md)

## Phase 3: Consumption & Gallery [checkpoint: a92f3af]
- [x] Task: Implement `Custom Workflow` node with dynamic port generation based on sub-graph interface. 853f142
- [x] Task: Build Workflow Gallery UI (browsing published workflows). 0eb545a
- [x] Task: Implement Gallery Listing API with filters (Mine vs. Public). 0eb545a
- [x] Task: Integrate "Add to Editor" functionality from the Gallery. 0eb545a
- [x] Task: Conductor - User Manual Verification 'Phase 3: Consumption & Gallery' (Protocol in workflow.md)

## Phase 4: Versioning & Execution
- [x] Task: Update `WorkflowEngine` to support Recursive Execution of sub-graph nodes. 4dda77d
- [x] Task: Implement Version History API and basic UI for viewing versions. bbe5bf0
- [ ] Task: Implement Version Upgrade logic (remapping connections when a newer version is selected).
- [ ] Task: Implement breaking change detection and UI warnings during upgrades.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Versioning & Execution' (Protocol in workflow.md)
