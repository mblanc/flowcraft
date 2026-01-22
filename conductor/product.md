# Initial Concept

FlowCraft is a visual workflow builder designed for AI-powered content generation. It leverages Google's Gemini AI models to allow users to create complex workflows through a drag-and-drop interface. Users can connect various nodes (LLM, Text, Image, Video, File) to process and generate content in real-time.

## Vision

FlowCraft aims to democratize the creation of complex AI-powered content by providing a visual, intuitive interface for chaining powerful generative models. It transforms the often-technical process of AI orchestration into a creative and accessible workflow.

## Target Audience

The primary users are **Content Creators and Digital Marketers** who need to automate multi-modal content production (text, images, video) without deep technical expertise.

## Core Goals

- **Seamless Orchestration:** Provide a drag-and-drop canvas to effortlessly connect different AI models.
- **Workflow Composability:** Enable users to publish and reuse workflows as modular components (sub-graphs).
- **Rapid Prototyping:** Enable users to quickly build and test content generation pipelines.
- **Google AI Integration:** Deeply integrate with Google's state-of-the-art models (Gemini, Imagen, Veo) via Vertex AI.
- **Multi-modal Support:** LLM nodes natively process text, images, videos, and PDFs for complex analysis.

## Key Features

- **Visual Workflow Canvas:** A drag-and-drop environment for building AI graphs using @xyflow/react.
- **Real-time Execution Tracking:** Visual feedback and progress indicators for nodes during execution.
- **Smart Execution Engine:** Automatic dependency resolution and parallel processing for optimal performance.
- **Extensible Node Library:** Support for LLM (Text/JSON structured output with multi-modal inputs), Text, Image (Imagen), Video (Veo), and File nodes.
- **Sub-Graph Architecture:** "Workflow as a Function" abstraction with strict typing, immutable versioning, and a searchable gallery.

## User Experience (UX)

FlowCraft prioritizes an **Intuitive & Creative** experience. The interface is clean and accessible, emphasizing ease of use and creative exploration over technical complexity. It provides sensible defaults while allowing for necessary customization.
