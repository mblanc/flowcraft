/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Primitive } from "../types";
import type { RouterData, FileData, NodeData } from "@/lib/types";
import { getSourceValue } from "@/lib/node-adapters/utils/node-helpers";

type MediaType = "image" | "video" | "pdf";
type RouterInputs = { value?: unknown; valueMediaType?: MediaType };

function extractMediaType(sourceData: NodeData | null): MediaType | undefined {
    if (!sourceData) return undefined;
    const t = sourceData.type;
    if (t === "image" || t === "upscale" || t === "resize") return "image";
    if (t === "video") return "video";
    if (t === "file") return (sourceData as FileData).fileType ?? undefined;
    if (t === "router") return (sourceData as RouterData).valueMediaType;
    return undefined;
}

export const routerPrimitive: Primitive<RouterData, any, RouterInputs, any> = {
    id: "router",
    label: "Router",
    mediaType: "any",
    requestSchema: null,
    outputShape: null,
    execute: async (inputs) => {
        return { value: inputs.value, valueMediaType: inputs.valueMediaType };
    },

    flow: {
        type: "router",
        inputs: { input: "any" },
        outputs: { output: "any" },
        gatherInputs: (node, edges, getSourceData) => {
            const edge = edges.find(
                (e) => e.target === node.id && e.targetHandle === "input",
            );
            if (!edge) return { value: undefined };
            const sourceData = getSourceData(edge.source, edge.sourceHandle);
            return {
                value: getSourceValue(sourceData),
                valueMediaType: extractMediaType(sourceData),
            };
        },
        toFlowData: (node, inputs, result) => {
            return {
                value: result.value,
                valueMediaType: result.valueMediaType,
            };
        },
        mergeResults: (results) => {
            if (results.length === 0) return {};
            return results[0];
        },
        saveToLibrary: async () => {},
        defaultData: {
            type: "router",
            name: "Router",
        },
    },

    canvas: null,
    agent: null,
};
