/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { UpscaleImageSchema } from "@/lib/schemas";
import type { Primitive } from "../types";
import type { UpscaleData } from "@/lib/types";
import {
    getSourceValue,
    isCollectionSource,
    inferMimeType,
} from "@/lib/node-adapters/utils/node-helpers";

const upscaleOutputSchema = z.object({
    imageUrl: z.string(),
    upscaleFactor: z.enum(["x2", "x3", "x4"]),
});

export const upscalePrimitive: Primitive<
    UpscaleData,
    any,
    z.infer<typeof UpscaleImageSchema>,
    z.infer<typeof upscaleOutputSchema>
> = {
    id: "upscale",
    label: "Upscale",
    mediaType: "image",
    requestSchema: UpscaleImageSchema,
    outputShape: upscaleOutputSchema,

    execute: null,

    flow: {
        type: "upscale",
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

            inputs.upscaleFactor = node.data.upscaleFactor;
            return inputs;
        },
        toFlowData: (node, inputs, result) => {
            return {
                image: result.imageUrl,
                images: [result.imageUrl],
                upscaleFactor: result.upscaleFactor,
            };
        },
        mergeResults: (results) => {
            if (results.length === 0) return {};
            const allImages = results.flatMap(
                (r) =>
                    ((r as Record<string, unknown>).images as string[]) || [],
            );
            const firstResult = results[0] as Record<string, unknown>;
            return {
                image: firstResult?.image as string | undefined,
                images: allImages,
                upscaleFactor: firstResult?.upscaleFactor as
                    | "x2"
                    | "x3"
                    | "x4"
                    | undefined,
            };
        },
        saveToLibrary: async (node, result, ctx) => {
            const { flowId, flowName, fetch: fetchFn } = ctx;
            // result is the flow data shape: { image: string, images: string[], upscaleFactor? }
            const r = result as Record<string, unknown>;
            const gcsUri = r.image as string | undefined;
            if (!gcsUri) return;
            const provenance = {
                sourceType: "flow" as const,
                sourceId: flowId,
                sourceName: flowName ?? "Untitled Flow",
                nodeId: node.id,
                nodeLabel: node.data.name || node.data.type,
                prompt: `Upscaled with factor ${r.upscaleFactor ?? node.data.upscaleFactor}`,
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
            type: "upscale",
            name: "Upscale",
            image: "",
            upscaleFactor: "x2",
        },
    },

    canvas: null,
    agent: null,
};
