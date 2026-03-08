import {
    LLMData as InferredLLMData,
    TextData as InferredTextData,
    ImageData as InferredImageData,
    VideoData as InferredVideoData,
    FileData as InferredFileData,
    UpscaleData as InferredUpscaleData,
    ResizeData as InferredResizeData,
    ListData as InferredListData,
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
    | "list"
    | "workflow-input"
    | "workflow-output"
    | "custom-workflow";

export type ContentPart =
    | { kind: "text"; text: string }
    | { kind: "uri"; uri: string; mimeType: string }
    | { kind: "base64"; data: string; mimeType: string };

export interface NamedNodeInput {
    nodeId: string;
    name: string;
    textValue: string | null;
    textValues?: string[];
    fileValues: { url: string; type: string }[];
    fileValuesList?: { url: string; type: string }[][];
}

export interface NodeInputs {
    prompt?: string;
    prompts?: string[];
    files?: { url: string; type: string }[];
    images?: { url: string; type: string }[];
    firstFrame?: string;
    lastFrame?: string;
    image?: string;
    namedNodes?: NamedNodeInput[];
    [key: string]: unknown;
}

export type LLMData = InferredLLMData;
export type TextData = InferredTextData;
export type ImageData = InferredImageData;
export type VideoData = InferredVideoData;
export type FileData = InferredFileData;
export type UpscaleData = InferredUpscaleData;
export type ResizeData = InferredResizeData;
export type ListData = InferredListData;
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
    batchTotal?: number;
    batchProgress?: number;
}
