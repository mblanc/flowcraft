# FlowCraft Improvement Recommendations

This document consolidates and deduplicates all findings, improvements, and refactoring plans from previous analyses, ordered by severity and impact. 

---

## 1. CRITICAL: Code Duplication in Node Components
*References: `docs/improvement-cl.md` (1, 3.A, 3.B, 3.D), `docs/improvement-an.md` (3)*

**Issue:** Massive code duplication (~800+ lines) exists across 9+ node components (`image-node.tsx`, `video-node.tsx`, `llm-node.tsx`, etc.). Logic for resizing, dimension synchronization, state tracking, and signed URL fetching is repeated identically.

**Required Actions:**
- **Shared `<BaseNode>` Component:** Handle common shell logic: resizing, selection states, standard headers with settings/execute icons, and status indicators (glow border, progress text). Individual nodes should only render specific content as children.
- **Extract Custom Hooks:**
  - `useNodeResize(id, defaultWidth, defaultHeight)`
  - `useSignedUrl(gcsUri)`
  - `useDimensionSync(dataWidth, dataHeight, defaults)`
  - `useSyncedState(dataValue, updateFn)`

## 2. HIGH: Component Architecture (God Components)
*References: `docs/improvement-cl.md` (2, 6.A, 6.B), `docs/improvement-an.md` (1.1, 1.2), `docs/improvement-gc.md` (1.1)*

**Issue:** Several core UI components break the Single Responsibility pattern, notably `FlowCanvas` (~1200 lines) and individual nodes/config panels.

**Required Actions:**
- **Decompose `FlowCanvas`:** Split into smaller focused components like `FlowContextMenu`, `FlowControls`, `FlowDnDHandler`, and `NodeConnectionDropdown`. Extract complex handlers into hooks like `useFlowDragDrop` and `useFlowShortcuts`.
- **Decompose Node Components:** Extract inner features: `<NodeHeader>`, `<NodeSettings>`, `<NodeDisplay>`, and `<NodeResizeHandle>`.
- **Split Configuration Panels:** Break the massive `config-panel.tsx` into node-specific modules (e.g., `LLMConfigPanel.tsx`, `ImageConfigPanel.tsx`) inside a `components/config-panels/` directory.

## 3. HIGH: Architecture & Core Logic Refactoring
*References: `docs/improvement-an.md` (2.1), `docs/improvement-gc.md` (1.2, 1.3)*

**Issue:** Business logic execution and input gathering are centralized in `node-registry.ts` and `executors.ts`, violating the Open/Closed Principle.

**Required Actions:**
- **Feature-Based Module Structure:** Create a `lib/nodes/` directory. Each node (e.g., `llm-node.ts`) should export its own `NodeDefinition`, input gathering, and execution logic. `node-registry.ts` should only collect and register these.
- **InputGatherer Service:** Refactor input gathering to use polymorphism/strategies instead of large `switch`/`if-else` blocks in the registry.
- **Centralize execution:** Create an `executeNodeApiCall` utility for standardized API fetching across nodes.

## 4. HIGH: Type Safety Issues
*References: `docs/improvement-cl.md` (4.A, 4.B, 4.C), `docs/improvement-gc.md` (2.1)*

**Issue:** Excessive use of loose types (`z.any()`, `unknown[]`) and dangerous assertions (`as unknown as T`) that defeat TypeScript compile-time guarantees.

**Required Actions:**
- **Refine Zod Schemas:** Remove `z.any()` in `schemas.ts`, providing explicit type validations.
- **Firestore Typing:** Strictly validate nodes and edges schemas (`nodes: z.array(NodeDataSchema)`) instead of using `unknown[]`.
- **Type Guards:** Replace `as unknown as Type` with validated runtime type guards (e.g., `isLLMData(data)`).
- **Consolidate Exports:** Unify duplicate type definitions between `lib/types.ts` and `lib/schemas.ts`.

## 5. HIGH: State Management Issues (Zustand)
*References: `docs/improvement-cl.md` (5.A, 5.B, 5.C, 5.D), `docs/improvement-an.md` (4)*

**Issue:** Monolithic global store (`use-flow-store`) mixes UI view states with graph data, recalculates expensive operations O(n), and duplicates tracking (e.g., `selectedNode` vs `node.selected`).

**Required Actions:**
- **Slices & Normalization:** Use entity ID maps (`Record<string, Node>`) instead of massive arrays to improve state mutation performance. 
- **Domain Separation:** Separate workflow graph states from pure UI transient states (modals, active tabs, sidebar view).
- **Cleanup State Duplication:** Eliminate repeated local state tracking in nodes and persist essential graph states using Zustand's `persist` middleware.

## 6. HIGH: Testing & CI Quality
*References: `docs/improvement-cl.md` (10.A, 10.B, 10.C, 10.D), `docs/improvement-gc.md` (4.1)*

**Issue:** Extremely low component test coverage (11%), untested core API routes, missing Git hooks for code validation, and a lack of CI integration.

**Required Actions:**
- **Expand Test Suites:** Add component tests targeting >60% coverage, specifically ensuring Flow execution logic, persistence, and APIs are mocked and tested.
- **Integration Tests:** Implement multi-node workflows tests (mocking Gemini API responses and batch behavior) in `__tests__/`.
- **CI / CD Pipeline:** Introduce Husky, `lint-staged` pre-commit hooks, and GitHub actions to prevent broken code additions.

## 7. HIGH / MEDIUM: Security & Authentication
*References: `docs/improvement-an.md` (5)*

**Issue:** Route protection relies solely on inner API wrappers instead of high-level middleware.

**Required Actions:**
- **Global Middleware:** Apply comprehensive `middleware.ts` NextAuth protections across standard routes and APIs.
- **Security Headers:** Enforce `Content-Security-Policy` against XSS vectors via `next.config.ts` or edge middleware.

## 8. MEDIUM: Performance & Re-renders
*References: `docs/improvement-cl.md` (7.A, 7.B, 7.C, 7.D), `docs/improvement-gc.md` (3.1), `docs/improvement-an.md` (6)*

**Issue:** Unnecessary canvas re-renders, recalculation of heavy selectors, and static regex patterns recomputed every call.

**Required Actions:**
- **Memoization:** Wrap canvas event handlers with `useCallback` and extract memoized values logically.
- **Throttling & Virtualization:** Optimize `highlightedEdges` to stop rebuilding on whole `nodes` array refreshes. Use `IntersectionObserver` to pause complex preview nodes when outside viewport sight.
- **Regex Caching:** Define repetitive matches (like `DATA_URI_REGEX`) at module scopes rather than inside functional loops.

## 9. MEDIUM: Error Handling Deficiencies
*References: `docs/improvement-cl.md` (8.A, 8.B, 8.C), `docs/improvement-gc.md` (3.2)*

**Issue:** Error notification is unpredictable across nodes (some use native `alert()`, some silently fail, others rely entirely on `console.error()`).

**Required Actions:**
- **Global Toast Utility:** Establish a standardized error handler hooked to `sonner` toasts for client feedback.
- **Eliminate Silent Failing:** Ensure failure states (like GCS upload failures in `storage.ts`) throw specific exceptions rather than returning `null` silently. Include full context traces in logger reporting.

## 10. MEDIUM: Styling & CSS Hygiene
*References: `docs/improvement-cl.md` (9.A, 9.B, 9.C, 9.D)*

**Issue:** Hardcoded specific hex colors inside components, duplicate styling wrappers across identical node types, and overreliance on CSS `!important`.

**Required Actions:**
- **Utility Abstraction:** Extract common UI node background and outer classes into central CSS utilities (`nodeContainerStyles`).
- **CSS Variables:** Drive `port-image`, `port-video`, and theming parameters centrally through `.css` globals.
- **Refine Selectors:** Adhere to `ReactFlow` standard styling targets without brute forcing styles via `!important`.

## 11. MEDIUM: Accessibility (WCAG / A11y)
*References: `docs/improvement-cl.md` (11.A, 11.B, 11.C, 11.D)*

**Issue:** Action items neglect `aria-labels`, texts go critically small (9px), and nodes are structurally difficult to tab through via keyboard.

**Required Actions:**
- **Aria Signatures:** Equip all icon-only interactions (uploads, executions, dropdowns) with robust `aria-label` texts.
- **Scale Readability:** Bump minimum font rendering constraints up to `12px` globally.
- **Keyboard Tabulations:** Integrate visibility `tabIndex` attributes and explicit focus boundary rings onto node resize handlers and interactive regions.

## 12. LOW: General Maintenance & Organization
*References: `docs/improvement-cl.md` (3.C, 3.D), `docs/improvement-gc.md` (2.2, 2.3), `docs/improvement-an.md` (6)*

**Issue:** Shared constants like node batch limitations and colors are mixed into JSX files. Duplicated extraction patterns exist across backend and frontend utilities.

**Required Actions:**
- **Extract Configurations:** Transfer `IMAGE_MODEL_CONFIGS`, generic node limits (`BATCH_CONCURRENCY`), to `lib/constants.ts` or a global configuration object.
- **Unify Shared Parsers:** Extract standard methods for GCS URI parsing (`parseGcsUri`) and node Mention parsing logic (`@[nodeId]`) into shared utilities accessible to the entire stack.
- **Restructure Hierarchy:** Transition out of flat file storage; compartmentalize `components/` carefully into `nodes/`, `panels/`, `ui/`, and `flow/`.
