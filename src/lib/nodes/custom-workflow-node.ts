import { CustomWorkflowData, NodeInputs, NodeDefinition } from "../types";

export const customWorkflowNodeDefinition: NodeDefinition<
    CustomWorkflowData,
    NodeInputs
> = {
    type: "custom-workflow",
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
    execute: async () => {
        // Recursive execution is handled by WorkflowEngine.executeSubWorkflow
        return {};
    },
};
