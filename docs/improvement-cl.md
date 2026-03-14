# FlowCraft Codebase Improvement Analysis

> **Generated:** 2026-03-13
> **Scope:** Full codebase analysis focusing on best practices, readability, maintainability, performance, deduplication, simplification, standardization, and separation of concerns.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Issues](#critical-issues)
3. [Code Duplication](#code-duplication)
4. [Type Safety Issues](#type-safety-issues)
5. [State Management](#state-management)
6. [Component Architecture](#component-architecture)
7. [Performance Concerns](#performance-concerns)
8. [Error Handling](#error-handling)
9. [Styling & CSS](#styling--css)
10. [Testing & Quality](#testing--quality)
11. [Accessibility](#accessibility)
12. [Recommended Refactoring Plan](#recommended-refactoring-plan)

---

## Executive Summary

FlowCraft is a well-structured Next.js application with a React Flow-based visual workflow editor. The codebase uses modern patterns (Zustand, Zod, Tailwind CSS) and has solid foundations. However, several areas need attention:

| Category         | Severity     | Impact                                                                 |
| ---------------- | ------------ | ---------------------------------------------------------------------- |
| Code Duplication | **CRITICAL** | 800+ lines of duplicate resize/sync logic across 9+ nodes              |
| Type Safety      | **HIGH**     | Excessive `as unknown as T` casts, loose `z.any()` in schemas          |
| State Management | **HIGH**     | Duplicate state tracking, O(n) mutations, missing normalization        |
| Component Size   | **HIGH**     | Several components exceed 600 lines with mixed concerns                |
| Testing Coverage | **HIGH**     | Only 3 of 27+ components tested, no hook tests                         |
| Error Handling   | **MEDIUM**   | Inconsistent patterns, silent failures, no user feedback               |
| Performance      | **MEDIUM**   | Missing memoization, inefficient selectors, repeated regex compilation |
| Accessibility    | **MEDIUM**   | Missing ARIA labels, small font sizes, focus indicator gaps            |

---

## Critical Issues

### 1. Massive Code Duplication in Node Components

**Severity:** CRITICAL
**Impact:** ~800+ lines of duplicated code

Every node component (9+) implements nearly identical patterns:

```
Affected Files:
- components/file-node.tsx
- components/text-node.tsx
- components/image-node.tsx (675 lines)
- components/video-node.tsx (590 lines)
- components/llm-node.tsx (604 lines)
- components/upscale-node.tsx
- components/resize-node.tsx
- components/list-node.tsx
- components/custom-workflow-node.tsx (490 lines)
```

**Duplicated Patterns:**

| Pattern                                  | Lines per Node | Total Waste |
| ---------------------------------------- | -------------- | ----------- |
| Resize logic (state + handlers + effect) | ~50 lines      | ~450 lines  |
| Dimension sync (prevData pattern)        | ~20 lines      | ~180 lines  |
| Signed URL fetching                      | ~25 lines      | ~125 lines  |
| Local state sync                         | ~15 lines      | ~135 lines  |

**Solution:** Extract to custom hooks:

- `useNodeResize(id, defaultWidth, defaultHeight)`
- `useSignedUrl(gcsUri)`
- `useDimensionSync(dataWidth, dataHeight, defaults)`
- `useSyncedState(dataValue, updateFn)`

---

### 2. Large Components Violating Single Responsibility

**Severity:** HIGH

| Component         | Lines | Responsibilities                                                      |
| ----------------- | ----- | --------------------------------------------------------------------- |
| `flow-canvas.tsx` | 1234  | Canvas, nodes, edges, modals, keyboard, copy/paste, context menu      |
| `image-node.tsx`  | 675   | Display, settings (3 dropdowns), batch, async URLs, resize, execution |
| `llm-node.tsx`    | 604   | Instructions, output, model, view modes, resize, execution            |
| `video-node.tsx`  | 590   | Similar to image-node                                                 |

**Recommendation:** Break into smaller, focused components:

- `<NodeHeader>`, `<NodeSettings>`, `<NodeDisplay>`, `<NodeResizeHandle>`
- Extract modal state management to context/hooks
- Separate execution controls into dedicated component

---

### 3. Type System Fragmentation

**Severity:** HIGH

**Duplicate type definitions:**

- `/lib/types.ts` exports types imported from `/lib/schemas.ts`
- Both files export `LLMData`, `TextData`, `ImageData`, etc.
- Creates confusion about canonical source

**Loose typing:**

```typescript
// lib/firestore.ts - Lines 25-26, 46-47
nodes: unknown[];  // Should be Node<NodeData>[]
edges: unknown[];  // Should be Edge[]

// lib/schemas.ts - Lines 141, 165
portDefaultValue: z.any().optional();  // No validation
results: z.record(z.string(), z.record(z.string(), z.any())).optional();
```

**Excessive casting (8+ instances):**

```typescript
// lib/node-registry.ts
const llm = unwrappedData as unknown as LLMData; // Bypasses type checker
```

---

## Code Duplication

### A. Resize Logic (CRITICAL)

**Location:** All node components
**Pattern:**

```typescript
// Duplicated in 9+ files
const [dimensions, setDimensions] = useState({ width, height });
const [isResizing, setIsResizing] = useState(false);
const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

const handleResizeStart = (e: React.MouseEvent) => {
    /* ... */
};

useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
        /* ... */
    };
    const handleMouseUp = () => {
        /* ... */
    };
    // Event listeners...
}, [isResizing, id, updateNodeData, dimensions]);
```

**Fix:** Create `hooks/use-node-resize.ts`

### B. Signed URL Fetching

**Location:** `file-node.tsx`, `image-node.tsx`, `video-node.tsx`, `upscale-node.tsx`, `resize-node.tsx`
**Pattern:**

```typescript
useEffect(() => {
    if (data.gcsUri?.startsWith("gs://")) {
        fetch(`/api/signed-url?gcsUri=${encodeURIComponent(data.gcsUri)}`)
            .then((res) => res.json())
            .then((result) => setSignedUrl(result.signedUrl))
            .catch((error) => logger.error("Error:", error));
    }
}, [data.gcsUri]);
```

**Fix:** Create `hooks/use-signed-url.ts`

### C. GCS URI Parsing

**Location:** `lib/storage.ts` (multiple functions)
**Pattern:**

```typescript
// Repeated in gcsUriToSharp, gcsUriToBase64, getMimeTypeFromGCS, uploadImage
const match = gcsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/);
```

**Fix:** Create utility `parseGcsUri(uri: string): { bucket: string; path: string } | null`

### D. Permission Checks

**Location:** `flow-canvas.tsx`, `header.tsx`, flow page
**Pattern:**

```typescript
// Duplicated 3 times
const isOwner = !!session?.user?.id && !!ownerId && session.user.id === ownerId;
const isEditor =
    !!session?.user?.email &&
    sharedWith?.some(
        (s) => s.email === session.user?.email && s.role === "edit",
    );
const isEditable = isOwner || isEditor;
```

**Fix:** Create Zustand selector or hook `useFlowPermissions()`

---

## Type Safety Issues

### A. Schema Weaknesses

| File           | Line  | Issue                              |
| -------------- | ----- | ---------------------------------- |
| `schemas.ts`   | 141   | `z.any()` for `portDefaultValue`   |
| `schemas.ts`   | 165   | `z.any()` nested in results record |
| `firestore.ts` | 25-26 | `unknown[]` for nodes/edges        |
| `firestore.ts` | 46-47 | `unknown[]` for custom nodes       |

### B. Unsafe Casting Patterns

```typescript
// node-registry.ts - Multiple instances
const llm = unwrappedData as unknown as LLMData;
const vid = unwrappedData as unknown as VideoData;

// gemini.service.ts - Line 226-228
const base64Data = image.url.split(",")[1];  // No validation
const mimeType = image.url.split(";")[0].split(":")[1];  // Fragile

// flow.service.ts - Line 30
} as Record<string, unknown>;  // Loses type info
```

### C. Recommendations

1. **Replace `z.any()` with specific types** in schemas
2. **Add type guards** instead of `as unknown as T`:
    ```typescript
    function isLLMData(data: unknown): data is LLMData {
        return (
            typeof data === "object" &&
            data !== null &&
            (data as any).type === "llm"
        );
    }
    ```
3. **Type Firestore documents** with proper schemas:
    ```typescript
    nodes: z.array(NodeDataSchema);
    edges: z.array(EdgeSchema);
    ```
4. **Consolidate type exports** - single source of truth in `schemas.ts`

---

## State Management

### A. Store Structure Issues

**File:** `lib/store/use-flow-store.ts`

1. **Monolithic store** - All state in one store with no slices
2. **Mixed concerns** - Graph data, metadata, permissions, UI state together
3. **No persistence middleware** - State lost on refresh

### B. Duplicate State Tracking

```typescript
// Selection stored twice
selectedNode: Node<NodeData> | null;  // Global
node.selected: boolean;                // Per node

// Requires O(n) sync
selectNode: (nodeId) => {
  const updatedNodes = nodes.map((node) => ({
    ...node,
    selected: node.id === nodeId  // Rebuilds entire array
  }));
  set({ nodes: updatedNodes, selectedNode: node || null });
}
```

**Local state duplication in every node:**

```typescript
// 6+ useState calls per node
const [localValue, setLocalValue] = useState(data.value);
const [prevDataValue, setPrevDataValue] = useState(data.value);
const [dimensions, setDimensions] = useState({ width, height });
const [prevDataWidth, setPrevDataWidth] = useState(data.width);
const [prevDataHeight, setPrevDataHeight] = useState(data.height);
```

### C. Inefficient Mutations

```typescript
// O(n) for every node update
updateNodeData(nodeId, data) {
  const updatedNodes = nodes.map(n =>
    n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
  );
  set({ nodes: updatedNodes });
}
```

For 100+ nodes, this causes performance issues.

### D. Recommendations

1. **Normalize state** - Use ID maps instead of arrays
    ```typescript
    nodes: Record<string, Node<NodeData>>;
    nodeOrder: string[];
    ```
2. **Remove duplicate selection tracking** - Use only `selectedNodeId: string | null`
3. **Add persistence middleware** - Use Zustand's `persist` plugin
4. **Extract computed state** to dedicated selectors file
5. **Split store by domain** - Graph, UI, sharing concerns

---

## Component Architecture

### A. Components Exceeding 500 Lines

| Component                  | Lines | Primary Issues                                 |
| -------------------------- | ----- | ---------------------------------------------- |
| `flow-canvas.tsx`          | 1234  | Should be 5+ components                        |
| `image-node.tsx`           | 675   | Settings, display, batch should be separate    |
| `llm-node.tsx`             | 604   | Instructions, output, modal should be separate |
| `video-node.tsx`           | 590   | Similar to image-node                          |
| `custom-workflow-node.tsx` | 490   | Interface loading, port generation mixed       |

### B. Suggested Decomposition

**Node Components:**

```
<BaseNode>
  <NodeHeader icon={} title={} onSettings={} onExecute={} />
  <NodeContent>
    {/* Node-specific content */}
  </NodeContent>
  <NodeResizeHandle />
  <NodeHandles inputs={} outputs={} />
</BaseNode>
```

**Flow Canvas:**

```
<FlowCanvas>
  <FlowProvider>
    <ReactFlowWrapper />
    <FlowContextMenu />
    <FlowModals />
    <FlowKeyboardHandler />
  </FlowProvider>
</FlowCanvas>
```

---

## Performance Concerns

### A. Missing Memoization

**All node components** have unmemoized callback functions:

```typescript
// Recreated every render
const handleResizeStart = (e: React.MouseEvent) => {
    /* ... */
};
const handleFileChange = async (e: ChangeEvent) => {
    /* ... */
};
```

**Fix:** Wrap in `useCallback`:

```typescript
const handleResizeStart = useCallback((e: React.MouseEvent) => {
    // ...
}, []);
```

### B. Inefficient Effect Dependencies

```typescript
// Causes effect re-run on dimension change even when not resizing
useEffect(() => {
    if (!isResizing) return;
    // ...
}, [isResizing, id, updateNodeData, dimensions.width, dimensions.height]);
```

### C. Selector Performance

```typescript
// Creates new object reference every render
const nodeDataMap = useFlowStore(
    useShallow((state) => {
        const map = {};
        state.nodes.forEach((n) => {
            map[n.id] = n.data;
        });
        return map; // New object every time
    }),
);
```

### D. Repeated Regex Compilation

```typescript
// gemini.service.ts - Compiled every call
const base64Match = file.url.match(/^data:([^;]+);base64,(.+)$/);

// Should be module-level constant
const DATA_URI_REGEX = /^data:([^;]+);base64,(.+)$/;
```

---

## Error Handling

### A. Inconsistent Patterns

| Location                   | Pattern          | Issue                    |
| -------------------------- | ---------------- | ------------------------ |
| `file-node.tsx`            | `alert()`        | Browser alert for errors |
| `image-node.tsx`           | `logger.error()` | No user feedback         |
| `custom-workflow-node.tsx` | `toast.error()`  | Proper toast             |
| `storage.ts`               | `return null`    | Silent failure           |

### B. Silent Failures

```typescript
// storage.ts - Caller doesn't know why it failed
export async function uploadImage(...): Promise<string | null> {
  if (!storageUri) {
    logger.error("GCS_STORAGE_URI not set");
    return null;  // Silent failure
  }
}

// custom-workflow-node.tsx - Error logged but not shown
catch (error) {
  logger.error("Error fetching signed URL:", error);
}
```

### C. Recommendations

1. **Standardize on toast notifications** for user-facing errors
2. **Use Result type** or throw explicit errors instead of returning null
3. **Add error boundaries** for React components
4. **Include context in error messages**:
    ```typescript
    logger.error(
        `Error executing node "${node.data.name}" (${nodeId}):`,
        error,
    );
    ```

---

## Styling & CSS

### A. Duplicated Node Styles

**Pattern repeated in 9+ components:**

```tsx
className={`bg-card relative rounded-lg border-2 p-4 shadow-lg transition-all ${
  selected ? "border-primary shadow-primary/20" : "border-border"
}`}
```

**Fix:** Create shared `nodeContainerStyles` or CSS class

### B. Hard-coded Colors

```css
/* Should use CSS variables */
port-string: #a855f7; /* purple-500 */
port-image: #f97316; /* orange-500 */
port-video: #ec4899; /* pink-500 */
```

### C. Specificity Issues

```css
/* globals.css - Excessive !important */
.react-flow__node { background: transparent !important; }
.react-flow__handle { ... !important; }
.react-flow__controls { background: var(--card) !important; }
```

### D. Recommendations

1. **Extract common node styles** to utility classes
2. **Move port colors** to CSS custom properties
3. **Reduce React Flow overrides** by using proper theming API
4. **Add responsive breakpoints** for mobile support

---

## Testing & Quality

### A. Current Coverage

| Category   | Files | Tested | Coverage |
| ---------- | ----- | ------ | -------- |
| Components | 27+   | 3      | 11%      |
| Hooks      | 3     | 0      | 0%       |
| Services   | 5     | 2      | 40%      |
| Utilities  | 10+   | 4      | 40%      |
| API Routes | 12    | 0      | 0%       |

### B. Missing Test Coverage

**Critical gaps:**

- `flow-canvas.tsx` - Core editor untested
- `use-flow-execution.ts` - Workflow execution untested
- `use-flow-persistence.ts` - Save/load untested
- All node components except LLM
- All API route handlers
- `StorageService`, `CustomNodeService`

### C. Missing Infrastructure

| Tool               | Status         |
| ------------------ | -------------- |
| Husky (pre-commit) | NOT INSTALLED  |
| Lint-staged        | NOT INSTALLED  |
| GitHub Actions     | NOT CONFIGURED |

### D. Recommendations

1. **Install Husky + lint-staged** for pre-commit hooks
2. **Add GitHub Actions** workflow:
    - Run tests on PR
    - Enforce coverage thresholds (currently set to 70%)
    - Run ESLint
3. **Prioritize component tests** for critical UI
4. **Add hook tests** for execution and persistence
5. **API route testing** with supertest or similar

---

## Accessibility

### A. Missing ARIA Labels

```tsx
// Buttons without accessible names
<button onClick={handleUploadClick}>
    <FileUp className="h-3 w-3" />
    {signedUrl ? "Change File" : "Upload File"}
</button>
// Should have: aria-label="Upload or change file"
```

### B. Small Font Sizes

```tsx
// May fail WCAG AA
className = "text-[10px]";
className = "text-[9px]";
```

### C. Missing Keyboard Support

- Resize handles not keyboard accessible
- No visible focus indicators on node containers
- Complex drag-drop interactions not documented

### D. Recommendations

1. **Add `aria-label`** to all icon-only buttons
2. **Increase minimum font size** to 12px
3. **Add `tabIndex`** and keyboard handlers to resize handles
4. **Implement focus-visible** styles on interactive elements

---

## Recommended Refactoring Plan

### Phase 1: Critical (1-2 weeks)

1. **Extract custom hooks:**
    - `useNodeResize`
    - `useSignedUrl`
    - `useDimensionSync`
    - `useSyncedState`

2. **Fix type safety:**
    - Replace `z.any()` in schemas
    - Type Firestore documents properly
    - Remove `as unknown as T` casts with type guards

3. **Setup quality gates:**
    - Install Husky + lint-staged
    - Add GitHub Actions CI workflow

### Phase 2: High Priority (2-3 weeks)

4. **Decompose large components:**
    - Split `flow-canvas.tsx` into focused components
    - Extract node sub-components (Header, Settings, Display)

5. **Normalize state:**
    - Convert nodes/edges arrays to ID maps
    - Remove duplicate selection tracking
    - Add persistence middleware

6. **Standardize error handling:**
    - Create error handling utilities
    - Implement toast notifications consistently
    - Add error boundaries

### Phase 3: Medium Priority (2-3 weeks)

7. **Performance optimization:**
    - Add `useCallback` to event handlers
    - Optimize selectors with proper memoization
    - Move regex patterns to module level

8. **Testing expansion:**
    - Add component tests (target 60%+ coverage)
    - Test custom hooks
    - Add API route tests

9. **Styling consolidation:**
    - Create shared node style utilities
    - Move colors to CSS variables
    - Add responsive breakpoints

### Phase 4: Polish (1-2 weeks)

10. **Accessibility improvements:**
    - Add ARIA labels
    - Implement keyboard navigation
    - Increase font sizes

11. **Documentation:**
    - Component API documentation
    - State management guide
    - Testing guidelines

---

## Files Requiring Immediate Attention

| File                          | Lines | Priority | Primary Issues                  |
| ----------------------------- | ----- | -------- | ------------------------------- |
| `lib/schemas.ts`              | 411   | CRITICAL | `z.any()` usage                 |
| `lib/firestore.ts`            | 91    | CRITICAL | `unknown[]` types               |
| `lib/node-registry.ts`        | 570+  | HIGH     | Unsafe casts, complex functions |
| `components/flow-canvas.tsx`  | 1234  | HIGH     | Too large, mixed concerns       |
| `components/image-node.tsx`   | 675   | HIGH     | Duplication, size               |
| `components/llm-node.tsx`     | 604   | HIGH     | Duplication, size               |
| `lib/workflow-engine.ts`      | 569   | MEDIUM   | Complex functions               |
| `lib/store/use-flow-store.ts` | 300+  | MEDIUM   | State structure                 |

---

## Conclusion

FlowCraft has solid foundations but has accumulated technical debt primarily in:

1. **Code duplication** across node components
2. **Type safety gaps** allowing runtime errors
3. **State management complexity** causing performance issues
4. **Missing test coverage** risking regressions

Addressing these issues in the recommended phases will significantly improve maintainability, performance, and developer experience while reducing the risk of bugs in production.
