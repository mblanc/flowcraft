import { WorkflowInputData, NodeInputs, NodeDefinition } from "../types";

export const workflowInputNodeDefinition: NodeDefinition<
    WorkflowInputData,
    NodeInputs
> = {
    type: "workflow-input",
    defaultData: {
        type: "workflow-input",
        name: "Workflow Input",
        portName: "input",
        portType: "text",
        portRequired: true,
    },
    getSourcePortType: (node) => node.data.portType,
    gatherInputs: () => ({}),
    execute: async () => ({}),
};
