export interface CanvasImageData {
    type: "canvas-image";
    label: string;
    sourceUrl: string;
    mimeType: string;
    prompt?: string;
    width: number;
    height: number;
    aspectRatio?: string;
    model?: string;
    status: "ready" | "generating" | "error";
    error?: string;
    referenceNodeIds?: string[];
    [key: string]: unknown;
}

export interface CanvasVideoData {
    type: "canvas-video";
    label: string;
    sourceUrl: string;
    mimeType: string;
    prompt?: string;
    duration?: number;
    aspectRatio?: string;
    model?: string;
    status: "ready" | "generating" | "error";
    progress?: number;
    error?: string;
    referenceNodeIds?: string[];
    [key: string]: unknown;
}

export interface CanvasTextData {
    type: "canvas-text";
    label: string;
    content: string;
    fontSize?: number;
    width: number;
    height: number;
    [key: string]: unknown;
}

export type CanvasNodeData = CanvasImageData | CanvasVideoData | CanvasTextData;

export interface CanvasNode {
    id: string;
    type: "canvas-image" | "canvas-video" | "canvas-text";
    position: { x: number; y: number };
    data: CanvasNodeData;
    width?: number;
    height?: number;
    selected?: boolean;
}

export interface ChatAttachment {
    nodeId: string;
    label: string;
    type: "canvas-image" | "canvas-video";
    thumbnailUrl?: string;
}

export interface ChatAction {
    id: string;
    label: string;
    prompt: string;
}

export interface GeneratedMediaRef {
    nodeId: string;
    type: "canvas-image" | "canvas-video";
}

export interface ChatMessage {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    attachments?: ChatAttachment[];
    actions?: ChatAction[];
    generatedMedia?: GeneratedMediaRef[];
    model?: string;
    createdAt: string;
}

export interface CanvasDocument {
    id: string;
    userId: string;
    name: string;
    thumbnail?: string;
    nodes: CanvasNode[];
    edges: never[];
    viewport: { x: number; y: number; zoom: number };
    messages: ChatMessage[];
    visibility: "private" | "public";
    sharedWith: string[];
    sharedWithEmails: string[];
    isTemplate: boolean;
    createdAt: string;
    updatedAt: string;
}
