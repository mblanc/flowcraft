import { WorkflowInputData, NodeInputs, NodeDefinition } from "../types";

export const workflowInputNodeDefinition: NodeDefinition<
    WorkflowInputData,
    NodeInputs
> = {
    type: "workflow-input",
    gatherInputs: () => ({}),
    execute: async () => ({}),
};
