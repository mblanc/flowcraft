# Version Control Strategy

This document outlines the implementation strategy for version control within FlowCraft, covering workflows (flows) and media assets.

## Core Requirements

1.  **Automatic Versioning**: Every save operation triggers a new version snapshot.
2.  **Concurrency Control**: Prevent overwriting concurrent changes from other users (Optimistic Locking).
3.  **Immutable References**: Flow versions refer to the specific asset versions that were active at the time of the flow's version creation.
4.  **Retention Policy**: Automatically maintain only the last 50 versions to manage storage costs and performance.

---

## 1. Flow Versioning Architecture

### Firestore Schema

Each flow document in the `flows` collection will act as the "latest/head" version and will be updated to support concurrency checks.

**Collection: `flows`**
```typescript
interface FlowDocument {
  id: string;
  name: string;
  userId: string;
  nodes: Node[];
  edges: Edge[];
  version: number;     // Incremented on every save
  updatedAt: Timestamp;
  // ... other fields
}
```

**Sub-collection: `flows/{flowId}/versions`**
Each version is a full capture of the state.

```typescript
interface FlowVersion {
  id: string;          // Auto-generated (or version number as string)
  nodes: Node[];       // Deep copy of nodes
  edges: Edge[];       // Deep copy of edges
  createdAt: Timestamp;
  createdBy: string;   // User ID
  versionNumber: number;
}
```

### Optimistic Locking Logic

To prevent "dirty writes":
1.  Client fetches flow (including current `version` number).
2.  On save, the client sends `expectedVersion`.
3.  The API performs a transaction:
    - If `doc.version === expectedVersion`:
        - Update `doc.nodes`, `doc.edges`.
        - Increment `doc.version`.
        - Create new record in `versions` sub-collection.
    - Else: Throw concurrency error (HTTP 409 Conflict).

---

## 2. Media Asset Management

To achieve "deep versioning," we move from raw GCS URIs to a logical Asset model.

### Asset Schema

**Collection: `assets`**
```typescript
interface Asset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'file';
  currentGcsUri: string;
  updatedAt: Timestamp;
}
```

**Sub-collection: `assets/{assetId}/versions`**
```typescript
interface AssetVersion {
  id: string;
  gcsUri: string;      // Immutable path in GCS
  createdAt: Timestamp;
}
```

### Usage in Flows
Nodes within a flow will now store an `assetVersionId` instead of just a raw URI.

```json
{
  "id": "node_1",
  "data": {
    "assetId": "asset_abc",
    "assetVersionId": "v1_xyz"
  }
}
```
When a flow is restored, it continues to point to `v1_xyz` even if the current version of "asset_abc" is `v5_pdq`.

---

## 3. Operations & Maintenance

### Automatic Retention Policy
A Cloud Function (or background job) will be triggered when a new version is added to a sub-collection.

**Logic**:
- Query versions ordered by `createdAt` descending.
- If `count > 50`:
    - Delete the oldest N versions.
    - *Note*: Asset versions should only be deleted if they are not referenced by any Flow version (requires reference counting or a "mark-and-sweep" logic if storage optimization is critical).

### UI Integration Points
- **Restore UI**: A "History" panel allowing users to browse and preview versions.
- **Diff View**: Highlight changed nodes between selected versions.
- **Concurrency Warning**: Modal showing "Your changes are out of sync. Please refresh or resolve conflicts."

---

## 4. Client-Side Undo/Redo

While Version Control (Section 1) handles long-term persistence and collaboration, Undo/Redo handles short-term, granular user mistakes during a single session.

### Proposed Architecture: Temporal State
We will use a **Stack-based approach** (Command Pattern or State Snapshots) within the React/Zustand store.

1.  **State Structure**:
    ```typescript
    interface TemporalState {
      past: FlowStateSnapshot[];    // Logic for Undo
      present: FlowStateSnapshot;   // Current state
      future: FlowStateSnapshot[];  // Logic for Redo
    }
    ```

2.  **Action Logic**:
    -   **Undo**: Pop from `past`, push `present` to `future`, set `present` to the popped value.
    -   **Redo**: Pop from `future`, push `present` to `past`, set `present` to the popped value.
    -   **New Action**: Push `present` to `past`, set `present` to new state, clear `future`.

### Granularity & Optimization
-   **Action Grouping**: Small actions (like dragging a node) should be "grouped" or only recorded on `onDragStop` to avoid bloating the history stack with thousands of tiny positional updates.
-   **Debounced Input**: Text changes in nodes should be recorded in the undo stack only after a short period of inactivity (e.g., 500ms) or on blur.
-   **Stack Limit**: Limit the client-side undo stack to ~100 actions to save memory.

### Integration with Version Control
-   **Saving**: When the user clicks "Save" (or auto-save triggers), the *current* `present` state is sent to the API to create a permanent **Version Snapshot**.
-   **Persistence**: The Undo/Redo stack is **transient** and is lost on page refresh. Version History (the permanent snapshots) is used to recover from older days or concurrent conflicts.
-   **Visual Hint**: The undo/redo buttons should visually reflect the "dirty" state (the unsaved changes since the last version snapshot).
