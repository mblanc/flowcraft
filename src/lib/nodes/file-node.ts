import { FileData, NodeInputs, NodeDefinition } from "../types";

export const fileNodeDefinition: NodeDefinition<FileData, NodeInputs> = {
    type: "file",
    outputs: { "": "any" },
    gatherInputs: () => ({}),
    execute: async () => ({}),
};
