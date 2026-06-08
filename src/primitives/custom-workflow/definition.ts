/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Primitive } from "../types";
import type { CustomWorkflowData } from "@/lib/types";

export const customWorkflowPrimitive: Primitive<
    CustomWorkflowData,
    any,
    any,
    any
> = {
    id: "custom-workflow",
    label: "Custom Workflow",
    mediaType: "any",
    requestSchema: null,
    outputShape: null,
    execute: async () => {
        // Recursive execution is handled by WorkflowEngine.executeSubWorkflow
        return {};
    },

    flow: {
        type: "custom-workflow",
        inputs: {},
        outputs: {},
        gatherInputs: (node, edges, getSourceData) => {
            const inputs: Record<string, unknown> = {};
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
        mergeResults: (results) => {
            if (results.length === 0) return {};
            return results[0];
        },
        saveToLibrary: async () => {},
        getSourcePortType: (node, handleId) =>
            node.data.outputs?.[handleId || ""] || "any",
        getTargetPortType: (node, handleId) =>
            node.data.inputs?.[handleId || ""] || "any",
        defaultData: {
            type: "custom-workflow",
            name: "Custom Workflow",
            subWorkflowId: "",
        },
    },

    canvas: null,
    agent: null,
};
