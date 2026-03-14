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
    ListData,
    WorkflowInputData,
    WorkflowOutputData,
    CustomWorkflowData,
    NamedNodeInput,
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
    if (node.data.type === "list") {
        return `collection:${(node.data as ListData).itemType}`;
    }
    if (node.data.type === "workflow-input") {
        return (node.data as WorkflowInputData).portType;
    }
    if (node.data.type === "custom-workflow") {
        return (
            (node.data as CustomWorkflowData).outputs?.[handleId || ""] || "any"
        );
    }
    if (node.data.type === "llm") {
        const baseType = "text";
        if (node.data.batchTotal && node.data.batchTotal > 0) {
            return `collection:${baseType}`;
        }
        return baseType;
    }
    if (node.data.type === "file") {
        return (node.data as FileData).fileType || "any";
    }
    const def = getNodeDefinition(node.data.type);
    const outputs = def?.outputs || {};
    const normalizedHandleId = handleId === null ? "" : handleId || "";

    let baseType: string;
    if (normalizedHandleId === "" && Object.keys(outputs).length === 1) {
        baseType = Object.values(outputs)[0];
    } else {
        baseType = outputs[normalizedHandleId] || "any";
    }

    if (node.data.batchTotal && node.data.batchTotal > 0) {
        return `collection:${baseType}`;
    }

    return baseType;
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
    const inputs = def?.inputs || {};
    const normalizedHandleId = handleId === null ? "" : handleId || "";

    // If handleId is empty and there's only one input, use it
    if (normalizedHandleId === "" && Object.keys(inputs).length === 1) {
        return Object.values(inputs)[0];
    }

    return inputs[normalizedHandleId] || "any";
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

/**
 * Returns true when the source node produced a collection (either a List node
 * or any node that ran in batch mode).  Downstream gatherInputs uses this to
 * populate textValues / fileValuesList so the unfold engine can iterate.
 */
function isCollectionSource(sourceData: NodeData | null): boolean {
    if (!sourceData) return false;
    if (sourceData.type === "list") return true;
    return !!(sourceData.batchTotal && sourceData.batchTotal > 0);
}

const getSourceValue = (data: NodeData | null): unknown => {
    if (!data) return null;

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

    if (
        unwrappedData.type === "workflow-output" &&
        unwrappedData.value !== undefined
    ) {
        return getSourceValue(unwrappedData.value as NodeData | null);
    }

    if (unwrappedData.type === "workflow-input") {
        const inputData = unwrappedData as unknown as WorkflowInputData;
        let value: unknown = null;

        if (inputData.portType === "text") {
            value = unwrappedData.text || unwrappedData.output;
        } else if (inputData.portType === "image") {
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
        } else if (inputData.portType === "any") {
            value =
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

    const isBatch = !!(
        unwrappedData.batchTotal && (unwrappedData.batchTotal as number) > 0
    );

    if (unwrappedData.type === "text") return (unwrappedData as TextData).text;
    if (unwrappedData.type === "llm") {
        const llm = unwrappedData as unknown as LLMData;
        if (isBatch && llm.outputs && llm.outputs.length > 1)
            return llm.outputs;
        return llm.output;
    }
    if (unwrappedData.type === "image")
        return (unwrappedData as ImageData).images;
    if (unwrappedData.type === "video") {
        const vid = unwrappedData as unknown as VideoData;
        if (isBatch && vid.videoUrls && vid.videoUrls.length > 1)
            return vid.videoUrls;
        return vid.videoUrl;
    }
    if (unwrappedData.type === "upscale") {
        const up = unwrappedData as unknown as UpscaleData;
        if (isBatch && up.images && up.images.length > 1) return up.images;
        return up.image;
    }
    if (unwrappedData.type === "resize") {
        const rs = unwrappedData as unknown as ResizeData;
        if (isBatch && rs.outputs && rs.outputs.length > 1) return rs.outputs;
        return rs.output;
    }
    if (unwrappedData.type === "list") return (unwrappedData as ListData).items;
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

/**
 * Infers MIME type for a URL string using extension and source node metadata.
 */
function inferMimeType(url: string, sourceData: NodeData | null): string {
    const lower = url.toLowerCase();
    if (lower.endsWith(".pdf")) return "application/pdf";
    if (
        lower.endsWith(".png") ||
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".webp")
    )
        return "image/png";
    if (lower.endsWith(".mp4") || lower.endsWith(".mov")) return "video/mp4";

    const meta = sourceData as Record<string, unknown> | null;
    if (meta) {
        if (meta.fileType === "pdf" || meta.portType === "pdf")
            return "application/pdf";
        if (
            meta.fileType === "image" ||
            meta.type === "image" ||
            meta.portType === "image" ||
            meta.type === "upscale" ||
            meta.type === "resize"
        )
            return "image/png";
        if (
            meta.fileType === "video" ||
            meta.type === "video" ||
            meta.portType === "video"
        )
            return "video/mp4";
    }

    return "application/octet-stream";
}

/**
 * Builds NamedNodeInput entries from an array of URL-like values and their source.
 */
function buildFileValues(
    rawValues: unknown[],
    sourceData: NodeData | null,
): { url: string; type: string }[] {
    const result: { url: string; type: string }[] = [];
    for (const item of rawValues) {
        if (typeof item === "string") {
            result.push({
                url: item,
                type: inferMimeType(item, sourceData),
            });
        } else if (
            typeof item === "object" &&
            item !== null &&
            (item as Record<string, unknown>).url
        ) {
            const obj = item as Record<string, unknown>;
            result.push({
                url: obj.url as string,
                type: (obj.type as string) || "application/octet-stream",
            });
        }
    }
    return result;
}

// LLM Node
registerNode<LLMData, NodeInputs>({
    type: "llm",
    inputs: {
        "prompts-input": "text",
        "file-input": "any",
    },
    outputs: {
        "": "text",
    },
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: NodeInputs = { files: [], prompts: [], namedNodes: [] };
        const namedNodesMap = new Map<string, NamedNodeInput>();

        const getOrCreateNamed = (
            nodeId: string,
            sourceData: NodeData,
        ): NamedNodeInput => {
            if (!namedNodesMap.has(nodeId)) {
                namedNodesMap.set(nodeId, {
                    nodeId,
                    name: sourceData.name,
                    textValue: null,
                    fileValues: [],
                });
            }
            return namedNodesMap.get(nodeId)!;
        };

        const promptEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle === "prompts-input",
        );
        for (const edge of promptEdges) {
            const sourceData = getSourceData(edge.source, edge.sourceHandle);
            if (!sourceData) continue;
            const value = getSourceValue(sourceData);

            if (Array.isArray(value) && isCollectionSource(sourceData)) {
                const named = getOrCreateNamed(edge.source, sourceData);
                named.textValues = value as string[];
                named.textValue = (value as string[])[0] ?? null;
            } else if (typeof value === "string") {
                inputs.prompts?.push(value);
                const named = getOrCreateNamed(edge.source, sourceData);
                named.textValue = value;
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

            if (Array.isArray(value) && isCollectionSource(sourceData)) {
                const named = getOrCreateNamed(edge.source, sourceData);
                named.fileValuesList = (value as string[]).map((url) => [
                    { url, type: inferMimeType(url, sourceData) },
                ]);
                named.fileValues = named.fileValuesList[0] || [];
            } else {
                const rawValues = Array.isArray(value) ? value : [value];
                const fileValues = buildFileValues(rawValues, sourceData);

                for (const fv of fileValues) {
                    inputs.files?.push(fv);
                }

                const named = getOrCreateNamed(edge.source, sourceData);
                named.fileValues.push(...fileValues);
            }
        }

        inputs.namedNodes = Array.from(namedNodesMap.values());
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
        "prompt-input": "text",
        "image-input": "image",
    },
    outputs: {
        "result-output": "image",
    },
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: NodeInputs = { images: [], namedNodes: [] };
        const namedNodesMap = new Map<string, NamedNodeInput>();

        const getOrCreateNamed = (
            nodeId: string,
            sourceData: NodeData,
        ): NamedNodeInput => {
            if (!namedNodesMap.has(nodeId)) {
                namedNodesMap.set(nodeId, {
                    nodeId,
                    name: sourceData.name,
                    textValue: null,
                    fileValues: [],
                });
            }
            return namedNodesMap.get(nodeId)!;
        };

        const promptEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle === "prompt-input",
        );
        for (const promptEdge of promptEdges) {
            const sourceData = getSourceData(
                promptEdge.source,
                promptEdge.sourceHandle,
            );
            const promptValue = getSourceValue(sourceData);

            if (Array.isArray(promptValue) && isCollectionSource(sourceData)) {
                const named = getOrCreateNamed(promptEdge.source, sourceData!);
                named.textValues = promptValue as string[];
                named.textValue = (promptValue as string[])[0] ?? null;
            } else if (typeof promptValue === "string") {
                if (inputs.prompt === undefined) inputs.prompt = promptValue;
                if (sourceData) {
                    const named = getOrCreateNamed(
                        promptEdge.source,
                        sourceData,
                    );
                    named.textValue = promptValue;
                }
            }
        }

        const imageEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle === "image-input",
        );
        for (const edge of imageEdges) {
            const sourceData = getSourceData(edge.source, edge.sourceHandle);
            if (!sourceData) continue;

            const value = getSourceValue(sourceData);
            if (!value) continue;

            if (Array.isArray(value) && isCollectionSource(sourceData)) {
                const named = getOrCreateNamed(edge.source, sourceData);
                named.fileValuesList = (value as string[]).map((url) => [
                    { url, type: inferMimeType(url, sourceData) },
                ]);
                named.fileValues = named.fileValuesList[0] || [];
            } else {
                const rawValues = Array.isArray(value) ? value : [value];
                const fileValues = buildFileValues(rawValues, sourceData);

                for (const fv of fileValues) {
                    inputs.images?.push(fv);
                }

                const named = getOrCreateNamed(edge.source, sourceData);
                named.fileValues.push(...fileValues);
            }
        }

        inputs.namedNodes = Array.from(namedNodesMap.values());
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
        "prompt-input": "text",
        "first-frame-input": "image",
        "last-frame-input": "image",
        "image-input": "image",
    },
    outputs: {
        "result-output": "video",
    },
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: NodeInputs = { images: [], namedNodes: [] };
        const namedNodesMap = new Map<string, NamedNodeInput>();

        const promptEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle === "prompt-input",
        );
        for (const promptEdge of promptEdges) {
            const promptData = getSourceData(
                promptEdge.source,
                promptEdge.sourceHandle,
            );
            const promptValue = getSourceValue(promptData);

            if (Array.isArray(promptValue) && isCollectionSource(promptData)) {
                if (!namedNodesMap.has(promptEdge.source)) {
                    namedNodesMap.set(promptEdge.source, {
                        nodeId: promptEdge.source,
                        name: promptData!.name,
                        textValue: (promptValue as string[])[0] ?? null,
                        textValues: promptValue as string[],
                        fileValues: [],
                    });
                }
            } else if (typeof promptValue === "string") {
                if (inputs.prompt === undefined) inputs.prompt = promptValue;
                if (promptData) {
                    if (!namedNodesMap.has(promptEdge.source)) {
                        namedNodesMap.set(promptEdge.source, {
                            nodeId: promptEdge.source,
                            name: promptData.name,
                            textValue: promptValue,
                            fileValues: [],
                        });
                    }
                }
            }
        }

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

        inputs.namedNodes = Array.from(namedNodesMap.values());
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
        "result-output": "image",
    },
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: NodeInputs = { namedNodes: [] };
        const edge = edges.find(
            (e) => e.target === node.id && e.targetHandle === "image-input",
        );
        if (!edge) return inputs;
        const sourceData = getSourceData(edge.source, edge.sourceHandle);
        const value = getSourceValue(sourceData);
        if (!value) return inputs;

        if (Array.isArray(value) && isCollectionSource(sourceData)) {
            const named: NamedNodeInput = {
                nodeId: edge.source,
                name: sourceData!.name,
                textValue: null,
                fileValues: [],
                fileValuesList: (value as string[]).map((url) => [
                    { url, type: inferMimeType(url, sourceData) },
                ]),
            };
            named.fileValues = named.fileValuesList![0] || [];
            inputs.namedNodes!.push(named);
            const first = (value as string[])[0];
            if (first) inputs.image = first;
        } else {
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
        "result-output": "image",
    },
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: NodeInputs = { namedNodes: [] };
        const edge = edges.find(
            (e) => e.target === node.id && e.targetHandle === "image-input",
        );
        if (!edge) return inputs;
        const sourceData = getSourceData(edge.source, edge.sourceHandle);
        const value = getSourceValue(sourceData);
        if (!value) return inputs;

        if (Array.isArray(value) && isCollectionSource(sourceData)) {
            const named: NamedNodeInput = {
                nodeId: edge.source,
                name: sourceData!.name,
                textValue: null,
                fileValues: [],
                fileValuesList: (value as string[]).map((url) => [
                    { url, type: inferMimeType(url, sourceData) },
                ]),
            };
            named.fileValues = named.fileValuesList![0] || [];
            inputs.namedNodes!.push(named);
            const first = (value as string[])[0];
            if (first) inputs.image = first;
        } else {
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

// List Node
registerNode<ListData, NodeInputs>({
    type: "list",
    outputs: { "list-output": "collection:text" },
    gatherInputs: () => ({}),
    execute: async () => ({}),
});

// Text Node
registerNode<TextData, NodeInputs>({
    type: "text",
    outputs: { "": "text" },
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
