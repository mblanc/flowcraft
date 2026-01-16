# Improvement Plan for Flowcraft

This document outlines a comprehensive strategy to improve the code quality, architecture, security, and maintainability of the Flowcraft application.

## 1. Security (Critical)

### 1.1. Secure All API Routes

**Current Status:** Some API routes (e.g., `/api/flows`) check for authentication, while others (e.g., `/api/generate-image`) appear to be unprotected.
**Improvement:**

- Implement a middleware or a higher-order function to enforce authentication on **all** protected API routes.
- Ensure `auth()` from `next-auth` is validated before processing any request in `app/api/generate-*/route.ts`.

### 1.2. Input Validation

**Current Status:** Input validation is manual and ad-hoc (e.g., `if (!prompt) ...`).
**Improvement:**

- Integrate **Zod** for strict schema validation of API request bodies.
- Define schemas for `GenerateImageRequest`, `GenerateTextRequest`, etc., in a shared `lib/schemas.ts` file.
- Return structured 400 errors when validation fails.

## 2. Architecture & Separation of Concerns

### 2.1. Service Layer Pattern

**Current Status:** API routes contain heavy business logic (Firestore calls, external API calls, data formatting).
**Improvement:**

- Extract logic into dedicated service classes/modules in `lib/services/`:
    - `FlowService`: Handle Firestore interactions for flows.
    - `GeminiService`: Handle interactions with Google GenAI SDK.
    - `StorageService`: Handle Google Cloud Storage uploads.
- API routes should act as controllers: Validate input -> Call Service -> Return Response.

### 2.2. Frontend State Management

**Current Status:** `FlowProvider` is monolithic, handling UI state, flow logic, API calls, and persistence.
**Improvement:**

- Refactor `FlowProvider` to separate concerns:
    - **`useFlowState`**: Custom hook for React Flow nodes/edges state (consider `zustand` for better performance than huge Context).
    - **`useFlowExecution`**: Dedicated hook for the `WorkflowEngine` and execution logic.
    - **`useFlowPersistence`**: Dedicated hook for save/load/auto-save logic.

### 2.3. Workflow Engine Refactoring

**Current Status:** `WorkflowEngine` uses `as unknown` type casting and hardcoded `if/else` blocks for input gathering.
**Improvement:**

- **Polymorphism:** Refactor `gatherInputs` to use a strategy pattern or configuration object per node type.
- **Type Safety:** Remove unsafe casts in `executors` mapping. Define a strict `NodeExecutor` interface.
- **Decoupling:** Inject dependencies (like the API client) into the engine to make it testable.

## 3. Code Quality & Maintainability

### 3.1. Centralized Configuration

**Current Status:** `process.env` is accessed directly in various files. Model names and constants are hardcoded.
**Improvement:**

- Create `lib/config.ts` (or use a library like `t3-env`) to validate and export environment variables in a type-safe way.
- Create `lib/constants.ts` for model names (e.g., `gemini-2.5-flash`), default dimensions, and API endpoints.

### 3.2. Standardized Logging

**Current Status:** `console.log` is used extensively. `app/logger.ts` exists but is underutilized.
**Improvement:**

- Replace all `console.log` and `console.error` with the Winston logger from `app/logger.ts`.
- Ensure logs include request IDs or context for easier debugging.

### 3.3. Type Safety

**Current Status:** `lib/types.ts` is a good start but can be tightened.
**Improvement:**

- Avoid `any` or `unknown` where possible.
- Use Zod schemas to infer TypeScript types for API contracts to ensure the frontend and backend stay in sync.

### 3.4. DRY (Don't Repeat Yourself)

**Current Status:** Node creation logic in `FlowProvider` (e.g., `addAgentNode`, `addImageNode`) repeats the same pattern.
**Improvement:**

- Create a factory function `createNode(type: NodeType, position: XYPosition)` to centralize default data and ID generation.

## 4. Performance

### 4.1. Component Optimization

**Current Status:** `FlowProvider` context changes might trigger re-renders of the entire app.
**Improvement:**

- If switching to `zustand`, use selectors to subscribe only to necessary state changes.
- Memoize heavy components in the flow canvas.

### 4.2. Image Optimization

**Current Status:** Need to verify if `next/image` is used for rendering generated images.
**Improvement:**

- Ensure all images (especially user-generated content from GCS) are rendered using `next/image` with proper `loader` configuration for caching and resizing.

## 5. Testing

### 5.1. Unit & Integration Tests

**Current Status:** No tests visible.
**Improvement:**

- Add **Vitest** or **Jest** for unit testing `WorkflowEngine` and services.
- Add API integration tests to verify routes (mocking external AI services).
