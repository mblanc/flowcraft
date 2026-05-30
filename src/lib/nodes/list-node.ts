import { ListData, NodeInputs, NodeDefinition } from "../types";

export const listNodeDefinition: NodeDefinition<ListData, NodeInputs> = {
    type: "list",
    outputs: { "list-output": "collection:text" },
    gatherInputs: () => ({}),
    execute: async () => ({}),
};
