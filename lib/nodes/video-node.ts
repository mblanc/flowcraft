import logger from "@/app/logger";
import { Node } from "@xyflow/react";
import {
    VideoData,
    NodeInputs,
    NamedNodeInput,
    NodeDefinition,
    ExecutionContext,
} from "../types";
import {
    getSourceValue,
    isCollectionSource,
    findInputByHandle,
} from "./shared/node-helpers";
import { executeNodeApiCall } from "./shared/execute-api-call";
import { NODE_MENTION_REGEX } from "@/lib/mention-utils";

export async function executeVideoNode(
    node: Node<VideoData>,
    inputs: {
        prompt?: string;
        firstFrame?: string;
        lastFrame?: string;
        images?: { url: string; type: string }[];
        namedNodes?: NamedNodeInput[];
    },
    context?: ExecutionContext,
): Promise<Partial<VideoData>> {
    const { firstFrame, lastFrame, images, namedNodes = [] } = inputs;

    const rawPrompt = node.data.prompt || inputs.prompt || "";
    const nodeMap = new Map(namedNodes.map((n) => [n.nodeId, n]));
    NODE_MENTION_REGEX.lastIndex = 0;
    const finalPrompt = rawPrompt.replace(NODE_MENTION_REGEX, (match, nodeId) => {
        const named = nodeMap.get(nodeId);
        return named?.textValue ?? match;
    });

    if (!finalPrompt) {
        throw new Error("No prompt available for video node");
    }

    logger.info(`[Executor] Generating video with prompt: ${finalPrompt}`);

    const data = await executeNodeApiCall<{ videoUrl: string }>(
        "/api/generate-video",
        {
            prompt: finalPrompt,
            firstFrame,
            lastFrame,
            images: images || [],
            aspectRatio: node.data.aspectRatio,
            duration: node.data.duration,
            model: node.data.model,
            generateAudio: node.data.generateAudio,
            resolution: node.data.resolution,
        },
        context,
    );

    return {
        videoUrl: data.videoUrl,
        firstFrame,
        lastFrame,
    };
}

export const videoNodeDefinition: NodeDefinition<VideoData, NodeInputs> = {
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
                if (promptData && !namedNodesMap.has(promptEdge.source)) {
                    namedNodesMap.set(promptEdge.source, {
                        nodeId: promptEdge.source,
                        name: promptData.name,
                        textValue: promptValue,
                        fileValues: [],
                    });
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
                    inputs.images?.push({ url: item, type: "image/png" });
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
    execute: (node, inputs, context) => executeVideoNode(node, inputs, context),
};
