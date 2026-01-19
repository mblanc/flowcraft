# Plan: Multi-modal Inputs for LLMNode (Video & PDF)

## Phase 1: Core Service Updates (Gemini Service) [checkpoint: 3ba2bcc]

- [x] Task: Update `lib/services/gemini.service.ts` to handle PDF and Video mime types. caae441
    - [x] Add `application/pdf` to supported mime types.
    - [x] Add video mime types (e.g., `video/mp4`, `video/mpeg`) to supported mime types.
    - [x] Ensure `generateText` correctly constructs multi-modal parts for these types.
- [x] Task: Write unit tests for `gemini.service.ts` multi-modal inputs. caae441
    - [x] Mock Gemini API responses for PDF inputs.
    - [x] Mock Gemini API responses for Video inputs.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Core Service Updates' (Protocol in workflow.md) 3ba2bcc

## Phase 2: Executor & Integration (Workflow Engine) [checkpoint: 3e11c5f]

- [x] Task: Update `lib/executors.ts` to handle file aggregation for `LLMNode`. 9e07b36
    - [x] Ensure `llmNodeExecutor` correctly collects files from all connected input nodes (`FileNode`, `VideoNode`, `ImageNode`).
    - [x] Implement error handling for unsupported file types as per spec.
- [x] Task: Verify Node Handle Compatibility. 9e07b36
- [x] Task: Write integration tests for `LLMNode` with multi-modal inputs. 923a49c
    - [x] Test `LLMNode` with a PDF input.
    - [x] Test `LLMNode` with a Video input.
    - [x] Test `LLMNode` with mixed inputs (Image + PDF).
- [x] Task: Conductor - User Manual Verification 'Phase 2: Executor & Integration' (Protocol in workflow.md) 3e11c5f

## Phase 3: Final Verification & UI Polish [checkpoint: 6545dca]

- [x] Task: Manual Verification with real files. d60a05a
    - [x] Test with a sample PDF.
    - [x] Test with a sample Video.
- [x] Task: Ensure clear error UI when unsupported files are used. d60a05a
- [x] Task: Conductor - User Manual Verification 'Phase 3: Final Verification & UI Polish' (Protocol in workflow.md) 6545dca
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Final Verification & UI Polish' (Protocol in workflow.md)
