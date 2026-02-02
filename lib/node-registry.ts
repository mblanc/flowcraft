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

const getSourceValue = (data: NodeData | null): unknown => {
    if (!data) return null;

    // Robust unwrapping of nested workflow output data wrapper { value: ... }
    // Handles multiple levels of wrapping if they occur
    let unwrappedData: Record<string, unknown> = data as Record<
        string,
        unknown
    >;
    while (
        unwrappedData &&
        unwrappedData.value !== undefined &&
        unwrappedData.type === undefined
    ) {
        unwrappedData = unwrappedData.value as Record<string, unknown>;
    }

    // If it's still a workflow output node, unwrap its value
    if (
        unwrappedData.type === "workflow-output" &&
        unwrappedData.value !== undefined
    ) {
        return getSourceValue(unwrappedData.value as NodeData | null);
    }

    if (unwrappedData.type === "workflow-input") {
        const inputData = unwrappedData as unknown as WorkflowInputData;
        let value: unknown = null;

        // When data from another node (e.g., file node) is passed to a workflow-input,
        // we need to check for various field names that could contain the actual value.
        // File nodes use: fileUrl, gcsUri
        // Image nodes use: images, image
        // Video nodes use: videoUrl
        // Text/LLM nodes use: text, output

        if (inputData.portType === "string") {
            value = unwrappedData.text || unwrappedData.output;
        } else if (inputData.portType === "image") {
            // Check for image data from various sources
            value =
                unwrappedData.images ||
                unwrappedData.image ||
                unwrappedData.gcsUri ||
                unwrappedData.fileUrl;
        } else if (inputData.portType === "video") {
            value =
                unwrappedData.videoUrl ||
                unwrappedData.gcsUri ||
                unwrappedData.fileUrl;
        } else if (inputData.portType === "json") {
            value = unwrappedData.output || unwrappedData.text;
        } else if (inputData.portType === "any") {
            value =
                unwrappedData.text ||
                unwrappedData.images ||
                unwrappedData.image ||
                unwrappedData.videoUrl ||
                unwrappedData.output ||
                unwrappedData.gcsUri ||
                unwrappedData.fileUrl;
        }

        if (value === undefined || value === null) {
            value = unwrappedData.value;
        }

        const finalValue =
            value !== undefined && value !== null
                ? value
                : inputData.portDefaultValue;

        return finalValue;
    }

    if (unwrappedData.type === "text") return (unwrappedData as TextData).text;
    if (unwrappedData.type === "llm") return (unwrappedData as LLMData).output;
    if (unwrappedData.type === "image")
        return (unwrappedData as ImageData).images;
    if (unwrappedData.type === "video")
        return (unwrappedData as VideoData).videoUrl;
    if (unwrappedData.type === "upscale")
        return (unwrappedData as UpscaleData).image;
    if (unwrappedData.type === "resize")
        return (unwrappedData as ResizeData).output;
    if (unwrappedData.type === "file")
        return (unwrappedData as FileData).gcsUri;

    // Fallback for direct values or results from other nodes
    const fallbackValue =
        unwrappedData.images ||
        unwrappedData.videoUrl ||
        unwrappedData.output ||
        unwrappedData.text ||
        unwrappedData.image ||
        unwrappedData.gcsUri ||
        unwrappedData.value;

    if (fallbackValue !== undefined) {
        return fallbackValue;
    }

    // If no known value field found but it's an object that might be the value itself
    // (This happens when passing raw data through sub-workflows)
    if (
        typeof unwrappedData === "object" &&
        unwrappedData !== null &&
        !unwrappedData.type
    ) {
        return unwrappedData;
    }

    return null;
};

// LLM Node
registerNode<LLMData, NodeInputs>({
    type: "llm",
    inputs: {
        "prompts-input": "string",
        "file-input": "any",
    },
    outputs: {
        "": "string", // fallback, actual type handled by getSourcePortType
    },
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: NodeInputs = { files: [], prompts: [] };

        // Gather ALL prompt edges (multiple allowed)
        const promptEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle === "prompts-input",
        );
        for (const edge of promptEdges) {
            const sourceData = getSourceData(edge.source, edge.sourceHandle);
            const value = getSourceValue(sourceData);
            if (typeof value === "string") {
                inputs.prompts?.push(value);
            }
        }

        const fileEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle === "file-input",
        );
        for (const edge of fileEdges) {
            const sourceData = getSourceData(edge.source, edge.sourceHandle);
            if (!sourceData) continue;

            const value = getSourceValue(sourceData);
            if (!value) continue;

            // Handle both arrays (images) and single values (files, strings, etc.)
            const values = Array.isArray(value) ? value : [value];

            for (const item of values) {
                if (typeof item === "string") {
                    let mimeType = "application/octet-stream";
                    const lowerItem = item.toLowerCase();
                    if (lowerItem.endsWith(".pdf"))
                        mimeType = "application/pdf";
                    else if (
                        lowerItem.endsWith(".png") ||
                        lowerItem.endsWith(".jpg") ||
                        lowerItem.endsWith(".jpeg") ||
                        lowerItem.endsWith(".webp")
                    )
                        mimeType = "image/png";
                    else if (
                        lowerItem.endsWith(".mp4") ||
                        lowerItem.endsWith(".mov")
                    )
                        mimeType = "video/mp4";
                    else {
                        // For GCS URIs or files without extensions, use source metadata
                        const srcMeta = sourceData as Record<string, unknown>;
                        if (
                            srcMeta.fileType === "pdf" ||
                            srcMeta.portType === "pdf"
                        )
                            mimeType = "application/pdf";
                        else if (
                            srcMeta.fileType === "image" ||
                            srcMeta.type === "image" ||
                            srcMeta.portType === "image" ||
                            srcMeta.type === "upscale" ||
                            srcMeta.type === "resize"
                        )
                            mimeType = "image/png";
                        else if (
                            srcMeta.fileType === "video" ||
                            srcMeta.type === "video" ||
                            srcMeta.portType === "video"
                        )
                            mimeType = "video/mp4";
                    }

                    inputs.files?.push({
                        url: item,
                        type: mimeType,
                    });
                } else if (
                    typeof item === "object" &&
                    item !== null &&
                    (item as Record<string, unknown>).url
                ) {
                    const itemObj = item as Record<string, unknown>;
                    inputs.files?.push({
                        url: itemObj.url as string,
                        type:
                            (itemObj.type as string) ||
                            "application/octet-stream",
                    });
                }
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
            if (!value) continue;

            const values = Array.isArray(value) ? value : [value];
            for (const item of values) {
                if (typeof item === "string") {
                    inputs.images?.push({
                        url: item,
                        type: item.toLowerCase().endsWith(".pdf")
                            ? "application/pdf"
                            : "image/png",
                    });
                } else if (
                    typeof item === "object" &&
                    item !== null &&
                    (item as Record<string, unknown>).url
                ) {
                    const itemObj = item as Record<string, unknown>;
                    inputs.images?.push({
                        url: itemObj.url as string,
                        type: (itemObj.type as string) || "image/png",
                    });
                }
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
        if (firstFrameValue) {
            const val = Array.isArray(firstFrameValue)
                ? firstFrameValue[0]
                : firstFrameValue;
            if (typeof val === "string") inputs.firstFrame = val;
            else if (
                typeof val === "object" &&
                val !== null &&
                (val as Record<string, unknown>).url
            )
                inputs.firstFrame = (val as Record<string, unknown>)
                    .url as string;
        }

        const lastFrameData = findInputByHandle(
            node.id,
            edges,
            "last-frame-input",
            getSourceData,
        );
        const lastFrameValue = getSourceValue(lastFrameData);
        if (lastFrameValue) {
            const val = Array.isArray(lastFrameValue)
                ? lastFrameValue[0]
                : lastFrameValue;
            if (typeof val === "string") inputs.lastFrame = val;
            else if (
                typeof val === "object" &&
                val !== null &&
                (val as Record<string, unknown>).url
            )
                inputs.lastFrame = (val as Record<string, unknown>)
                    .url as string;
        }

        const imageEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle === "image-input",
        );
        for (const edge of imageEdges) {
            const sourceData = getSourceData(edge.source, edge.sourceHandle);
            if (!sourceData) continue;
            const value = getSourceValue(sourceData);
            if (!value) continue;

            const values = Array.isArray(value) ? value : [value];
            for (const item of values) {
                if (typeof item === "string") {
                    inputs.images?.push({
                        url: item,
                        type: "image/png",
                    });
                } else if (
                    typeof item === "object" &&
                    item !== null &&
                    (item as Record<string, unknown>).url
                ) {
                    const itemObj = item as Record<string, unknown>;
                    inputs.images?.push({
                        url: itemObj.url as string,
                        type: (itemObj.type as string) || "image/png",
                    });
                }
            }
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
        if (value) {
            const val = Array.isArray(value) ? value[0] : value;
            if (typeof val === "string") inputs.image = val;
            else if (
                typeof val === "object" &&
                val !== null &&
                (val as Record<string, unknown>).url
            )
                inputs.image = (val as Record<string, unknown>).url as string;
        }
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
        if (value) {
            const val = Array.isArray(value) ? value[0] : value;
            if (typeof val === "string") inputs.image = val;
            else if (
                typeof val === "object" &&
                val !== null &&
                (val as Record<string, unknown>).url
            )
                inputs.image = (val as Record<string, unknown>).url as string;
        }
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
