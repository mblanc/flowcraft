import {
    LLMData as InferredLLMData,
    TextData as InferredTextData,
    ImageData as InferredImageData,
    VideoData as InferredVideoData,
    FileData as InferredFileData,
    UpscaleData as InferredUpscaleData,
    ResizeData as InferredResizeData,
    WorkflowInputData as InferredWorkflowInputData,
    WorkflowOutputData as InferredWorkflowOutputData,
    CustomWorkflowData as InferredCustomWorkflowData,
    NodeData as InferredNodeData,
} from "./schemas";

// Re-export Firestore document types
export type {
    FlowDocument,
    CustomNodeDocument,
    CustomNodePort,
} from "./firestore";

export type NodeType =
    | "llm"
    | "text"
    | "image"
    | "video"
    | "file"
    | "upscale"
    | "resize"
    | "workflow-input"
    | "workflow-output"
    | "custom-workflow";

export interface NodeInputs {
    prompt?: string;
    prompts?: string[];
    files?: { url: string; type: string }[];
    images?: { url: string; type: string }[];
    firstFrame?: string;
    lastFrame?: string;
    image?: string;
    [key: string]: unknown;
}

export type LLMData = InferredLLMData;
export type TextData = InferredTextData;
export type ImageData = InferredImageData;
export type VideoData = InferredVideoData;
export type FileData = InferredFileData;
export type UpscaleData = InferredUpscaleData;
export type ResizeData = InferredResizeData;
export type WorkflowInputData = InferredWorkflowInputData;
export type WorkflowOutputData = InferredWorkflowOutputData;
export type CustomWorkflowData = InferredCustomWorkflowData;
export type NodeData = InferredNodeData;

export interface BaseNodeData {
    type: NodeType;
    name: string;
    executing?: boolean;
    generatedAt?: number;
    error?: string;
}
