import logger from "@/app/logger";
import { Node } from "@xyflow/react";
import {
    UpscaleData,
    NodeInputs,
    NamedNodeInput,
    NodeDefinition,
    ExecutionContext,
} from "../types";
import {
    getSourceValue,
    isCollectionSource,
    inferMimeType,
} from "./shared/node-helpers";
import { executeNodeApiCall } from "./shared/execute-api-call";

export async function executeUpscaleNode(
    node: Node<UpscaleData>,
    inputs: { image?: string },
    context?: ExecutionContext,
): Promise<Partial<UpscaleData>> {
    const { image } = inputs;
    const finalImage = image || node.data.image;

    if (!finalImage) {
        throw new Error("No image available for upscale node");
    }

    logger.info("[Executor] Upscaling image");

    const data = await executeNodeApiCall<{ imageUrl: string }>(
        "/api/upscale-image",
        { image: finalImage, upscaleFactor: node.data.upscaleFactor },
        context,
    );

    return { image: data.imageUrl };
}

export const upscaleNodeDefinition: NodeDefinition<UpscaleData, NodeInputs> = {
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
    execute: (node, inputs, context) =>
        executeUpscaleNode(node, inputs, context),
};
