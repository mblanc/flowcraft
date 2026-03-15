import { TextData, NodeInputs, NodeDefinition } from "../types";

export const textNodeDefinition: NodeDefinition<TextData, NodeInputs> = {
    type: "text",
    outputs: { "": "text" },
    gatherInputs: () => ({}),
    execute: async () => ({}),
};
