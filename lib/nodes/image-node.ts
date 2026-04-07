import logger from "@/app/logger";
import { Node } from "@xyflow/react";
import {
    ImageData,
    NodeInputs,
    NamedNodeInput,
    NodeDefinition,
    ExecutionContext,
} from "../types";
import {
    getSourceValue,
    isCollectionSource,
    buildFileValues,
    inferMimeType,
    createNamedNodesTracker,
} from "./shared/node-helpers";
import {
    resolveInlineMentions,
    appendUnreferencedNodes,
} from "./shared/mention-resolver";
import { withRetry } from "../retry";

export async function executeImageNode(
    node: Node<ImageData>,
    inputs: {
        prompt?: string;
        images?: { url: string; type: string }[];
        namedNodes?: NamedNodeInput[];
    },
    context?: ExecutionContext,
): Promise<Partial<ImageData>> {
    const { namedNodes = [] } = inputs;
    const fetcher = context?.fetch || fetch;
    const referencedIds = new Set<string>();

    const promptSource = node.data.prompt || inputs.prompt || "";
    const parts = resolveInlineMentions(
        promptSource,
        namedNodes,
        referencedIds,
    );

    appendUnreferencedNodes(parts, namedNodes, referencedIds);

    if (parts.length === 0) {
        throw new Error("No prompt available for image node");
    }

    logger.info(
        `[Executor] Generating image with ${parts.length} content parts`,
    );

    const generateFn = async () => {
        const response = await fetcher("/api/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                parts,
                aspectRatio: node.data.aspectRatio,
                model: node.data.model,
                resolution: node.data.resolution,
                groundingGoogleSearch: node.data.groundingGoogleSearch,
                groundingImageSearch: node.data.groundingImageSearch,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`Failed to generate image: ${errorText}`);
            Object.assign(error, { status: response.status });
            throw error;
        }

        context?.onNodeUpdate?.(node.id, { error: undefined });
        return response.json();
    };

    let data;
    try {
        data = await withRetry(generateFn, {
            maxRetries: 3,
            onRetry: (attempt, error, delay) => {
                const status =
                    typeof error === "object" &&
                    error !== null &&
                    "status" in error
                        ? (error as { status: number }).status
                        : undefined;
                if (status === 429) {
                    const msg = `High traffic detected! Our AI artists are working overtime. Retrying in a moment... (Attempt ${attempt}/3)`;
                    context?.onNodeUpdate?.(node.id, { error: msg });
                } else {
                    context?.onNodeUpdate?.(node.id, {
                        error: `Generation failed. Retrying in a moment... (Attempt ${attempt}/3)`,
                    });
                }
                logger.warn(
                    `[Executor] Attempt ${attempt} failed for image node ${node.id}. Retrying in ${Math.round(delay)}ms...`,
                    error,
                );
            },
        });
    } catch (error) {
        const status =
            typeof error === "object" && error !== null && "status" in error
                ? (error as { status: number }).status
                : undefined;
        if (status === 429) {
            const finalErr = `High traffic detected! Our AI artists are working overtime. Please try again later.`;
            context?.onNodeUpdate?.(node.id, { error: finalErr });
            throw new Error(finalErr);
        }
        throw error;
    }

    return {
        images: [data.imageUrl],
        prompt: promptSource || undefined,
        mediaInputs: inputs.images?.length
            ? inputs.images.map((i) => ({ url: i.url, mimeType: i.type }))
            : undefined,
    };
}

export const imageNodeDefinition: NodeDefinition<ImageData, NodeInputs> = {
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
        const tracker = createNamedNodesTracker();

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
                const named = tracker.getOrCreate(
                    promptEdge.source,
                    sourceData!,
                );
                named.textValues = promptValue as string[];
                named.textValue = (promptValue as string[])[0] ?? null;
            } else if (typeof promptValue === "string") {
                if (inputs.prompt === undefined) inputs.prompt = promptValue;
                if (sourceData) {
                    const named = tracker.getOrCreate(
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
                const named = tracker.getOrCreate(edge.source, sourceData);
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

                const named = tracker.getOrCreate(edge.source, sourceData);
                named.fileValues.push(...fileValues);
            }
        }

        inputs.namedNodes = tracker.values();
        return inputs;
    },
    execute: (node, inputs, context) => executeImageNode(node, inputs, context),
};
