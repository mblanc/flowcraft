# FlowCraft Project Context

## Project Overview

**FlowCraft** is a visual workflow builder designed for AI-powered content generation. It leverages Google's Gemini AI models to allow users to create complex workflows through a drag-and-drop interface. Users can connect various nodes (Agent, Text, Image, Video, File) to process and generate content in real-time.

**Key Features:**

- **Visual Workflow Builder:** Drag-and-drop interface using `@xyflow/react`.
- **AI Integration:** Deep integration with Google's Gemini models (Gemini 2.0 Flash, Gemini 2.5 Flash, Imagen 4.0, Veo 3.1) via Vertex AI.
- **Execution Engine:** Supports parallel processing and dependency resolution for workflows.
- **Cloud Native:** Built to run on Google Cloud Platform (Cloud Run, Firestore, Cloud Storage).

## Architecture & Technology Stack

### Frontend

- **Framework:** Next.js 15.5.4 (App Router)
- **Language:** TypeScript
- **UI Library:** React 19.1.0, Tailwind CSS 4.1.9, Radix UI
- **Diagramming:** `@xyflow/react` 12.8.6
- **State Management:** React Context (`flow-provider.tsx`)

### Backend (Next.js API Routes)

- **Platform:** Node.js (Next.js serverless functions)
- **AI SDK:** `@google/genai` 1.25.0
- **Storage:** `@google-cloud/storage` (GCS)
- **Database:** `@google-cloud/firestore` (Firestore)
- **Authentication:** `next-auth` (v5 beta) with Google Provider

### Deployment

- **Containerization:** Docker (`Dockerfile`)
- **CI/CD:** Google Cloud Build (`cloudbuild.yaml`)
- **Hosting:** Google Cloud Run
- **Script:** `deploy.sh` handles build and deploy to Cloud Run.

## Building and Running

### Prerequisites

- Node.js 18+
- Google Cloud Project with Vertex AI enabled
- Service Account with appropriate permissions

### Development

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Environment Setup:**
    Create `.env.local` with:
    ```env
    PROJECT_ID=your-project-id
    LOCATION=your-location
    # Plus other variables as seen in deploy.sh or auth.ts
    ```
3.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    Access at `http://localhost:3000`.

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Key Directories and Files

- **`app/`**: Next.js App Router pages and API routes.
    - `app/api/`: Backend logic for AI generation (`generate-text`, `generate-image`, etc.) and auth.
    - `app/flow/[id]/`: Page for viewing/editing a specific workflow.
- **`components/`**: React components.
    - `*-node.tsx`: Individual node components (Agent, Image, Video, etc.).
    - `flow-canvas.tsx`: The main visual editor area.
- **`lib/`**: Core logic and utilities.
    - `workflow-engine.ts`: The execution engine that processes the node graph.
    - `executors.ts`: Implementation of individual node execution logic.
    - `types.ts`: TypeScript definitions for nodes and workflow data.
- **`deploy.sh`**: Script to build and deploy the application to Google Cloud Run.
- **`auth.ts`**: NextAuth.js configuration for Google authentication.

## Development Conventions

- **Styling:** Tailwind CSS is used for styling. UI components often use `shadcn/ui` patterns (Radix UI primitives + Tailwind).
- **Type Safety:** Strict TypeScript usage is encouraged.
- **State Management:** Local state and Context API are used. The workflow state is managed within `FlowProvider`.
- **AI Interaction:** All AI interactions should go through the backend API routes (`app/api/`) to keep secrets secure and manage rate limiting/processing.
