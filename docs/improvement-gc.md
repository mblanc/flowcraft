# FlowCraft Improvement Recommendations

This document outlines suggested enhancements for the FlowCraft project, focusing on maintainability, scalability, and code quality.

## 1. Architectural Improvements

### 1.1 Decompose `FlowCanvas` Component

The `components/flow-canvas.tsx` file is a "God Component" that has grown too large (600+ lines). It handles everything from UI rendering to complex logic.

- **Action:** Split `FlowCanvas` into smaller, focused components:
    - `FlowContextMenu`: Dedicated component for the canvas context menu.
    - `FlowControls`: Extension of the standard controls with custom modes (hand vs. selection).
    - `FlowDnDHandler`: Logic for handling drag-and-drop operations (files and nodes).
    - `NodeConnectionDropdown`: The logic for the "Connect to Node" dropdown.
- **Benefit:** Improves readability, makes testing individual parts easier, and reduces the risk of side effects during modifications.

### 1.2 Standardize API Calls in Executors

The `lib/executors.ts` file contains repeated patterns for making API requests and handling errors.

- **Action:** Create a centralized `executeNodeApiCall` utility or service:
    ```typescript
    async function executeNodeApiCall<T>(
        url: string,
        body: any,
        context?: ExecutionContext,
    ): Promise<T>;
    ```
- **Benefit:** Reduces code duplication, centralizes error handling, and makes it easier to implement features like global retry policies or logging.

### 1.3 Refactor Node Input Gathering

The `lib/node-registry.ts` file contains complex logic for input gathering (`getSourceValue`, `inferMimeType`, `buildFileValues`).

- **Action:** Move this logic into a dedicated `InputGatherer` class or service. Use polymorphism or a strategy pattern to handle different node types more cleanly instead of large `if/else` or `switch` blocks.
- **Benefit:** Enhances testability and makes it easier to add new node types without further bloating `node-registry.ts`.

## 2. Code Quality & Maintenance

### 2.1 Enhance Type Safety

While Zod is used for validation, the execution engine often resorts to `any` or `Record<string, unknown>` casting.

- **Action:**
    - Refine `NodeData` union types to be more strictly used throughout the engine.
    - Use discriminated unions more effectively in `WorkflowEngine` and `executors`.
    - Avoid `as unknown as ...` where possible by improving the type definitions of `NodeDefinition`.
- **Benefit:** Reduces runtime errors and improves developer experience through better IDE autocompletion and compile-time checks.

### 2.2 Externalize Configuration and Constants

Hardcoded values like `BATCH_CONCURRENCY = 3`, `NODE_COLORS`, and default resolutions are scattered in components and logic.

- **Action:** Move these to `lib/constants.ts` or a dedicated configuration service.
- **Benefit:** Centralizes settings, making the app easier to tune without digging through component logic.

### 2.3 Shared Mention Logic

Mentions parsing logic (`@[nodeId]`) is currently backend-only (in `executors.ts`).

- **Action:** Extract mention parsing and resolution into a shared utility or service that can be used by both the backend (for execution) and the frontend (for live previews or validation).
- **Benefit:** Ensures consistency in how mentions are handled across the entire application.

## 3. Performance & UX

### 3.1 Optimize Re-renders in `FlowCanvas`

The `FlowCanvas` component re-renders frequently due to its large state and many hooks.

- **Action:**
    - Use `useCallback` and `useMemo` more aggressively for event handlers passed to React Flow.
    - Ensure that the Zustand selectors are as granular as possible to prevent unnecessary re-renders when unrelated parts of the state change.
- **Benefit:** Smoother user experience, especially in complex workflows with many nodes.

### 3.2 Standardized Error Toasts

While `sonner` is used, error handling in some components could be more consistent.

- **Action:** Implement a global error handling hook or utility that maps backend errors to user-friendly toasts.
- **Benefit:** Provides a more cohesive and professional feel to the application's error reporting.

## 4. Testing

### 4.1 Expand Integration Testing

The project has a good foundation of tests, but more integration tests for complex scenarios (like nested sub-workflows and batch execution) would be beneficial.

- **Action:** Add integration tests in `__tests__/` that simulate full workflow runs with mocked Gemini API responses.
- **Benefit:** Increases confidence in the core execution engine, which is the heart of the application.
