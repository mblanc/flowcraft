import { TextData, NodeInputs, NodeDefinition } from "../types";

export const textNodeDefinition: NodeDefinition<TextData, NodeInputs> = {
    type: "text",
    outputs: { "": "text" },
    defaultData: {
        type: "text",
        name: "Text",
        text: "",
    },
    gatherInputs: () => ({}),
    execute: async () => ({}),
};
