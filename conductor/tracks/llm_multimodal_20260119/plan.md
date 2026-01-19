# Plan: Multi-modal Inputs for LLMNode (Video & PDF)

## Phase 1: Core Service Updates (Gemini Service)

- [ ] Task: Update `lib/services/gemini.service.ts` to handle PDF and Video mime types.
    - [ ] Add `application/pdf` to supported mime types.
    - [ ] Add video mime types (e.g., `video/mp4`, `video/mpeg`) to supported mime types.
    - [ ] Ensure `generateText` correctly constructs multi-modal parts for these types.
- [ ] Task: Write unit tests for `gemini.service.ts` multi-modal inputs.
    - [ ] Mock Gemini API responses for PDF inputs.
    - [ ] Mock Gemini API responses for Video inputs.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Core Service Updates' (Protocol in workflow.md)

## Phase 2: Executor & Integration (Workflow Engine)

- [ ] Task: Update `lib/executors.ts` to handle file aggregation for `LLMNode`.
    - [ ] Ensure `llmNodeExecutor` correctly collects files from all connected input nodes (`FileNode`, `VideoNode`, `ImageNode`).
    - [ ] Implement error handling for unsupported file types as per spec.
- [ ] Task: Verify Node Handle Compatibility.
    - [ ] Check `components/llm-node.tsx` to ensure handles are configured to accept connections from `VideoNode` and `FileNode`.
- [ ] Task: Write integration tests for `LLMNode` with multi-modal inputs.
    - [ ] Test `LLMNode` with a PDF input.
    - [ ] Test `LLMNode` with a Video input.
    - [ ] Test `LLMNode` with mixed inputs (Image + PDF).
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Executor & Integration' (Protocol in workflow.md)

## Phase 3: Final Verification & UI Polish

- [ ] Task: Manual Verification with real files.
    - [ ] Test with a sample PDF.
    - [ ] Test with a sample Video.
- [ ] Task: Ensure clear error UI when unsupported files are used.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Final Verification & UI Polish' (Protocol in workflow.md)
