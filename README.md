# FlowCraft

A visual workflow builder for AI-powered content generation using Google's Gemini AI models. FlowCraft allows you to create complex workflows by connecting different types of nodes to generate text, images, and videos through an intuitive drag-and-drop interface.

## 🚀 Features

### Core Functionality
- **Visual Workflow Builder**: Drag-and-drop interface for creating AI workflows
- **Multiple Node Types**: Support for Agent, Text, Image, Video, and File nodes
- **Real-time Execution**: Run workflows with visual feedback and progress tracking
- **Parallel Processing**: Automatic dependency resolution for optimal execution
- **Export/Import**: Save and share workflows as JSON files

### Node Types

#### 🤖 Agent Node
- Powered by Google Gemini models (Gemini 2.0 Flash, Gemini 2.5 Flash)
- Multi-modal input support (text + files)
- Configurable tools and instructions
- Real-time text generation

#### 📝 Text Node
- Simple text input/output
- Can be used as prompts for other nodes
- Supports multi-line text editing

#### 🖼️ Image Node
- Multiple AI models: Gemini 2.5 Flash Image, Imagen 4.0 variants
- Configurable aspect ratios (16:9, 9:16)
- Resolution options (1K, 2K)
- Support for reference images and prompts

#### 🎬 Video Node
- Powered by Veo 3.1 models (Fast and Standard)
- Configurable duration (4, 6, 8 seconds)
- First/last frame control
- Audio generation toggle
- Resolution options (720p, 1080p)

#### 📁 File Node
- Upload and manage files (images, videos)
- Drag-and-drop file support
- Base64 encoding for seamless integration

### Advanced Features
- **Smart Execution**: Automatic dependency resolution and parallel processing
- **Visual Feedback**: Real-time execution status with animations
- **Node Configuration**: Comprehensive settings panel for each node type
- **Workflow Management**: Export/import functionality for sharing workflows

## 🛠️ Technology Stack

### Frontend
- **Next.js 15.5.4** - React framework with App Router
- **React 19.1.0** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 4.1.9** - Styling
- **@xyflow/react 12.8.6** - Flow diagram library
- **Radix UI** - Accessible component primitives
- **Lucide React** - Icon library

### Backend
- **Google GenAI SDK 1.25.0** - AI model integration
- **Vertex AI** - Google Cloud AI platform
- **Next.js API Routes** - Server-side functionality

### AI Models
- **Gemini 2.0 Flash** - Text generation
- **Gemini 2.5 Flash** - Text and image generation
- **Imagen 4.0** - Image generation (Generate, Fast, Ultra variants)
- **Veo 3.1** - Video generation (Fast and Standard variants)

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Google Cloud Project with Vertex AI enabled
- Google Cloud credentials configured

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
GEMINI_PROJECT_ID=your-google-cloud-project-id
GEMINI_LOCATION=your-preferred-location
```

### 4. Google Cloud Setup
1. Create a Google Cloud Project
2. Enable the Vertex AI API
3. Create a service account with Vertex AI permissions
4. Download the service account key JSON file
5. Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to your key file

### 5. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🎯 Usage

### Creating Your First Workflow

1. **Add Nodes**: Click the node buttons in the top-left panel to add different types of nodes
2. **Connect Nodes**: Drag from output handles to input handles to create connections
3. **Configure Nodes**: Click on a node to open the configuration panel on the right
4. **Run Workflow**: Click the "Run Flow" button to execute your workflow

### Node Connections

- **Text → Agent**: Use text as instructions for the agent
- **Agent → Image**: Use agent output as image prompts
- **Image → Video**: Use images as reference or first/last frames
- **File → Any**: Upload files to use as inputs

### Example Workflows

#### Simple Text-to-Image
1. Add a Text node and enter your prompt
2. Add an Image node
3. Connect Text output to Image input
4. Configure the Image node settings
5. Run the workflow

#### Advanced Video Generation
1. Add a Text node for the video prompt
2. Add an Image node for the first frame
3. Add a Video node
4. Connect Text to Video (prompt input)
5. Connect Image to Video (first frame input)
6. Configure video settings and run

## 🔧 Configuration

### Agent Node Configuration
- **Model Selection**: Choose between Gemini 2.0 Flash and Gemini 2.5 Flash
- **Instructions**: Set system instructions for the agent
- **Tools**: Add and configure various tools (Google Search, Code Execution, etc.)

### Image Node Configuration
- **Model**: Select from Gemini 2.5 Flash Image or Imagen 4.0 variants
- **Aspect Ratio**: Choose between 16:9 and 9:16
- **Resolution**: Select 1K or 2K resolution
- **Prompt**: Enter image generation prompt

### Video Node Configuration
- **Model**: Choose between Veo 3.1 Fast and Standard
- **Duration**: Set video length (4, 6, or 8 seconds)
- **Aspect Ratio**: Select 16:9 or 9:16
- **Audio**: Toggle audio generation
- **Resolution**: Choose 720p or 1080p

## 📁 Project Structure

```
flowcraft/
├── app/
│   ├── api/
│   │   ├── generate-text/     # Text generation API
│   │   ├── generate-image/    # Image generation API
│   │   └── generate-video/    # Video generation API
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                    # Reusable UI components
│   ├── agent-node.tsx         # Agent node component
│   ├── text-node.tsx          # Text node component
│   ├── image-node.tsx         # Image node component
│   ├── video-node.tsx         # Video node component
│   ├── file-node.tsx          # File node component
│   ├── flow-canvas.tsx        # Main canvas component
│   ├── flow-provider.tsx      # State management
│   ├── config-panel.tsx       # Node configuration panel
│   ├── header.tsx            # Application header
│   └── sidebar.tsx           # Configuration sidebar
├── lib/
│   └── utils.ts              # Utility functions
└── public/                   # Static assets
```

## 🚀 Deployment

### Vercel Deployment
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Environment Variables for Production
```env
GEMINI_PROJECT_ID=your-project-id
GEMINI_LOCATION=your-location
GOOGLE_APPLICATION_CREDENTIALS=path-to-service-account-key
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google AI for providing the Gemini and Veo models
- The React Flow team for the excellent flow diagram library
- Radix UI for accessible component primitives
- The Next.js team for the amazing framework

## 📞 Support

If you encounter any issues or have questions, please:
1. Check the [Issues](https://github.com/your-repo/issues) page
2. Create a new issue with detailed information
3. Join our community discussions

---

**FlowCraft** - Where creativity meets AI workflow automation 🎨✨