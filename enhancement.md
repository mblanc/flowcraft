# FlowCraft Enhancement Recommendations

Based on a review of the codebase, here are several recommended enhancements to improve the robustness, maintainability, and user experience of FlowCraft.

## 1. Backend & API Improvements

### 🛡️ Request Validation
Currently, API routes (e.g., `app/api/generate-text/route.ts`) manually destructure the request body without validation.
- **Recommendation**: Use `zod` (already in `package.json`) to validate API request bodies.
- **Benefit**: Prevents runtime errors from malformed requests and provides clear error messages to the client.

### 🧩 Dynamic MIME Type Handling
In `app/api/generate-text/route.ts`, `gs://` URIs are hardcoded to `application/pdf`.
- **Recommendation**: Determine MIME type dynamically based on file extension or metadata for `gs://` URIs.
- **Benefit**: Supports more file types (images, videos) from Google Cloud Storage.

### 🚦 Rate Limiting & Quota Management
There is no visible rate limiting.
- **Recommendation**: Implement rate limiting (e.g., using `upstash/ratelimit` or similar) to prevent abuse of the Vertex AI quota.

## 2. Workflow Engine Enhancements

### 🔄 Robust Error Handling
The `WorkflowEngine` catches errors but only logs them.
- **Recommendation**:
    - Update node state to `error` status when execution fails.
    - Add an `errorMessage` field to `NodeData` to display specific errors on the node UI.
    - Allow "Retry" for specific failed nodes without re-running the whole flow.

### 🧹 Code Refactoring
`gatherInputs` in `lib/workflow-engine.ts` contains repetitive logic for each node type.
- **Recommendation**: Refactor input gathering into a strategy pattern or configuration-based approach to make adding new node types easier.
- **Benefit**: Reduces code duplication and improves maintainability.

### 🛑 Cancellation Support
There is no way to stop a running workflow.
- **Recommendation**: Pass an `AbortSignal` to executors and the `WorkflowEngine` to allow users to cancel long-running generations.

## 3. State Management & Persistence

### 💾 Auto-Save
Auto-save logic is currently commented out in `FlowProvider`.
- **Recommendation**: Re-enable auto-save with a debounce (e.g., 1-2 seconds) to prevent data loss.
- **Implementation**: Use a custom hook `useDebounce` or a library like `use-debounce` to trigger saves efficiently.

### 🗂️ History / Undo-Redo
- **Recommendation**: Implement undo/redo functionality for canvas operations (moving nodes, connecting edges).
- **Benefit**: Greatly improves the editing experience.

## 4. UI/UX Improvements

### 🎨 Theming & Consistency
Button colors in `FlowCanvas` are hardcoded (e.g., `bg-purple-500`).
- **Recommendation**: Move these colors to `tailwind.config.ts` or a theme constant file to ensure consistency and support dark/light mode better.

### ♿ Accessibility
- **Recommendation**: Ensure all interactive elements (nodes, handles, buttons) have proper `aria-labels` and keyboard navigation support.

## 5. Testing

### 🧪 Unit Tests
- **Recommendation**: Add unit tests for `WorkflowEngine` to verify dependency resolution and execution order.
- **Benefit**: Ensures core logic is correct and prevents regressions when modifying the engine.
