import { Edge, Node } from "@xyflow/react";
import {
    NodeData,
    NodeType,
    NodeInputs,
    LLMData,
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
    type: T["type"];
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

export function getNodeDefinition<T extends NodeData>(
    type: T["type"],
): NodeDefinition<T, NodeInputs> | undefined {
    return registry.get(type) as NodeDefinition<T, NodeInputs> | undefined;
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

// LLM Node
registerNode<LLMData, NodeInputs>({
    type: "llm",
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
            if (!sourceData) continue;

            if (sourceData.type === "file" && sourceData.gcsUri) {
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
            else if (sourceData?.type === "llm")
                inputs.prompt = sourceData.output;
        }

        const imageEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle === "image-input",
        );
        for (const edge of imageEdges) {
            const sourceData = getSourceData(edge.source);
            if (sourceData?.type === "image" && sourceData.images) {
                inputs.images?.push(
                    ...sourceData.images.map((url) => ({
                        url,
                        type: "image/png",
                    })),
                );
            } else if (sourceData?.type === "file" && sourceData.gcsUri) {
                inputs.images?.push({
                    url: sourceData.gcsUri,
                    type:
                        sourceData.fileType === "pdf"
                            ? "application/pdf"
                            : "image/png",
                });
            } else if (sourceData?.type === "upscale" && sourceData.image) {
                inputs.images?.push({
                    url: sourceData.image,
                    type: "image/png",
                });
            } else if (sourceData?.type === "resize" && sourceData.output) {
                inputs.images?.push({
                    url: sourceData.output,
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
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: NodeInputs = { images: [] };

        const promptData = findInputByHandle(
            node.id,
            edges,
            "prompt-input",
            getSourceData,
        );
        if (promptData?.type === "text") inputs.prompt = promptData.text;
        else if (promptData?.type === "llm") inputs.prompt = promptData.output;

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
                inputs.images?.push(
                    ...sourceData.images.map((url) => ({
                        url,
                        type: "image/png",
                    })),
                );
            else if (
                sourceData?.type === "file" &&
                sourceData.fileType === "image" &&
                sourceData.gcsUri
            )
                inputs.images?.push({
                    url: sourceData.gcsUri,
                    type: "image/png",
                });
            else if (sourceData?.type === "upscale" && sourceData.image)
                inputs.images?.push({
                    url: sourceData.image,
                    type: "image/png",
                });
            else if (sourceData?.type === "resize" && sourceData.output)
                inputs.images?.push({
                    url: sourceData.output,
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
        return executeUpscaleNode(node, inputs, context);
    },
});

// Resize Node
registerNode<ResizeData, NodeInputs>({
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
        return executeResizeNode(node, inputs, context);
    },
});
