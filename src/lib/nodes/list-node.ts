import { ListData, NodeInputs, NodeDefinition } from "../types";

export const listNodeDefinition: NodeDefinition<ListData, NodeInputs> = {
    type: "list",
    outputs: { "list-output": "collection:text" },
    defaultData: {
        type: "list",
        name: "List",
        itemType: "text",
        items: [""],
    },
    getSourcePortType: (node) => `collection:${node.data.itemType}`,
    gatherInputs: () => ({}),
    execute: async () => ({}),
};
