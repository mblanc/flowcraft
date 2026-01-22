import { Edge, Node } from "@xyflow/react";
import {
    NodeData,
    NodeType,
    NodeInputs,
    LLMData,
    TextData,
    ImageData,
    VideoData,
    FileData,
    UpscaleData,
    ResizeData,
    WorkflowInputData,
    WorkflowOutputData,
    CustomWorkflowData,
} from "./types";

export interface ExecutionContext {
    onNodeUpdate?: (nodeId: string, data: Partial<NodeData>) => void;
    fetch?: typeof fetch;
}

export type NodeExecutor<T extends NodeData = NodeData, I = NodeInputs> = (
    node: Node<T>,
    inputs: I,
    context?: ExecutionContext,
) => Promise<Partial<T>>;

export interface NodeDefinition<T extends NodeData = NodeData, I = NodeInputs> {
    type: T["type"];
    inputs?: Record<string, string>; // handleId -> type
    outputs?: Record<string, string>; // sourceHandleId -> type (use "" for default)
    gatherInputs: (
        node: Node<T>,
        edges: Edge[],
        getSourceData: (id: string, handle?: string | null) => NodeData | null,
    ) => I;
    execute: NodeExecutor<T, I>;
}

const registry = new Map<NodeType, NodeDefinition<NodeData, NodeInputs>>();

export function registerNode<T extends NodeData, I extends NodeInputs>(
    definition: NodeDefinition<T, I>,
) {
    registry.set(
        definition.type,
        definition as unknown as NodeDefinition<NodeData, NodeInputs>,
    );
}

export function getNodeDefinition<T extends NodeData>(
    type: T["type"],
): NodeDefinition<T, NodeInputs> | undefined {
    return registry.get(type) as NodeDefinition<T, NodeInputs> | undefined;
}

export function getSourcePortType(
    node: Node<NodeData>,
    handleId?: string | null,
): string {
    if (node.data.type === "workflow-input") {
        return (node.data as WorkflowInputData).portType;
    }
    if (node.data.type === "custom-workflow") {
        // Find the sub-workflow output node that matches this handleId
        // In the UI we set the handleId to the original node ID of the Workflow Output node
        // But since we don't have the sub-workflow data here synchronously,
        // we might need to rely on the node.data.interface cache if we implement one.
        // For now, let's assume handles are typed and we might need to store types in data.
        return (
            (node.data as CustomWorkflowData).outputs?.[handleId || ""] || "any"
        );
    }
    if (node.data.type === "llm") {
        return (node.data as LLMData).outputType === "json" ? "json" : "string";
    }
    if (node.data.type === "file") {
        return (node.data as FileData).fileType || "any";
    }
    const def = getNodeDefinition(node.data.type);
    // Source handles are often null for the default output
    const normalizedHandleId = handleId === null ? "" : handleId || "";
    return def?.outputs?.[normalizedHandleId] || "any";
}

export function getTargetPortType(
    node: Node<NodeData>,
    handleId?: string | null,
): string {
    if (node.data.type === "workflow-output") {
        return (node.data as WorkflowOutputData).portType;
    }
    if (node.data.type === "custom-workflow") {
        return (
            (node.data as CustomWorkflowData).inputs?.[handleId || ""] || "any"
        );
    }
    const def = getNodeDefinition(node.data.type);
    const normalizedHandleId = handleId === null ? "" : handleId || "";
    return def?.inputs?.[normalizedHandleId] || "any";
}

// --- Node Definitions ---

// Helper to get source data for a specific handle
const findInputByHandle = (
    nodeId: string,
    edges: Edge[],
    handle: string,
    getSourceData: (id: string, handle?: string | null) => NodeData | null,
) => {
    const edge = edges.find(
        (e) => e.target === nodeId && e.targetHandle === handle,
    );
    if (!edge) return null;
    return getSourceData(edge.source, edge.sourceHandle);
};

const getSourceValue = (data: NodeData | null): any => {
    if (!data) return null;
    if (data.type === "workflow-input") {
        const inputData = data as WorkflowInputData;
        let value: any = null;

        if (inputData.portType === "string") {
            value = (data as any).text || (data as any).output;
        } else if (inputData.portType === "image") {
            value = (data as any).images || (data as any).image;
        } else if (inputData.portType === "video") {
            value = (data as any).videoUrl;
        } else if (inputData.portType === "json") {
            value = (data as any).output || (data as any).text;
        } else if (inputData.portType === "any") {
            value =
                (data as any).text ||
                (data as any).images ||
                (data as any).videoUrl ||
                (data as any).output ||
                (data as any).gcsUri;
        }

        if (value === undefined || value === null) {
            value = (data as any).value;
        }

        return value !== undefined && value !== null
            ? value
            : inputData.portDefaultValue;
    }
    if (data.type === "text") return (data as TextData).text;
    if (data.type === "llm") return (data as LLMData).output;
    if (data.type === "image") return (data as ImageData).images;
    if (data.type === "video") return (data as VideoData).videoUrl;
    if (data.type === "upscale") return (data as UpscaleData).image;
    if (data.type === "resize") return (data as ResizeData).output;
    if (data.type === "file") return (data as FileData).gcsUri;
    return null;
};

// LLM Node
registerNode<LLMData, NodeInputs>({
    type: "llm",
    inputs: {
        "prompt-input": "string",
        "file-input": "any",
    },
    outputs: {
        "": "string", // fallback, actual type handled by getSourcePortType
    },
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: NodeInputs = { files: [] };

        const promptData = findInputByHandle(
            node.id,
            edges,
            "prompt-input",
            getSourceData,
        );
        const promptValue = getSourceValue(promptData);
        if (typeof promptValue === "string") {
            inputs.prompt = promptValue;
        }

        const fileEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle === "file-input",
        );
        for (const edge of fileEdges) {
            const sourceData = getSourceData(edge.source, edge.sourceHandle);
            if (!sourceData) continue;

            if (sourceData.type === "workflow-input") {
                const inputData = sourceData as WorkflowInputData;
                const value = getSourceValue(sourceData);
                if (inputData.portType === "image" && Array.isArray(value)) {
                    for (const url of value) {
                        inputs.files?.push({ url, type: "image/png" });
                    }
                } else if (
                    inputData.portType === "video" &&
                    typeof value === "string"
                ) {
                    inputs.files?.push({ url: value, type: "video/mp4" });
                } else if (
                    inputData.portType === "any" &&
                    typeof value === "string"
                ) {
                    inputs.files?.push({
                        url: value,
                        type: "application/octet-stream",
                    });
                }
            } else if (sourceData.type === "file" && sourceData.gcsUri) {
                let mimeType = "application/octet-stream";
                if (sourceData.fileType === "pdf") mimeType = "application/pdf";
                else if (sourceData.fileType === "image")
                    mimeType = "image/png";
                else if (sourceData.fileType === "video")
                    mimeType = "video/mp4";

                inputs.files?.push({
                    url: sourceData.gcsUri,
                    type: mimeType,
                });
            } else if (sourceData.type === "video" && sourceData.videoUrl) {
                inputs.files?.push({
                    url: sourceData.videoUrl,
                    type: "video/mp4",
                });
            } else if (sourceData.type === "image" && sourceData.images) {
                for (const url of sourceData.images) {
                    inputs.files?.push({
                        url,
                        type: "image/png",
                    });
                }
            } else if (sourceData.type === "upscale" && sourceData.image) {
                inputs.files?.push({
                    url: sourceData.image,
                    type: "image/png",
                });
            } else if (sourceData.type === "resize" && sourceData.output) {
                inputs.files?.push({
                    url: sourceData.output,
                    type: "image/png",
                });
            }
        }
        return inputs;
    },
    execute: async (node, inputs, context) => {
        const { executeLLMNode } = await import("./executors");
        return executeLLMNode(node, inputs, context);
    },
});

// Image Node
registerNode<ImageData, NodeInputs>({
    type: "image",
    inputs: {
        "prompt-input": "string",
        "image-input": "image",
    },
    outputs: {
        "": "image",
    },
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: NodeInputs = { images: [] };

        const promptData = findInputByHandle(
            node.id,
            edges,
            "prompt-input",
            getSourceData,
        );
        const promptValue = getSourceValue(promptData);
        if (typeof promptValue === "string") inputs.prompt = promptValue;

        const imageEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle === "image-input",
        );
        for (const edge of imageEdges) {
            const sourceData = getSourceData(edge.source, edge.sourceHandle);
            if (!sourceData) continue;

            const value = getSourceValue(sourceData);

            if (
                sourceData.type === "workflow-input" &&
                (sourceData as WorkflowInputData).portType === "image" &&
                Array.isArray(value)
            ) {
                inputs.images?.push(
                    ...value.map((url) => ({ url, type: "image/png" })),
                );
            } else if (sourceData.type === "image" && Array.isArray(value)) {
                inputs.images?.push(
                    ...value.map((url) => ({ url, type: "image/png" })),
                );
            } else if (
                (sourceData.type === "file" ||
                    sourceData.type === "workflow-input") &&
                typeof value === "string"
            ) {
                inputs.images?.push({
                    url: value,
                    type:
                        (sourceData as any).fileType === "pdf" ||
                        (sourceData as any).portType === "pdf"
                            ? "application/pdf"
                            : "image/png",
                });
            } else if (
                (sourceData.type === "upscale" ||
                    sourceData.type === "resize") &&
                typeof value === "string"
            ) {
                inputs.images?.push({
                    url: value,
                    type: "image/png",
                });
            }
        }
        return inputs;
    },
    execute: async (node, inputs, context) => {
        const { executeImageNode } = await import("./executors");
        return executeImageNode(node, inputs, context);
    },
});

// Video Node
registerNode<VideoData, NodeInputs>({
    type: "video",
    inputs: {
        "prompt-input": "string",
        "image-input": "image",
        "first-frame-input": "image",
        "last-frame-input": "image",
    },
    outputs: {
        "": "video",
    },
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: NodeInputs = { images: [] };

        const promptData = findInputByHandle(
            node.id,
            edges,
            "prompt-input",
            getSourceData,
        );
        const promptValue = getSourceValue(promptData);
        if (typeof promptValue === "string") inputs.prompt = promptValue;

        const firstFrameData = findInputByHandle(
            node.id,
            edges,
            "first-frame-input",
            getSourceData,
        );
        const firstFrameValue = getSourceValue(firstFrameData);
        if (Array.isArray(firstFrameValue) && firstFrameValue[0])
            inputs.firstFrame = firstFrameValue[0];
        else if (typeof firstFrameValue === "string")
            inputs.firstFrame = firstFrameValue;

        const lastFrameData = findInputByHandle(
            node.id,
            edges,
            "last-frame-input",
            getSourceData,
        );
        const lastFrameValue = getSourceValue(lastFrameData);
        if (Array.isArray(lastFrameValue) && lastFrameValue[0])
            inputs.lastFrame = lastFrameValue[0];
        else if (typeof lastFrameValue === "string")
            inputs.lastFrame = lastFrameValue;

        const imageEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle === "image-input",
        );
        for (const edge of imageEdges) {
            const sourceData = getSourceData(edge.source, edge.sourceHandle);
            if (!sourceData) continue;
            const value = getSourceValue(sourceData);

            if (Array.isArray(value))
                inputs.images?.push(
                    ...value.map((url) => ({
                        url,
                        type: "image/png",
                    })),
                );
            else if (typeof value === "string")
                inputs.images?.push({
                    url: value,
                    type: "image/png",
                });
        }
        return inputs;
    },
    execute: async (node, inputs, context) => {
        const { executeVideoNode } = await import("./executors");
        return executeVideoNode(node, inputs, context);
    },
});

// Upscale Node
registerNode<UpscaleData, NodeInputs>({
    type: "upscale",
    inputs: {
        "image-input": "image",
    },
    outputs: {
        "": "image",
    },
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: NodeInputs = {};
        const imageData = findInputByHandle(
            node.id,
            edges,
            "image-input",
            getSourceData,
        );
        const value = getSourceValue(imageData);
        if (Array.isArray(value) && value[0]) inputs.image = value[0];
        else if (typeof value === "string") inputs.image = value;
        return inputs;
    },
    execute: async (node, inputs, context) => {
        const { executeUpscaleNode } = await import("./executors");
        return executeUpscaleNode(node, inputs, context);
    },
});

// Resize Node
registerNode<ResizeData, NodeInputs>({
    type: "resize",
    inputs: {
        "image-input": "image",
    },
    outputs: {
        "": "image",
    },
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: NodeInputs = {};
        const imageData = findInputByHandle(
            node.id,
            edges,
            "image-input",
            getSourceData,
        );
        const value = getSourceValue(imageData);
        if (Array.isArray(value) && value[0]) inputs.image = value[0];
        else if (typeof value === "string") inputs.image = value;
        return inputs;
    },
    execute: async (node, inputs, context) => {
        const { executeResizeNode } = await import("./executors");
        return executeResizeNode(node, inputs, context);
    },
});

// Workflow Input Node
registerNode<WorkflowInputData, NodeInputs>({
    type: "workflow-input",
    gatherInputs: () => ({}),
    execute: async () => ({}),
});

// Workflow Output Node
registerNode<WorkflowOutputData, NodeInputs>({
    type: "workflow-output",
    gatherInputs: (node, edges, getSourceData) => {
        const edge = edges.find((e) => e.target === node.id);
        if (!edge) return {};
        return { value: getSourceData(edge.source, edge.sourceHandle) };
    },
    execute: async (_node, inputs) => {
        return { ...inputs } as Partial<WorkflowOutputData>;
    },
});

// Custom Workflow Node
registerNode<CustomWorkflowData, NodeInputs>({
    type: "custom-workflow",
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: Record<string, unknown> = {};
        // Find all edges targeting this node
        const inputEdges = edges.filter((e) => e.target === node.id);
        for (const edge of inputEdges) {
            if (edge.targetHandle) {
                inputs[edge.targetHandle] = getSourceData(
                    edge.source,
                    edge.sourceHandle,
                );
            }
        }
        return inputs;
    },
    execute: async () => {
        // Recursive execution handled in WorkflowEngine
        return {};
    },
});

// Text Node
registerNode<TextData, NodeInputs>({
    type: "text",
    outputs: { "": "string" },
    gatherInputs: () => ({}),
    execute: async () => ({}),
});

// File Node
registerNode<FileData, NodeInputs>({
    type: "file",
    outputs: { "": "any" },
    gatherInputs: () => ({}),
    execute: async () => ({}),
});
