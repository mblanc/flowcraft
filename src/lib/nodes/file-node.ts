import { FileData, NodeInputs, NodeDefinition } from "../types";

export const fileNodeDefinition: NodeDefinition<FileData, NodeInputs> = {
    type: "file",
    outputs: { "": "any" },
    defaultData: {
        type: "file",
        name: "File",
        fileType: null,
        fileUrl: "",
        fileName: "",
        width: 220,
        height: 300,
    },
    getSourcePortType: (node) => node.data.fileType || "any",
    gatherInputs: () => ({}),
    execute: async () => ({}),
};
