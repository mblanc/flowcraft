import { Edge, Node } from "@xyflow/react";
import {
    NodeData,
    NodeType,
    NodeInputs,
    AgentData,
    ImageData,
    VideoData,
    UpscaleData,
    ResizeData,
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
    type: NodeType;
    gatherInputs: (
        node: Node<T>,
        edges: Edge[],
        getSourceData: (id: string) => NodeData | null,
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

export function getNodeDefinition(
    type: NodeType,
): NodeDefinition<NodeData, NodeInputs> | undefined {
    return registry.get(type);
}

// --- Node Definitions ---

// Helper to get source data for a specific handle
const findInputByHandle = (
    nodeId: string,
    edges: Edge[],
    handle: string,
    getSourceData: (id: string) => NodeData | null,
) => {
    const edge = edges.find(
        (e) => e.target === nodeId && e.targetHandle === handle,
    );
    if (!edge) return null;
    return getSourceData(edge.source);
};

// Agent Node
registerNode({
    type: "agent",
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: NodeInputs = { files: [] };

        const promptData = findInputByHandle(
            node.id,
            edges,
            "prompt-input",
            getSourceData,
        );
        if (promptData?.type === "text") {
            inputs.prompt = promptData.text;
        }

        const fileEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle === "file-input",
        );
        for (const edge of fileEdges) {
            const sourceData = getSourceData(edge.source);
            if (sourceData?.type === "file" && sourceData.gcsUri) {
                inputs.files?.push({
                    url: sourceData.gcsUri,
                    type: sourceData.fileType || "image",
                });
            } else if (sourceData?.type === "resize" && sourceData.output) {
                inputs.files?.push({
                    url: sourceData.output,
                    type: "image",
                });
            }
        }
        return inputs;
    },
    execute: async (node, inputs, context) => {
        const { executeAgentNode } = await import("./executors");
        return executeAgentNode(
            node as unknown as Node<AgentData>,
            inputs,
            context,
        );
    },
});

// Image Node
registerNode({
    type: "image",
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: NodeInputs = { images: [] };

        const promptEdge = edges.find(
            (e) =>
                e.target === node.id &&
                (!e.targetHandle || e.targetHandle !== "image-input"),
        );
        if (promptEdge) {
            const sourceData = getSourceData(promptEdge.source);
            if (sourceData?.type === "text") inputs.prompt = sourceData.text;
            else if (sourceData?.type === "agent")
                inputs.prompt = sourceData.output;
        }

        const imageEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle === "image-input",
        );
        for (const edge of imageEdges) {
            const sourceData = getSourceData(edge.source);
            if (sourceData?.type === "image" && sourceData.images) {
                inputs.images?.push(...sourceData.images);
            } else if (
                sourceData?.type === "file" &&
                sourceData.fileType === "image" &&
                sourceData.gcsUri
            ) {
                inputs.images?.push(sourceData.gcsUri);
            } else if (sourceData?.type === "upscale" && sourceData.image) {
                inputs.images?.push(sourceData.image);
            } else if (sourceData?.type === "resize" && sourceData.output) {
                inputs.images?.push(sourceData.output);
            }
        }
        return inputs;
    },
    execute: async (node, inputs, context) => {
        const { executeImageNode } = await import("./executors");
        return executeImageNode(
            node as unknown as Node<ImageData>,
            inputs,
            context,
        );
    },
});

// Video Node
registerNode({
    type: "video",
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: NodeInputs = { images: [] };

        const promptData = findInputByHandle(
            node.id,
            edges,
            "prompt-input",
            getSourceData,
        );
        if (promptData?.type === "text") inputs.prompt = promptData.text;
        else if (promptData?.type === "agent")
            inputs.prompt = promptData.output;

        const firstFrameData = findInputByHandle(
            node.id,
            edges,
            "first-frame-input",
            getSourceData,
        );
        if (firstFrameData?.type === "image" && firstFrameData.images?.[0])
            inputs.firstFrame = firstFrameData.images[0];
        else if (
            firstFrameData?.type === "file" &&
            firstFrameData.fileType === "image" &&
            firstFrameData.gcsUri
        )
            inputs.firstFrame = firstFrameData.gcsUri;
        else if (firstFrameData?.type === "upscale" && firstFrameData.image)
            inputs.firstFrame = firstFrameData.image;
        else if (firstFrameData?.type === "resize" && firstFrameData.output)
            inputs.firstFrame = firstFrameData.output;

        const lastFrameData = findInputByHandle(
            node.id,
            edges,
            "last-frame-input",
            getSourceData,
        );
        if (lastFrameData?.type === "image" && lastFrameData.images?.[0])
            inputs.lastFrame = lastFrameData.images[0];
        else if (
            lastFrameData?.type === "file" &&
            lastFrameData.fileType === "image" &&
            lastFrameData.gcsUri
        )
            inputs.lastFrame = lastFrameData.gcsUri;
        else if (lastFrameData?.type === "upscale" && lastFrameData.image)
            inputs.lastFrame = lastFrameData.image;
        else if (lastFrameData?.type === "resize" && lastFrameData.output)
            inputs.lastFrame = lastFrameData.output;

        const imageEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle === "image-input",
        );
        for (const edge of imageEdges) {
            const sourceData = getSourceData(edge.source);
            if (sourceData?.type === "image" && sourceData.images)
                inputs.images?.push(...sourceData.images);
            else if (
                sourceData?.type === "file" &&
                sourceData.fileType === "image" &&
                sourceData.gcsUri
            )
                inputs.images?.push(sourceData.gcsUri);
            else if (sourceData?.type === "upscale" && sourceData.image)
                inputs.images?.push(sourceData.image);
            else if (sourceData?.type === "resize" && sourceData.output)
                inputs.images?.push(sourceData.output);
        }
        return inputs;
    },
    execute: async (node, inputs, context) => {
        const { executeVideoNode } = await import("./executors");
        return executeVideoNode(
            node as unknown as Node<VideoData>,
            inputs,
            context,
        );
    },
});

// Upscale Node
registerNode({
    type: "upscale",
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: NodeInputs = {};
        const imageData = findInputByHandle(
            node.id,
            edges,
            "image-input",
            getSourceData,
        );
        if (imageData?.type === "image" && imageData.images?.[0])
            inputs.image = imageData.images[0];
        else if (
            imageData?.type === "file" &&
            imageData.fileType === "image" &&
            imageData.gcsUri
        )
            inputs.image = imageData.gcsUri;
        else if (imageData?.type === "upscale" && imageData.image)
            inputs.image = imageData.image;
        else if (imageData?.type === "resize" && imageData.output)
            inputs.image = imageData.output;
        return inputs;
    },
    execute: async (node, inputs, context) => {
        const { executeUpscaleNode } = await import("./executors");
        return executeUpscaleNode(
            node as unknown as Node<UpscaleData>,
            inputs,
            context,
        );
    },
});

// Resize Node
registerNode({
    type: "resize",
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: NodeInputs = {};
        const imageData = findInputByHandle(
            node.id,
            edges,
            "image-input",
            getSourceData,
        );
        if (imageData?.type === "image" && imageData.images?.[0])
            inputs.image = imageData.images[0];
        else if (
            imageData?.type === "file" &&
            imageData.fileType === "image" &&
            imageData.gcsUri
        )
            inputs.image = imageData.gcsUri;
        else if (imageData?.type === "upscale" && imageData.image)
            inputs.image = imageData.image;
        else if (imageData?.type === "resize" && imageData.output)
            inputs.image = imageData.output;
        return inputs;
    },
    execute: async (node, inputs, context) => {
        const { executeResizeNode } = await import("./executors");
        return executeResizeNode(
            node as unknown as Node<ResizeData>,
            inputs,
            context,
        );
    },
});
