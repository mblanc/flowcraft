# Implementation Plan - Refactor AgentNode to LLMNode with Structured Output

#### Phase 1: Core Refactoring & Migration [checkpoint: 9c51265]

- [x] Task: Rename all `AgentNode` related symbols and files to `LLMNode` in `lib/` and `components/`. [6ca4220]
    - [ ] Write Tests
    - [ ] Implement Feature
- [x] Task: Update the `node-registry.ts` and `node-factory.ts` to reflect the change. [6ca4220]
    - [ ] Write Tests
    - [ ] Implement Feature
- [x] Task: Implement a migration utility to convert `agent-node` to `llm-node` in workflow JSON. [efa991d]
    - [ ] Write Tests
    - [ ] Implement Feature
- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

#### Phase 2: Schema Configuration UI [checkpoint: bc5a999]

- [x] Task: Add the `Text` vs `JSON` output type toggle to the `LLMNode` configuration panel. [a15baeb]
    - [ ] Write Tests
    - [ ] Implement Feature
- [x] Task: Build the **Visual Schema Editor** (Add fields, select types: String, Number, Boolean, Array). [0c2b1e0]
    - [ ] Write Tests
    - [ ] Implement Feature
- [x] Task: Add the **Raw JSON Schema Editor** with bi-directional sync to the Visual Editor. [ce92bed]
    - [ ] Write Tests
    - [ ] Implement Feature
- [x] Task: Create a "List of Strings" (Array of Text) shortcut/preset in the UI. [4cfa317]
    - [ ] Write Tests
    - [ ] Implement Feature
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

#### Phase 3: Executor Updates & Strict Mode [checkpoint: a2bf41b]

- [x] Task: Update `executors.ts` to handle the `response_mime_type` and `response_schema` parameters for Gemini models. [a94ca26]
    - [ ] Write Tests
    - [ ] Implement Feature
- [x] Task: Implement "Strict Mode" toggle logic to enforce schema adherence via the model API. [9f3f53d]
    - [ ] Write Tests
    - [ ] Implement Feature
- [x] Task: Ensure the workflow engine correctly passes structured outputs to downstream nodes. [6518431]
    - [ ] Write Tests
    - [ ] Implement Feature
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

#### Phase 4: Final Integration & Verification [checkpoint: 1dca473]

- [x] Task: Verify end-to-end flow with a "List of Strings" extraction use case. [f456b7c]
    - [ ] Write Tests
    - [ ] Implement Feature
- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)
