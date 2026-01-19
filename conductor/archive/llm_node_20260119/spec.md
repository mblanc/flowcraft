# Specification: Refactor AgentNode to LLMNode with Structured Output

## Overview
Refactor the existing `AgentNode` into a more versatile `LLMNode`. The primary goal is to support both unstructured text generation and structured JSON output. This includes a new configuration interface for defining JSON schemas, with a focus on ease of use for common types like arrays of text.

## Functional Requirements
1.  **Node Rename & Migration**:
    - Rename `agent-node` to `llm-node` across the codebase (components, types, executors).
    - Implement a migration layer to automatically convert `agent-node` data in existing workflows to the `llm-node` structure.
2.  **Output Type Selection**:
    - Add a toggle in the node configuration to choose between `Text` and `JSON` output types.
3.  **Schema Configuration**:
    - **Visual Schema Editor**: An intuitive UI to add fields, define types (String, Number, Boolean, Array), and mark fields as required.
    - **Raw JSON Schema Editor**: An advanced mode to view/edit the raw underlying JSON schema directly.
    - **Array Support**: Specifically optimize the UI to make creating a "List of Strings" (Array of Text) a one-click or highly streamlined operation.
4.  **Structured Generation (Strict Mode)**:
    - Support "Strict Mode" leveraging Gemini's controlled generation capabilities to ensure the model's output strictly adheres to the provided schema.
5.  **Execution Engine Updates**:
    - Update the executor logic to handle the different response formats (raw text vs. parsed JSON).
    - Ensure downstream nodes can consume the structured data correctly.

## Non-Functional Requirements
- **Backwards Compatibility**: Existing flows must continue to work without manual intervention.
- **UI Consistency**: The new schema editor must follow the "Modern & Vibrant" and "Layered Complexity" guidelines.

## Acceptance Criteria
- [ ] Existing `agent-node` instances in saved workflows are correctly loaded as `llm-node`s.
- [ ] Users can successfully toggle between Text and JSON output modes.
- [ ] The Visual Schema Editor allows defining an "Array of Strings" easily.
- [ ] When in JSON mode, the node output is a valid JSON object matching the defined schema.
- [ ] The Raw Schema Editor stays in sync with the Visual Schema Editor.
- [ ] "Strict Mode" is available and functional for compatible models.
