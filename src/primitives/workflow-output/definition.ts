/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Primitive } from "../types";
import type { WorkflowOutputData } from "@/lib/types";

export const workflowOutputPrimitive: Primitive<
    WorkflowOutputData,
    any,
    any,
    any
> = {
    id: "workflow-output",
    label: "Workflow Output",
    mediaType: "any",
    requestSchema: null,
    outputShape: null,
    execute: async (inputs) => {
        return { ...inputs };
    },

    flow: {
        type: "workflow-output",
        inputs: {
            input: "any",
        },
        outputs: {},
        gatherInputs: (node, edges, getSourceData) => {
            const edge = edges.find((e) => e.target === node.id);
            if (!edge) return {};
            return { value: getSourceData(edge.source, edge.sourceHandle) };
        },
        mergeResults: (results) => {
            if (results.length === 0) return {};
            return results[0];
        },
        saveToLibrary: async () => {},
        getTargetPortType: (node) => node.data.portType,
        defaultData: {
            type: "workflow-output",
            name: "Workflow Output",
            portName: "output",
            portType: "text",
        },
    },

    canvas: null,
    agent: null,
};
