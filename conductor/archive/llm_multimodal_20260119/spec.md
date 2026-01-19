# Specification: Multi-modal Inputs for LLMNode (Video & PDF)

## Overview

This track enables the `LLMNode` to accept and process video and PDF files as inputs via its `files` handle. By leveraging the native multi-modal capabilities of Gemini 1.5+ models, users can now chain `FileNode` (PDFs) and `VideoNode` (Videos) directly into an `LLMNode` for advanced analysis, summarization, and question-answering across different media types.

## Functional Requirements

- **PDF Support:** `LLMNode` must accept PDF files from connected `FileNode` inputs. These files will be passed directly to the Gemini API using its native multi-modal support.
- **Video Support:** `LLMNode` must accept video files from connected `VideoNode` inputs. These files will be passed directly to the Gemini API.
- **Node Compatibility:** The `files` handle of the `LLMNode` must be compatible with:
    - `FileNode` (specifically for `.pdf` files)
    - `VideoNode`
    - `ImageNode` (maintaining existing support)
- **Multi-file Handling:** If multiple nodes are connected to the `files` handle, the `LLMNode` will process them sequentially, appending the content to the prompt context in the order they are received.
- **Error Handling:**
    - If a file type is provided that is not supported by the Gemini API or the specific model selected, the node execution must fail with an explicit error message (e.g., "Unsupported file type: application/zip").

## Non-Functional Requirements

- **Performance:** Native file processing should be used to minimize latency and avoid unnecessary intermediate processing (like frame extraction or OCR).
- **Type Safety:** Ensure all file objects passed between nodes conform to the established `FileObject` types in the codebase.

## Acceptance Criteria

- [ ] `LLMNode` successfully processes a single PDF file and answers questions about its content.
- [ ] `LLMNode` successfully processes a single video file and describes its events.
- [ ] `LLMNode` handles a mix of images, videos, and PDFs connected to the `files` handle simultaneously.
- [ ] Clear error messages are displayed when an unsupported file format is used.
- [ ] Integration tests verify the end-to-end flow from file input nodes to `LLMNode` execution.

## Out of Scope

- Support for non-PDF documents (e.g., Word, Excel) unless natively supported by the Gemini API.
- Advanced frame-by-frame extraction or manual OCR.
- Real-time video streaming (files must be uploaded/accessible via URL).
