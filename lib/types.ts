import {
    AgentData as InferredAgentData,
    TextData as InferredTextData,
    ImageData as InferredImageData,
    VideoData as InferredVideoData,
    FileData as InferredFileData,
    UpscaleData as InferredUpscaleData,
    ResizeData as InferredResizeData,
    NodeData as InferredNodeData,
} from "./schemas";

export type NodeType =
    | "agent"
    | "text"
    | "image"
    | "video"
    | "file"
    | "upscale"
    | "resize";

export interface NodeInputs {
    prompt?: string;
    files?: { url: string; type: string }[];
    images?: { url: string; type: string }[];
    firstFrame?: string;
    lastFrame?: string;
    image?: string;
}

export type AgentData = InferredAgentData;
export type TextData = InferredTextData;
export type ImageData = InferredImageData;
export type VideoData = InferredVideoData;
export type FileData = InferredFileData;
export type UpscaleData = InferredUpscaleData;
export type ResizeData = InferredResizeData;
export type NodeData = InferredNodeData;

export interface BaseNodeData {
    type: NodeType;
    name: string;
    executing?: boolean;
    generatedAt?: number;
}
