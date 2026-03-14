## 1. Monolithic UI Components Separation

Several core UI components have grown significantly in size and responsibility, making them harder to maintain and test.

### 1.1 `components/flow-canvas.tsx`
**Current State:** ~1200 lines. Handles ReactFlow rendering, drag-and-drop, keyboard shortcuts, context menus, and node additions.
**Recommendation:** 
- Extract drag-and-drop logic into a custom hook (e.g., `useFlowDragDrop`).
- Extract keyboard shortcut handling into a custom hook (e.g., `useFlowShortcuts`).
- Move the Context Menu into its own dedicated component file (`components/flow-context-menu.tsx`).

### 1.2 `components/config-panel.tsx`
**Current State:** ~1200 lines. Contains a massive switch statement and hardcoded model configurations (like `IMAGE_MODEL_CONFIGS`) duplicated from node components.
**Recommendation:**
- Split into smaller, node-specific configuration components (e.g., `LLMConfigPanel.tsx`, `ImageConfigPanel.tsx`).
- Move these into a dedicated folder `components/config-panels/`.
- Centralize `IMAGE_MODEL_CONFIGS` and similar constants into `lib/constants.ts` or a dedicated `lib/model-configs.ts` to remove duplication between `image-node.tsx` and `config-panel.tsx`.

## 2. Core Logic Refactoring (The Registry & Executors)

The core execution and definition logic is currently centralized in a few large files, violating the Open/Closed Principle.

### 2.1 `lib/node-registry.ts` and `lib/executors.ts`
**Current State:** `node-registry.ts` (~800 lines) defines the API, gathering logic, and registration for every single node type. `executors.ts` (~400 lines) contains the specific API calls.
**Recommendation:**
- Implement a **Feature-Based Module Structure** for nodes. Create a `lib/nodes/` directory.
- For each node type, create a dedicated file (e.g., `lib/nodes/llm-node.ts`) that exports its `NodeDefinition`, `gatherInputs` logic, and `execute` API call.
- `node-registry.ts` should simply import these definitions and register them.

## 3. Node UI Component Standardization

**Current State:** Node components (`llm-node.tsx`, `image-node.tsx`, etc.) are large (20KB - 30KB) and duplicate logic for resizing, headers, and status indicators.
**Recommendation:**
- **Create a `<BaseNode>` component:** Handle common shell logic: resizing, selection states, standard headers with settings/execute icons, and status indicators (glow border, progress text).
- Individual nodes should only render their specific content (previews, inputs) as children of `<BaseNode>`.

## 4. State Management (Zustand)

**Current State:** `lib/store/use-flow-store.ts` mixes workflow data (nodes/edges) with UI transient state.
**Recommendation:**
- **Store Slices:** Separate workflow state from UI state (sidebar openness, active tabs) to minimize re-renders on the flow canvas when purely UI states change.

## 5. Security and Authentication

**Current State:** Route protection is handled via `withAuth` wrapper in API routes and `authorized` callback in `auth.ts`, but lacks global middleware protection.
**Recommendation:**
- **Global Middleware:** Implement a root `middleware.ts` using NextAuth to handle route protection consistently across pages and APIs.
- **Security Headers:** Add `Content-Security-Policy` and other security headers in `next.config.ts` or via middleware to mitigate XSS and clickjacking risks.

## 6. Folder Structure & Performance

- **Hierarchy:** Organize `components/` into `nodes/`, `flow/`, `panels/`, and `ui/`.
- **Throttling:** Implement `IntersectionObserver` in preview-heavy nodes to pause rendering or use low-res placeholders when nodes are off-screen.
- **Virtualization:** Ensure `highlightedEdges` calculation doesn't depend on the entire `nodes` array to keep dragging performance high.

