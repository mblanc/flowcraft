import {
    type NodeDefinition,
    type RouterData,
    type FileData,
    type NodeData,
} from "../types";
import { getSourceValue } from "./shared/node-helpers";

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

export const routerNodeDefinition: NodeDefinition<RouterData, RouterInputs> = {
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
    execute: async (_node, inputs) => {
        return { value: inputs.value, valueMediaType: inputs.valueMediaType };
    },
};
