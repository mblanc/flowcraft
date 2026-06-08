import { WorkflowOutputData, NodeInputs, NodeDefinition } from "../types";

export const workflowOutputNodeDefinition: NodeDefinition<
    WorkflowOutputData,
    NodeInputs
> = {
    type: "workflow-output",
    defaultData: {
        type: "workflow-output",
        name: "Workflow Output",
        portName: "output",
        portType: "text",
    },
    getTargetPortType: (node) => node.data.portType,
    gatherInputs: (node, edges, getSourceData) => {
        const edge = edges.find((e) => e.target === node.id);
        if (!edge) return {};
        return { value: getSourceData(edge.source, edge.sourceHandle) };
    },
    execute: async (_node, inputs) => {
        return { ...inputs } as Partial<WorkflowOutputData>;
    },
};
