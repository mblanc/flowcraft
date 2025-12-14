# FlowCraft Enhancement Roadmap

This document outlines a comprehensive plan for enhancing FlowCraft, covering architecture, backend, frontend, and developer experience. It consolidates existing recommendations, technical debt, and future feature requests.

## 1. Architecture & Backend

### 🚀 Server-Side Execution Engine
**Current State:** `WorkflowEngine` runs primarily client-side, limiting long-running tasks and batch processing capabilities.
**Enhancement:**
- Decouple `WorkflowEngine` from React state.
- Move execution logic to a server-side worker (e.g., using BullMQ + Redis).
- Expose execution status via polling or WebSockets.
**Benefit:** Enables background jobs, batch processing, and better rate limit management.

### 🛡️ API Request Validation
**Current State:** API routes (e.g., `app/api/generate-text/route.ts`) manually destructure request bodies without strict validation.
**Enhancement:**
- Implement `zod` schemas for all API routes.
- Validate inputs before processing to fail fast with clear error messages.
**Benefit:** Prevents runtime errors and improves API reliability.

### 🧩 Dynamic MIME Type Handling
**Current State:** `gs://` URIs are often hardcoded to `application/pdf` or have limited type detection.
**Enhancement:**
- Implement robust MIME type detection for GCS URIs based on file metadata or extensions.
- Support a wider range of file types (images, videos, audio) seamlessly.

### 🚦 Rate Limiting
**Current State:** No visible rate limiting on API routes.
**Enhancement:**
- Integrate `upstash/ratelimit` or a similar solution.
- Implement per-user or per-IP quotas to protect Vertex AI usage.

## 2. Workflow Engine

### 🔄 Robust Error Handling
**Current State:** Errors are logged but often leave nodes in ambiguous states.
**Enhancement:**
- Introduce explicit `error` states for nodes.
- Add `errorMessage` field to `NodeData` for UI feedback.
- Implement "Retry" functionality for individual failed nodes.

### 🧹 Engine Refactoring
**Current State:** `gatherInputs` contains repetitive logic for each node type.
**Enhancement:**
- Refactor input gathering into a Strategy Pattern.
- Create a configuration-based registration system for new node types to reduce boilerplate.

### 🛑 Cancellation Support
**Current State:** Workflows cannot be stopped once started.
**Enhancement:**
- Pass `AbortSignal` through the execution chain.
- Allow users to cancel long-running generations immediately.

### 📦 Batch Processing (New Feature)
**Enhancement:**
- Allow running a workflow on a dataset (e.g., CSV or list of files).
- Generate multiple outputs for a single flow configuration.

## 3. Frontend & UI/UX

### 🎨 Theming & Design System
**Current State:** Colors are often hardcoded (e.g., `text-purple-500`) in components.
**Enhancement:**
- Centralize colors in `tailwind.config.ts` or CSS variables.
- Ensure full support for Dark/Light modes with consistent semantic naming (e.g., `bg-node-agent`).

### ♿ Accessibility
**Current State:** Interactive elements may lack full keyboard support or ARIA labels.
**Enhancement:**
- Audit all buttons and handles for `aria-label`.
- Ensure keyboard navigation works for selecting and connecting nodes.

### 💾 Auto-Save & Persistence
**Current State:** Auto-save is commented out or disabled.
**Enhancement:**
- Re-enable auto-save with `useDebounce`.
- Persist workflow state to local storage or database automatically.

### ↩️ Undo/Redo
**Enhancement:**
- Implement a history stack for canvas operations (move, connect, delete).
- Allow users to `Ctrl+Z` / `Ctrl+Y` to revert changes.

### 🌟 Super Nodes (New Feature)
**Enhancement:**
- Allow grouping multiple nodes into a single "Super Node".
- Abstract complex logic into reusable components with simplified inputs/outputs.

## 4. Developer Experience & Quality Assurance

### 🧪 Testing Strategy
**Current State:** No automated testing framework is currently set up.
**Enhancement:**
- **Unit Tests:** Install `vitest` or `jest`. Test `WorkflowEngine` logic in isolation.
- **Integration Tests:** Test API routes using `supertest` or similar.
- **E2E Tests:** Use `Playwright` to test the canvas interaction (drag-and-drop, connection).

### 🛠️ CI/CD Pipeline
**Current State:** Basic Cloud Build setup exists.
**Enhancement:**
- Add linting and type-checking steps to the build pipeline.
- Run tests automatically on PRs.
- Optimize Docker build caching (already in progress).

### 📝 Documentation
**Enhancement:**
- Generate API documentation (OpenAPI/Swagger).
- Maintain up-to-date `CONTRIBUTING.md` for new developers.

## 5. Future Capabilities

- **Marketplace:** A hub for sharing and downloading custom workflows.
- **Headless API:** One-click generation of REST endpoints from workflows.
- **Plugin System:** Allow third-party developers to create custom nodes.
