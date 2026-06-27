/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { ResizeImageSchema } from "@/lib/schemas";
import type { Primitive } from "../types";
import type { ResizeData } from "@/lib/types";
import { DEFAULTS } from "@/lib/constants";
import {
    getSourceValue,
    isCollectionSource,
    inferMimeType,
} from "@/lib/node-adapters/utils/node-helpers";

const resizeOutputSchema = z.object({
    imageUrl: z.string(),
});

export const resizePrimitive: Primitive<
    ResizeData,
    any,
    z.infer<typeof ResizeImageSchema>,
    z.infer<typeof resizeOutputSchema>
> = {
    id: "resize",
    label: "Resize",
    mediaType: "image",
    requestSchema: ResizeImageSchema,
    outputShape: resizeOutputSchema,

    execute: null,

    flow: {
        type: "resize",
        inputs: {
            "image-input": "image",
        },
        outputs: {
            "result-output": "image",
        },
        gatherInputs: (node, edges, getSourceData) => {
            const inputs: any = { namedNodes: [] };
            const edge = edges.find(
                (e) => e.target === node.id && e.targetHandle === "image-input",
            );
            if (!edge) return inputs;
            const sourceData = getSourceData(edge.source, edge.sourceHandle);
            const value = getSourceValue(sourceData);
            if (!value) return inputs;

            if (Array.isArray(value) && isCollectionSource(sourceData)) {
                const named: any = {
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
                    inputs.image = (val as Record<string, unknown>)
                        .url as string;
            }

            inputs.aspectRatio = node.data.aspectRatio;
            return inputs;
        },
        toFlowData: (node, inputs, result) => {
            return {
                image: inputs.image,
                output: result.imageUrl,
                outputs: [result.imageUrl],
                aspectRatio: inputs.aspectRatio,
            };
        },
        mergeResults: (results) => {
            if (results.length === 0) return {};
            const allOutputs = results.flatMap(
                (r) =>
                    ((r as Record<string, unknown>).outputs as string[]) || [],
            );
            const firstResult = results[0] as Record<string, unknown>;
            return {
                output: firstResult?.output as string | undefined,
                outputs: allOutputs,
                aspectRatio: firstResult?.aspectRatio as
                    | "16:9"
                    | "9:16"
                    | undefined,
            };
        },
        saveToLibrary: async (node, result, ctx) => {
            const { flowId, flowName, fetch: fetchFn } = ctx;
            // result is the flow data shape: { output: string, outputs: string[], aspectRatio? }
            const r = result as Record<string, unknown>;
            const gcsUri = r.output as string | undefined;
            if (!gcsUri) return;
            const provenance = {
                sourceType: "flow" as const,
                sourceId: flowId,
                sourceName: flowName ?? "Untitled Flow",
                nodeId: node.id,
                nodeLabel: node.data.name || node.data.type,
                prompt: `Resized to aspect ratio ${node.data.aspectRatio}`,
            };

            await fetchFn("/api/library", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "image",
                    gcsUri,
                    mimeType: "image/png",
                    provenance,
                }),
            });
        },
        defaultData: {
            type: "resize",
            name: "Resize",
            aspectRatio: DEFAULTS.ASPECT_RATIO,
        },
    },

    canvas: null,
    agent: null,
};
