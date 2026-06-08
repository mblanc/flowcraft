/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Primitive } from "../types";
import type { WorkflowInputData } from "@/lib/types";

export const workflowInputPrimitive: Primitive<
    WorkflowInputData,
    any,
    any,
    any
> = {
    id: "workflow-input",
    label: "Workflow Input",
    mediaType: "any",
    requestSchema: null,
    outputShape: null,
    execute: null,

    flow: {
        type: "workflow-input",
        inputs: {},
        outputs: {},
        gatherInputs: () => ({}),
        mergeResults: (results) => {
            if (results.length === 0) return {};
            return results[0];
        },
        saveToLibrary: async () => {},
        getSourcePortType: (node) => node.data.portType,
        defaultData: {
            type: "workflow-input",
            name: "Workflow Input",
            portName: "input",
            portType: "text",
            portRequired: true,
        },
    },

    canvas: null,
    agent: null,
};
