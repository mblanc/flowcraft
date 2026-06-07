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
    status: "pending" | "ready" | "generating" | "error";
    error?: string;
    referenceNodeIds?: string[];
    styleId?: string;
    styleName?: string;
    /** Director plan lineage — set when created from a PlanNode */
    operation?: MediaOperation;
    planNodeId?: string;
    derivedFrom?: string[];
    skill?: string;
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
    status: "pending" | "ready" | "generating" | "error";
    progress?: number;
    error?: string;
    referenceNodeIds?: string[];
    width?: number;
    height?: number;
    styleId?: string;
    styleName?: string;
    /** Director plan lineage — set when created from a PlanNode */
    operation?: MediaOperation;
    planNodeId?: string;
    derivedFrom?: string[];
    skill?: string;
    [key: string]: unknown;
}

export interface CanvasTextData {
    type: "canvas-text";
    label: string;
    content: string;
    format?: "scenario" | "synopsis" | "brief" | "notes";
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
    type: "canvas-image" | "canvas-video" | "canvas-text";
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

export type StepStatus = "pending" | "generating" | "done" | "error";

export interface GenerationStep {
    id: string;
    type: "image" | "video" | "concat";
    prompt: string;
    label?: string;
    aspectRatio?: string;
    /** Image size — only for image steps: "512" | "1K" | "2K" | "4K" */
    imageSize?: string;
    /** Video resolution — only for video steps: "720p" | "1080p" | "4K" */
    resolution?: string;
    model?: string;
    duration?: number;
    generateAudio?: boolean;
    /** Existing canvas node IDs to use as generic references */
    referenceNodeIds?: string[];
    /** Existing canvas node ID to use as video first frame */
    firstFrameNodeId?: string;
    /** Existing canvas node ID to use as video last frame */
    lastFrameNodeId?: string;
    /** Step IDs within this plan whose output to use as references */
    dependsOn?: string[];
}

export interface AgentPlan {
    steps: GenerationStep[];
}

export interface NodePayload {
    id: string;
    type: "canvas-image" | "canvas-video";
    label: string;
    sourceUrl: string;
    mimeType?: string;
    prompt: string;
    aspectRatio?: string;
    /** Image size — only for canvas-image: "512" | "1K" | "2K" | "4K" */
    imageSize?: string;
    /** Video resolution — only for canvas-video: "720p" | "1080p" | "4K" */
    resolution?: string;
    model?: string;
    referenceNodeIds?: string[];
    styleId?: string;
    styleName?: string;
    /** Director plan lineage — set when created from a PlanNode */
    operation?: MediaOperation;
    planNodeId?: string;
    derivedFrom?: string[];
    skill?: string;
}

export type PlanStatus = "pending_approval" | "approved" | "cancelled";

export type DirectorLogEntry =
    | { type: "thought"; text: string }
    | { type: "action"; label: string };

export interface ChatMessage {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    attachments?: ChatAttachment[];
    actions?: ChatAction[];
    generatedMedia?: GeneratedMediaRef[];
    plan?: AgentPlan;
    planStatus?: PlanStatus;
    model?: string;
    directorLog?: DirectorLogEntry[];
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
    activeStyleId?: string;
    createdAt: string;
    updatedAt: string;
}

export type CanvasMode = "auto" | "image" | "video";

export interface MediaDefaults {
    model?: string;
    aspectRatio?: string;
    imageSize?: string;
}

export interface VideoDefaults {
    model?: string;
    aspectRatio?: string;
    resolution?: string;
    duration?: number;
    generateAudio?: boolean;
}

export interface AgentInput {
    message: string;
    attachments?: ChatAttachment[];
    mode: "auto" | "image" | "video";
    model?: string;
    history: ChatMessage[];
    canvasNodes: CanvasNode[];
    imageDefaults?: MediaDefaults;
    videoDefaults?: VideoDefaults;
    activeStyle?: { name: string; content: string } | null;
    canvasId?: string;
    userId?: string;
    sessionId?: string;
}

export interface TextNodePayload {
    id: string;
    title: string;
    content: string;
    format?: string;
}

export type AgentEvent =
    | { type: "text"; delta: string }
    | { type: "thought"; delta: string }
    | { type: "agent_action"; label: string }
    | { type: "plan"; plan: AgentPlan }
    | { type: "actions"; actions: ChatAction[] }
    | { type: "text_nodes"; nodes: TextNodePayload[] }
    | { type: "error"; message: string }
    | { type: "done" };

// --- Production Plan types (Agent B / Director architecture) ---

export const MEDIA_OPERATIONS = [
    "t2i",
    "i2i",
    "t2v",
    "i2v",
    "i2v2",
    "t2s",
    "t2m",
    "sfx",
    "concat",
    "edit",
    "upscale",
] as const;

export type MediaOperation = (typeof MEDIA_OPERATIONS)[number];

export const EDGE_ROLES = ["depends_on", "style_ref", "subject_ref"] as const;

export type EdgeRole = (typeof EDGE_ROLES)[number];

export interface PlanNode {
    id: string;
    operation: MediaOperation;
    /** Plain-language intent; filled by Director */
    promptIntent: string;
    /** Fully-engineered prompt; filled by PromptEngineer */
    prompt?: string;
    label?: string;
    aspectRatio?: string;
    /** Image size — only for image operations: "512" | "1K" | "2K" | "4K" */
    imageSize?: string;
    /** Video resolution — only for video operations: "720p" | "1080p" | "4K" */
    resolution?: string;
    model?: string;
    duration?: number;
    generateAudio?: boolean;
    skill?: string;
}

export interface PlanEdge {
    from: string;
    to: string;
    role: EdgeRole;
}

export interface ProductionPlan {
    nodes: PlanNode[];
    edges: PlanEdge[];
    clarifications?: string[];
}

/** PlanNode with prompt guaranteed non-optional */
export interface ResolvedPlanNode extends PlanNode {
    prompt: string;
}
