import { BaseNodeDataSchema } from "./schemas";
import { z } from "zod";
import { Edge, Node } from "@xyflow/react";

// Re-export Firestore document types
export type {
    FlowDocument,
    CustomNodeDocument,
    CustomNodePort,
} from "./db/firestore";

export type {
    LLMData,
    TextData,
    ImageData,
    VideoData,
    FileData,
    UpscaleData,
    ResizeData,
    ListData,
    WorkflowInputData,
    WorkflowOutputData,
    CustomWorkflowData,
    RouterData,
    MusicData,
    NodeData,
    SkillCreate,
    SkillUpdate,
} from "./schemas";
import type { NodeData } from "./schemas";

export type NodeType = NodeData["type"];

export type ContentPart =
    | { kind: "text"; text: string }
    | { kind: "uri"; uri: string; mimeType: string }
    | { kind: "base64"; data: string; mimeType: string };

export interface MediaRef {
    url: string;
    type: string;
}

export interface NamedNodeInput {
    nodeId: string;
    name: string;
    textValue: string | null;
    textValues?: string[];
    fileValues: MediaRef[];
    fileValuesList?: MediaRef[][];
}

export interface NodeInputs {
    prompt?: string;
    prompts?: string[];
    files?: MediaRef[];
    images?: MediaRef[];
    firstFrame?: string;
    lastFrame?: string;
    image?: string;
    namedNodes?: NamedNodeInput[];
    [key: string]: unknown;
}

export type BaseNodeData = z.infer<typeof BaseNodeDataSchema> & {
    type: NodeType;
};

export interface ExecutionContext {
    onNodeUpdate?: (nodeId: string, data: Partial<NodeData>) => void;
    fetch?: typeof fetch;
    userId?: string;
    flowId?: string;
    flowName?: string;
    /** Called after a node produces results; responsible for library persistence. */
    onMediaGenerated?: (
        node: Node<NodeData>,
        result: Partial<NodeData>,
    ) => Promise<void>;
    /** Called with GCS URIs to pre-warm the signed-URL cache before UI re-renders. */
    signedUrlPrefetch?: (uris: string[]) => Promise<void>;
}

export type NodeExecutor<T extends NodeData = NodeData, I = NodeInputs> = (
    node: Node<T>,
    inputs: I,
    context?: ExecutionContext,
) => Promise<Partial<T>>;

export interface NodeDefinition<T extends NodeData = NodeData, I = NodeInputs> {
    type: T["type"];
    inputs?: Record<string, string>;
    outputs?: Record<string, string>;
    gatherInputs: (
        node: Node<T>,
        edges: Edge[],
        getSourceData: (id: string, handle?: string | null) => NodeData | null,
    ) => I;
    execute: NodeExecutor<T, I>;
    defaultData?: Partial<T>;
    getSourcePortType?: (node: Node<T>, handleId?: string | null) => string;
    getTargetPortType?: (node: Node<T>, handleId?: string | null) => string;
}
