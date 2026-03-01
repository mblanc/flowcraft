# FlowCraft

A visual workflow builder for AI-powered content generation using Google's Gemini AI models. FlowCraft allows you to create complex workflows by connecting different types of nodes to generate text, images, and videos through an intuitive drag-and-drop interface.

## 🚀 Features

### Core Functionality

- **Visual Workflow Builder**: Drag-and-drop interface for creating scalable AI workflows using `@xyflow/react`
- **Generative AI Integration**: First-class support for Gemini (3 Pro, 3 Flash), Nano Banana Pro, and Veo 3.1
- **Real-time Execution**: Run individual nodes or full workflows with visual feedback and progress tracking
- **Parallel Processing Engine**: Automatic dependency resolution and smart execution paths
- **Cloud Native**: Infrastructure managed via Terraform, provisioning Cloud Run, Firestore, GCS, and Secret Manager.
- **Custom Nodes & Sharing**: Convert sub-workflows into custom reusable nodes, and share workflows with public or restricted access via email authentication (NextAuth).

### Built-in Nodes

- **🤖 LLM (Agent) Node**: Gemini-powered text generation supporting text and files, configurable tools, instructions, strict JSON output, and a visual schema builder.
- **🖼️ Image Node**: Generates images using Gemini 3 Pro Image Preview (Nano Banana Pro) or Gemini 2.5 Flash Image (Nano Banana). Configurable aspect ratios, referencing, and resolutions.
- **🎬 Video Node**: Powered by Veo 3.1 (Fast and Pro models). Generates videos (4, 6, or 8 seconds) given text prompts and optionally a first/last frame or reference images from connected nodes.
- **📁 File Node**: Manages and previews files including PDFs, Images, and Videos, which can be connected to LLM and Vision nodes via Google Cloud Storage URIs.
- **📝 Text Node**: Simple multi-line text input for prompts and instructions.
- **✨ Upscale Node**: Upscale generated images up to 4x using Imagen 4.0.
- **📐 Resize Node**: Intelligently resize or crop images to new aspect ratios.
- **🧩 Custom Workflow Node**: Embed previously saved flows as modular custom nodes.
- **🚪 Input / Output Nodes**: Define the data boundaries for Custom Workflows.

### Advanced Features

- **Smart Execution**: The `workflow-engine.ts` handles execution graphs recursively.
- **Dynamic Config Panel**: Tweak specific parameters like the Generation Model, System Instructions, Video duration, or Media Resolution instantly on the sidebar.
- **Built-in Authentication**: Login securely using Google OAuth via `next-auth@beta`.
- **Media Viewer**: Review generated assets natively from within the graph.

## 🛠️ Technology Stack

### Frontend

- **Next.js 16.1** - React framework (App Router)
- **React 19** - UI Component generation
- **TypeScript** - Strict Static Typing
- **Tailwind CSS 4.1.18** - Utility-first styling with modern CSS variables
- **@xyflow/react 12.10** - Powerful node-based graph rendering
- **shadcn/ui** (Radix UI + Tailwind) - Accessible component primitives
- **Zustand** - Client-side state management for workflows

### Backend

- **Node.js (Next.js serverless functions)**
- **Google GenAI SDK** - Core interactions with Vertex AI
- **Terraform** - Infrastructure as Code (IaC) for reproducible deployments
- **Google Cloud Run** - Containerized App Hosting
- **Google Cloud Storage** - Artifact / Asset Storage
- **Google Cloud Firestore** - NoSQL Database for robust, real-time sync
- **Winston** - Standardized scalable logging

### Supported AI Models

- **Text:** `gemini-3-pro-preview`, `gemini-3-flash-preview`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`
- **Image:** `imagen-4.0-upscale-preview`, `gemini-2.5-flash-image`, `gemini-3-pro-image-preview`
- **Video:** `veo-3.1-fast-generate-preview`, `veo-3.1-generate-preview`

## 📋 Prerequisites

- Node.js 18+
- npm or yarn or pnpm
- Google Cloud Project with Vertex AI enabled
- Firebase/Firestore database configured
- GCS bucket available for file stashing

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd flowcraft
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env.local` file in the root directory:

```env
PROJECT_ID="your-google-cloud-project-id"
LOCATION="your-preferred-location"
FIRESTORE_DATABASE_ID="your-firestore-db"
GCS_STORAGE_URI="gs://your-bucket/"
NEXT_AUTH_URL="http://localhost:3000"
AUTH_SECRET="your-super-secret-random-string-generated-with-openssl"
AUTH_GOOGLE_ID="oauth-id"
AUTH_GOOGLE_SECRET="oauth-secret"
AUTH_TRUST_HOST="true"
```

### 4. Google Cloud Setup

1. Create a Google Cloud Project.
2. Ensure you have the [Terraform CLI](https://developer.hashicorp.com/terraform/downloads) installed.
3. Authenticate with Google Cloud:
   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```
4. Terraform will handle API enablement and IAM permissions during deployment.

### 5. Run the Local Validation & Dev Server

Make sure you pass all tests, linting, and formatting checks:

```bash
npm run preflight
npm run dev
```

Access at [http://localhost:3000](http://localhost:3000).

## 🎯 Usage

### Creating Your First Workflow

1. **Add Nodes**: Use the top-left sidebar to add `Text` and `LLM` nodes.
2. **Connect**: Drag from the `Text` output port to the `LLM` input prompt port.
3. **Configure**: Click on the `LLM` node to open the configuration panel (right side) to select `gemini-2.5-pro` and provide system instructions.
4. **Execute**: Either right-click the node to select "Run from here" or click the "Run Flow" play button in the header.

### Complex Multi-modal Examples

- **Text → Agent → Image**: Chain the output stream of a Gemini 2.5 Pro text brainstorming agent into the prompt feed of an Imagen 4.0 block.
- **Image → Resize → Video**: Take an original 16:9 generated asset, force a Resize to 9:16 to fit a TikTok video, then pass it as a _First Frame_ input into Veo 3.1.
- **File → Custom Workflow**: Provide a long PDF to your custom specialized Summarizer Node that internally executes map-reduce sub-flows.

## 📁 Project Structure

```
flowcraft/
├── app/
│   ├── api/               # Next.js Serverless Routes (AI generation, Auth, URLs)
│   ├── flow/[id]/         # Editor View logic
│   ├── globals.css        # Tailwind configurations
│   ├── layout.tsx         # Root layout and Providers
│   └── page.tsx           # Dashboard / Homepage
├── components/
│   ├── ui/                # shadcn/ui React reusable components
│   ├── *-node.tsx         # The specific implementation of all Node UI views
│   ├── flow-canvas.tsx    # Core React Flow Context component
│   └── sidebars & headers # Application structural UI
├── lib/
│   ├── services/          # Next.js backend wrappers (gemini, firestore, storage)
│   ├── store/             # Zustand flow execution and edge logic
│   ├── node-*.tsx         # Factory and Registry mappers for Extensibility
│   ├── executors.ts       # Main interaction layer with the Vertex API
│   ├── schemas.ts         # Zod definitions ensuring strictly typed JSON across DB and API
│   ├── workflow-engine.ts # Parallel runner and topological sorter
│   └── types.ts           # Typescript interfaces
├── package.json
├── terraform/             # Terraform infrastructure definitions
└── scripts/
    └── deploy.sh          # Orchestrated Terraform deployment script
```

## 🚀 Deployment

The project uses Terraform to provision and manage its infrastructure. A helper script is provided to simplify the process.

1. **Configure Variables**:
   Copy the template and fill in your project details:
   ```bash
   cp terraform/terraform.tfvars.template terraform/terraform.tfvars
   ```
   Edit `terraform/terraform.tfvars` with your `project_id`, OAuth credentials, and other secrets.

2. **Run the Deployment**:
   ```bash
   ./scripts/deploy.sh
   ```
   This script will initialize Terraform, create a build plan, and apply it to provision all necessary GCP resources, build the Docker image via Cloud Build, and deploy to Cloud Run.

## 🤝 Contributing

1. Fork the repository
2. Create your branch (`git checkout -b feature/amazing-feature`)
3. Pass validation (`npm run preflight`)
4. Commit your changes (`git commit -m 'Add some amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 📝 License

This project is licensed under the Apache 2.0 License - see the `LICENSE` file for details.

## 🙏 Acknowledgments

- **Google DeepMind** for Vertex AI multimodal model endpoints.
- **React Flow** team for the excellent structural tools.
- **shadcn** for best-in-class Radix UI wrappers.

---

**FlowCraft** - Where creativity meets AI workflow automation 🎨✨
