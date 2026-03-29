# Canvas Feature — Detailed Specification

> **Status:** Draft
> **Last updated:** 2026-03-29
> **Access:** Admin-only (initial release)

---

## 1. Overview

Canvas is a new top-level feature that provides a free-form creative workspace where users generate and arrange media assets (images, videos) by conversing with an AI agent. It combines a React Flow–based spatial canvas with a persistent multi-turn chat panel.

**Core loop:** The user chats with an agent → the agent generates media → media appears on the canvas → the user selects/arranges media → selected media feeds back into the agent's context for iteration.

---

## 2. Information Architecture

### 2.1 Navigation

A new **"Canvas"** tab is added to the dashboard (`/flows` page) **after** the Community tab. The tab is **only rendered when `session.user.isAdmin === true`**.

| Tab            | Value        | Icon             | Visibility     |
| -------------- | ------------ | ---------------- | -------------- |
| My Flows       | `my`         | `Workflow`       | All users      |
| Shared with me | `shared`     | `Users`          | All users      |
| Community      | `community`  | `Globe`          | All users      |
| **Canvas**     | **`canvas`** | **`PanelRight`** | **Admin only** |

### 2.2 Routes

| Route                 | Purpose                                                  |
| --------------------- | -------------------------------------------------------- |
| `/flows` (tab=canvas) | Canvas listing — grid of canvas cards with create/delete |
| `/canvas/[id]`        | Canvas editor — full-screen canvas + chat                |

### 2.3 Firestore Collection

New collection: **`canvases`**

---

## 3. Data Model

### 3.1 Canvas Document (`canvases/{canvasId}`)

```typescript
interface CanvasDocument {
    id: string;
    userId: string; // Owner
    name: string; // User-editable, default "Untitled Canvas"
    thumbnail?: string; // GCS URI, auto-generated from canvas state

    // React Flow state
    nodes: CanvasNode[]; // Media items, text blocks
    edges: never[]; // Reserved for future use (connections)
    viewport: { x: number; y: number; zoom: number };

    // Chat state
    messages: ChatMessage[];

    // Metadata
    visibility: "private" | "public";
    sharedWith: string[]; // User IDs (future)
    sharedWithEmails: string[]; // Emails (future)
    isTemplate: boolean; // Community templates (future)
    createdAt: string; // ISO timestamp
    updatedAt: string; // ISO timestamp
}
```

### 3.2 Canvas Node

Each item on the canvas is a React Flow node. Node types:

| `type`         | Description                 |
| -------------- | --------------------------- |
| `canvas-image` | Generated or uploaded image |
| `canvas-video` | Generated or uploaded video |
| `canvas-text`  | Editable text block         |

```typescript
interface CanvasNode {
    id: string; // e.g. "image-1", "video-3", "text-2"
    type: "canvas-image" | "canvas-video" | "canvas-text";
    position: { x: number; y: number };
    data: CanvasImageData | CanvasVideoData | CanvasTextData;
    width?: number;
    height?: number;
    selected?: boolean;
}

interface CanvasImageData {
    type: "canvas-image";
    label: string; // Auto: "Image 1", "Image 2", etc. User-editable
    sourceUrl: string; // GCS URI (gs://...)
    mimeType: string;
    prompt?: string; // Generation prompt that created this
    width: number;
    height: number;
    aspectRatio?: string;
    model?: string; // Model used for generation
    status: "ready" | "generating" | "error";
    error?: string;
}

interface CanvasVideoData {
    type: "canvas-video";
    label: string; // Auto: "Video 1", "Video 2", etc. User-editable
    sourceUrl: string; // GCS URI
    mimeType: string;
    prompt?: string;
    duration?: number;
    aspectRatio?: string;
    model?: string;
    status: "ready" | "generating" | "error";
    progress?: number; // 0-100, for generation polling
    error?: string;
}

interface CanvasTextData {
    type: "canvas-text";
    label: string; // Auto: "Text 1", etc.
    content: string; // Rich text / markdown content
    fontSize?: number;
    width: number;
    height: number;
}
```

### 3.3 Chat Message

```typescript
interface ChatMessage {
    id: string; // UUID
    role: "user" | "assistant" | "system";
    content: string; // Markdown text
    attachments?: ChatAttachment[]; // Media references from canvas
    actions?: ChatAction[]; // Suggested quick-action buttons
    generatedMedia?: GeneratedMediaRef[]; // Media this message created
    model?: string; // Model used for this response
    createdAt: string; // ISO timestamp
}

interface ChatAttachment {
    nodeId: string; // Canvas node ID being referenced
    label: string; // Display label (e.g. "Image 1")
    type: "canvas-image" | "canvas-video";
    thumbnailUrl?: string; // For preview in chat input
}

interface ChatAction {
    id: string;
    label: string; // Button text (e.g. "Yes, generate it")
    prompt: string; // Message sent when clicked
}

interface GeneratedMediaRef {
    nodeId: string; // The canvas node that was created
    type: "canvas-image" | "canvas-video";
}
```

---

## 4. Canvas Editor Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Header: [← Back] [Canvas Name (editable)]            [Auto-save indicator] │
├──────────┬───────────────────────────────────┬───────────────────────────┤
│ Toolbar  │                                   │      Chat Panel           │
│          │                                   │                           │
│ [T] Text │        React Flow Canvas          │  ┌─────────────────────┐  │
│ [↑] Import│       (zoom, pan, nodes)         │  │  Message history     │  │
│          │                                   │  │  (scrollable)        │  │
│          │   ┌──────────┐  ┌──────────┐      │  │                     │  │
│          │   │ Image 1  │  │ Video 1  │      │  │  [Agent response]   │  │
│          │   │          │  │          │      │  │  [Suggested actions] │  │
│          │   └──────────┘  └──────────┘      │  │                     │  │
│          │                                   │  └─────────────────────┘  │
│          │         ┌──────────┐              │  ┌─────────────────────┐  │
│          │         │ Text 1   │              │  │ [Attachments bar]   │  │
│          │         └──────────┘              │  │ [@mention input]    │  │
│          │                                   │  │ [Mode ▾] [Model ▾]  │  │
│          │                                   │  │ [Send button]       │  │
│          │                                   │  └─────────────────────┘  │
└──────────┴───────────────────────────────────┴───────────────────────────┘
```

### 4.1 Header

- **Back button**: Returns to `/flows?tab=canvas`
- **Canvas name**: Inline-editable text, auto-saves on blur
- **Auto-save indicator**: Shows "Saving...", "Saved", or "Error" status

### 4.2 Toolbar (Left Sidebar — Narrow)

Vertical icon toolbar, always visible:

| Icon         | Action   | Behavior                                                                                 |
| ------------ | -------- | ---------------------------------------------------------------------------------------- |
| `Type` (T)   | Add Text | Creates a new `canvas-text` node at canvas center                                        |
| `Upload` (↑) | Import   | Opens file picker (images: png/jpg/webp, videos: mp4/webm). Uploads to GCS, adds as node |

### 4.3 Canvas Area (Center)

Built with **React Flow** (`@xyflow/react`):

- **Pan & Zoom**: Standard React Flow viewport controls (scroll to zoom, drag to pan)
- **Background**: Dot grid pattern (consistent with flow editor)
- **Controls**: Zoom in/out/fit-view buttons (React Flow `<Controls />`)
- **Node interactions**:
    - Click to select (blue border highlight)
    - Shift+Click or drag-select for multi-select
    - Drag to reposition
    - Resize handles on selected nodes
    - Double-click label to rename
    - Right-click context menu: Rename, Delete, Copy prompt

### 4.4 Chat Panel (Right)

Fixed-width panel (~380px), not resizable.

**Components from top to bottom:**

1. **Message history** (scrollable): Renders `ChatMessage[]` with markdown, media previews, and action buttons
2. **Attachments bar**: Shows capsules for selected canvas items (when items are selected on canvas). Each capsule has the item label + thumbnail + remove button
3. **Chat input area**:
    - Rich text input with `@` mention support (typing `@` shows a dropdown of all canvas nodes with label + type icon; selecting one inserts a capsule)
    - **Mode selector** (combobox): `Auto` | `Image` | `Video` — controls generation type
    - **Model selector** (combobox): Lists available models, defaults to `Gemini 3.1 Flash`
    - **Send button**: Submits the message

---

## 5. Agent System

### 5.1 Architecture

The canvas agent is a **server-side orchestrator** that:

1. Receives user messages + canvas context (selected media, chat history)
2. Uses a reasoning LLM to determine intent and plan actions
3. Calls the appropriate generation API (image/video)
4. Returns a streamed text response + structured actions

### 5.2 System Prompt

The agent operates under a system prompt that defines:

- It is a creative media assistant helping the user build visual projects
- It can generate images and videos
- It can see and reference canvas items shared by the user via `@mentions` or selection
- It should suggest follow-up actions as quick buttons
- It should name generated media descriptively

### 5.3 Generation Mode Logic

| Mode      | Behavior                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------- |
| **Auto**  | Agent uses the reasoning LLM to decide whether to generate an image or video based on the user's message |
| **Image** | Forces image generation. Agent wraps user intent into an image generation prompt                         |
| **Video** | Forces video generation. Agent wraps user intent into a video generation prompt                          |

### 5.4 Context Assembly

For each user message, the backend assembles context from:

1. **System prompt** (role, capabilities, instructions)
2. **Chat history** (previous messages, trimmed to fit context window)
3. **Selected canvas items** (attached via selection or @mention):
    - Images: GCS URI passed as image parts to the LLM
    - Videos: GCS URI passed as file reference
4. **User message text**

### 5.5 Response Format

The agent returns a **streamed** response with a structured suffix:

```typescript
interface AgentResponse {
    text: string; // Markdown response (streamed)
    mediaToGenerate?: {
        type: "image" | "video";
        prompt: string;
        referenceNodeIds?: string[]; // Canvas items to use as reference
        config: {
            aspectRatio?: string;
            resolution?: string;
            model?: string;
            duration?: number; // Video only
        };
    };
    suggestedActions?: ChatAction[]; // Quick-action buttons
}
```

### 5.6 Media Generation Flow

1. Agent response streams into the chat
2. If `mediaToGenerate` is present:
   a. A placeholder node is immediately added to the canvas with `status: "generating"`
   b. A background API call starts the generation (image or video)
   c. **Image**: Single request → on completion, node updates to `status: "ready"` with the GCS URL
   d. **Video**: Long-running operation → progress polling updates the node's `progress` field → on completion, node updates to `status: "ready"`
3. The chat message is updated with `generatedMedia` references
4. Canvas auto-saves

### 5.7 Iteration on Existing Media

When the user references an existing canvas item (via @mention or selection) and requests changes:

- For **images**: The original image is passed as a reference image to the generation API alongside the edit instruction
- For **videos**: The original image frame or prompt context is reused with the new instructions

### 5.8 Available Models

Exposed in the model selector combobox:

| Category           | Models                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| **Text/Reasoning** | `gemini-3.1-flash` (default), `gemini-3-pro-preview`, `gemini-2.5-flash`                           |
| **Image**          | `gemini-3.1-flash-image-preview` (default), `gemini-3-pro-image-preview`, `gemini-2.5-flash-image` |
| **Video**          | `veo-3.1-fast-generate-preview` (default), `veo-3.1-generate-preview`                              |

The model selector controls the **reasoning** model. Image/video generation models are auto-selected based on generation type, or can be overridden via chat instructions.

---

## 6. API Routes

### 6.1 Canvas CRUD

| Method   | Route                | Description                                     |
| -------- | -------------------- | ----------------------------------------------- |
| `GET`    | `/api/canvases`      | List user's canvases (supports `?tab=canvas`)   |
| `POST`   | `/api/canvases`      | Create new canvas                               |
| `GET`    | `/api/canvases/[id]` | Get canvas by ID                                |
| `PATCH`  | `/api/canvases/[id]` | Update canvas (nodes, name, viewport, messages) |
| `DELETE` | `/api/canvases/[id]` | Delete canvas                                   |

### 6.2 Canvas Chat

| Method | Route                     | Description                                            |
| ------ | ------------------------- | ------------------------------------------------------ |
| `POST` | `/api/canvases/[id]/chat` | Send a message to the canvas agent. Returns SSE stream |

**Request body:**

```typescript
interface CanvasChatRequest {
    message: string;
    attachments?: ChatAttachment[]; // Selected canvas items
    mode: "auto" | "image" | "video";
    model?: string; // Override reasoning model
    history?: ChatMessage[]; // Recent chat context (or fetched server-side)
}
```

**Response:** Server-Sent Events (SSE) stream:

```
event: text
data: {"delta": "I'll generate a..."}

event: text
data: {"delta": " vibrant sunset image for you."}

event: media
data: {"type": "image", "prompt": "vibrant sunset...", "nodeId": "image-3", "config": {...}}

event: actions
data: {"actions": [{"id": "1", "label": "Make it warmer", "prompt": "Make the colors warmer"}]}

event: done
data: {}
```

### 6.3 Media Generation

Reuses existing API routes:

| Route                      | Used for                                    |
| -------------------------- | ------------------------------------------- |
| `POST /api/generate-image` | Image generation (existing)                 |
| `POST /api/generate-video` | Video generation (existing)                 |
| `POST /api/upload-file`    | User file uploads (existing)                |
| `GET /api/signed-url`      | Signed URL for GCS media display (existing) |

---

## 7. Components

### 7.1 New Components

```
components/
├── canvas/
│   ├── canvas-editor.tsx          # Main layout: toolbar + ReactFlow + chat panel
│   ├── canvas-header.tsx          # Header with back, name, save status
│   ├── canvas-toolbar.tsx         # Left icon toolbar (Add Text, Import)
│   ├── canvas-chat-panel.tsx      # Right chat panel container
│   ├── canvas-chat-messages.tsx   # Message list renderer
│   ├── canvas-chat-input.tsx      # Input with @mentions, mode/model selectors
│   ├── canvas-chat-message.tsx    # Single message (user or assistant)
│   ├── canvas-chat-actions.tsx    # Suggested action buttons
│   ├── canvas-mention-dropdown.tsx# @mention autocomplete for canvas items
│   ├── canvas-attachment-bar.tsx  # Selected items capsules above input
│   └── nodes/
│       ├── canvas-image-node.tsx  # Image node with preview, label, loading state
│       ├── canvas-video-node.tsx  # Video node with preview, label, progress
│       └── canvas-text-node.tsx   # Editable text block node
```

### 7.2 New Pages

```
app/
├── canvas/
│   └── [id]/
│       └── page.tsx               # Canvas editor page
```

### 7.3 New Services / Lib

```
lib/
├── services/
│   └── canvas.service.ts          # Firestore CRUD for canvases
├── store/
│   └── use-canvas-store.ts        # Zustand store for canvas editor state
├── canvas-agent.ts                # Agent orchestration (system prompt, context assembly)
└── constants.ts                   # Add COLLECTIONS.CANVASES, canvas-specific constants
```

### 7.4 New API Routes

```
app/api/
├── canvases/
│   ├── route.ts                   # GET (list), POST (create)
│   └── [id]/
│       ├── route.ts               # GET, PATCH, DELETE
│       └── chat/
│           └── route.ts           # POST (SSE chat stream)
```

---

## 8. Zustand Store

```typescript
interface CanvasStore {
    // Canvas data
    canvasId: string | null;
    canvasName: string;
    nodes: CanvasNode[];
    viewport: { x: number; y: number; zoom: number };
    messages: ChatMessage[];

    // UI state
    selectedNodeIds: string[];
    isSaving: boolean;
    saveStatus: "saved" | "saving" | "error";
    isChatLoading: boolean;
    generatingNodeIds: string[]; // Nodes currently being generated

    // Actions
    setCanvas: (canvas: CanvasDocument) => void;
    setCanvasName: (name: string) => void;
    addNode: (node: CanvasNode) => void;
    updateNode: (id: string, data: Partial<CanvasNode>) => void;
    removeNode: (id: string) => void;
    setNodes: (nodes: CanvasNode[]) => void;
    setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
    setSelectedNodeIds: (ids: string[]) => void;
    addMessage: (message: ChatMessage) => void;
    updateMessage: (id: string, data: Partial<ChatMessage>) => void;
    save: () => Promise<void>;

    // Node ID generation
    getNextLabel: (
        type: "canvas-image" | "canvas-video" | "canvas-text",
    ) => string;
}
```

---

## 9. Auto-Labeling

Nodes are auto-labeled with incrementing counters per type:

- Images: "Image 1", "Image 2", ...
- Videos: "Video 1", "Video 2", ...
- Text: "Text 1", "Text 2", ...

The counter is derived from the current max index of that type in `nodes[]`, not a persisted counter (avoids gaps-management complexity). Labels are editable via double-click on the node.

---

## 10. Auto-Save

Canvas auto-saves using debounced writes (500ms debounce) triggered by:

- Node position/size changes
- Node additions/deletions
- Canvas name changes
- New chat messages
- Viewport changes

Follows the same pattern as the existing flow auto-save mechanism.

---

## 11. Implementation Phases

The feature will be built atomically in the following order:

### Phase 1 — Foundation

1. **Firestore collection & service**: `canvas.service.ts` with CRUD operations
2. **API routes**: `/api/canvases` (list, create), `/api/canvases/[id]` (get, update, delete)
3. **Dashboard tab**: Add "Canvas" tab (admin-only) to `/flows` page with listing, create, delete
4. **Canvas editor page**: `/canvas/[id]` with basic layout (header + empty React Flow canvas)
5. **Zustand store**: `use-canvas-store.ts` with core state management
6. **Auto-save**: Debounced persistence

### Phase 2 — Canvas Nodes

7. **Canvas image node**: `canvas-image-node.tsx` with preview, label, resize, selection highlight
8. **Canvas video node**: `canvas-video-node.tsx` with video player, label, progress indicator
9. **Canvas text node**: `canvas-text-node.tsx` with inline editing
10. **Toolbar**: Add Text + Import (file upload → GCS → node)
11. **Node interactions**: Drag, resize, select, multi-select, delete, rename (double-click label)
12. **Context menu**: Right-click on node → Rename, Delete, Copy prompt

### Phase 3 — Chat Panel (Static)

13. **Chat panel layout**: Fixed-width panel with message list + input area
14. **Chat message rendering**: Markdown, media thumbnails, timestamps
15. **Chat input**: Basic text input with send button
16. **Mode selector**: Auto / Image / Video combobox
17. **Model selector**: Combobox with available models

### Phase 4 — Agent Integration

18. **Agent orchestration**: `canvas-agent.ts` — system prompt, context assembly, intent detection
19. **Chat API route**: `/api/canvases/[id]/chat` with SSE streaming
20. **Streaming responses**: Token-by-token rendering in chat panel
21. **Image generation**: Agent triggers image gen → placeholder node → completed node
22. **Video generation**: Agent triggers video gen → placeholder with progress → completed node
23. **Chat history persistence**: Messages saved as part of canvas document

### Phase 5 — Context & Mentions

24. **Selection-to-context**: Selected canvas nodes appear as attachments in chat input bar
25. **@mention system**: `@` trigger → dropdown of canvas nodes → capsule insertion
26. **Context assembly**: Selected/mentioned items sent as multimodal parts to the agent
27. **Agent media references**: Agent can reference canvas items by label in responses

### Phase 6 — Suggested Actions & Iteration

28. **Suggested action buttons**: Agent returns quick actions, rendered as clickable buttons below messages
29. **Media iteration**: "Edit Image 1" → original image passed as reference + new instructions
30. **Generation config via chat**: User can specify aspect ratio, resolution in natural language

### Future Phases (Not in initial scope)

- Canvas sharing (`sharedWith`, `sharedWithEmails`)
- Community canvas templates
- Opening canvas feature to non-admin users
- Post-processing (upscale, resize) from canvas
- Audio generation
- Canvas ↔ Flow integration
- Real-time collaboration (multi-user editing)
- Export canvas as video/presentation
- Canvas comments/annotations

---

## 12. Key Technical Decisions

| Decision         | Choice                       | Rationale                                                                     |
| ---------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| Canvas library   | React Flow (`@xyflow/react`) | Already in the project, proven with flow editor, handles zoom/pan/drag/resize |
| State management | Zustand                      | Consistent with existing flow store pattern                                   |
| Chat streaming   | SSE (Server-Sent Events)     | Simple, well-supported, unidirectional (server → client)                      |
| Chat persistence | Part of canvas document      | Keeps data co-located, simpler queries                                        |
| Agent LLM        | Gemini 3.1 Flash (default)   | Fast, capable, already integrated via Vertex AI                               |
| Media storage    | GCS (existing bucket)        | Reuses existing upload/signed-URL infrastructure                              |
| Admin gating     | `session.user.isAdmin` check | Existing pattern from `auth.ts` — env-based `ADMIN_EMAILS`                    |
| Auto-save        | Debounced PATCH (500ms)      | Same pattern as flow editor, prevents data loss                               |
| @mentions        | Custom mention dropdown      | Similar to existing `mention-editor` in flow nodes                            |

---

## 13. Security Considerations

- All canvas API routes protected by `withAuth` (existing pattern)
- Canvas ownership enforced: only owner can read/update/delete their canvases (admin can access all, consistent with flows)
- Media uploads go through existing GCS upload pipeline with size limits
- Chat messages are sanitized before rendering (XSS prevention)
- Rate limiting on `/api/canvases/[id]/chat` to prevent generation abuse (future)

---

## 14. Error Handling

| Scenario                   | UX                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Image generation fails     | Node shows error state (red border, error message). Toast notification. Retry option in context menu |
| Video generation times out | Node shows timeout message. Toast with retry option                                                  |
| Chat API error             | Error message in chat panel. Retry button on failed message                                          |
| Auto-save fails            | Header shows "Error saving" status. Retry on next change                                             |
| Upload fails               | Toast with error message. File not added to canvas                                                   |
| Model unavailable          | Fallback to default model. Info toast                                                                |

---

## 15. Naming Conventions

| Entity       | Singular    | Plural       | Collection |
| ------------ | ----------- | ------------ | ---------- |
| Canvas       | Canvas      | Canvases     | `canvases` |
| Canvas Node  | CanvasNode  | CanvasNodes  | —          |
| Chat Message | ChatMessage | ChatMessages | —          |

Route segments use lowercase singular: `/canvas/[id]`, `/api/canvases`.
