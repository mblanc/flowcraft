# Code Export Feature: Brainstorming & Technical Design

This document outlines the design and implementation plan for the "Export to Code" feature in FlowCraft.

## Goals

Allow users to export their visual flows into native, executable code snippets in **Python** and **TypeScript (Node.js)**. These snippets should:
- Call Gemini/Vertex AI directly (no dependence on FlowCraft backend).
- Support parallel execution where possible (async).
- Be easy to copy-paste into a notebook, script, or existing application.

---

## Technical Design

### 1. General Principles

- **Native SDKs**: 
    - Python: `google-genai`
    - TypeScript: `@google/genai`
- **Topological Sorting**: The exporter will use the same dependency resolution logic as the `WorkflowEngine` to determine the execution order.
- **Data Flow**: Node outputs will be mapped to variables, which are then passed as inputs to downstream nodes.
- **Environment Handling**: A boilerplate section at the top of the exported file will prompt the user for configuration.

### 2. Python Export (Class-Based, Async)

Python exports will follow a class-based structure to encapsulate the workflow logic.

#### Dependencies
```python
# pip install google-genai asyncio
import asyncio
from google import genai
```

#### Template Structure
```python
# --- CONFIGURATION (User to fill) ---
PROJECT_ID = "YOUR_PROJECT_ID"
LOCATION = "us-central1"
# ------------------------------------

client = genai.Client(
    vertexai=True,
    project=PROJECT_ID,
    location=LOCATION
)

class FlowCraftWorkflow:
    def __init__(self):
        self.results = {}

    async def execute_node_llm_1(self, instructions, inputs):
        # ... logic to resolve @[nodeId] mentions into 'contents' ...
        response = await client.models.generate_content(
            model='gemini-2.0-flash',
            contents=contents
        )
        return response.text

    async def run(self):
        # Execution logic following topological levels
        # Level 0
        task1 = asyncio.create_task(self.execute_node_llm_1(...))
        # Wait and proceed to next level
        self.results['node_1'] = await task1
        # ...
```

### 3. TypeScript Export (Node.js Backend)

TypeScript exports will be designed for Node.js environments.

#### Dependencies
```typescript
// npm install @google/genai
import { GoogleGenAI } from "@google/genai";
```

#### Template Structure
```typescript
// --- CONFIGURATION (User to fill) ---
const PROJECT_ID = "YOUR_PROJECT_ID";
const LOCATION = "us-central1";
// ------------------------------------

const client = new GoogleGenAI({
    vertexai: true,
    project: PROJECT_ID,
    location: LOCATION
});

export class FlowWorkflow {
    private results: Record<string, any> = {};

    async run() {
        const modelId = "gemini-2.0-flash";
        
        // Parallel execution for independent nodes
        const [res1, res2] = await Promise.all([
            this.executeNode1(modelId),
            this.executeNode2(modelId)
        ]);
        
        this.results['node1'] = res1;
        this.results['node2'] = res2;
        
        // Next level
        const res3 = await this.executeNode3(modelId, this.results['node1']);
        return res3;
    }
    
    private async executeNode1(modelId: string) {
        const response = await client.models.generateContent({
            model: modelId,
            contents: [...],
        });
        return response.text();
    }
}
```

---

## Implementation Details

### Mapping Logic

| Flow Element | Code Mapping |
| :--- | :--- |
| **Node** | Method in the class (e.g., `execute_node_[id]`) |
| **Edge** | Value passing between methods |
| **LLM Node** | `generate_content` call |
| **Image/Video** | Respective Imagen/Veo API calls or Gemini multimodal calls |
| **Sub-workflow** | Nested class call or flatterned methods |

### Handling Mentions (`@[nodeId]`)

The exporter must generate logic that replaces these tokens with actual variable values from previous steps. In Python, this will be implemented using f-strings or `.replace()` calls within the node execution methods.

### Batch Execution

Nodes configured for batch execution will be exported as loops or `asyncio.gather` calls in Python, and `Promise.all` in TypeScript.

---

## Next Steps

1.  **Frontend Integration**: Add an "Export" button to the Flow menu.
2.  **Export Engine**: Implement the `CodeExporter` utility in `lib/` that transforms the React Flow JSON into the templates described above.
3.  **Preview**: Show the code in a modal with syntax highlighting before downloading.
