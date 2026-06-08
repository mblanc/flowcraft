/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Primitive } from "../types";
import type { FileData } from "@/lib/types";

export const filePrimitive: Primitive<FileData, any, any, any> = {
    id: "file",
    label: "File",
    mediaType: "any",
    requestSchema: null,
    outputShape: null,
    execute: null,

    flow: {
        type: "file",
        inputs: {},
        outputs: {
            "": "any",
        },
        gatherInputs: () => ({}),
        mergeResults: (results) => {
            if (results.length === 0) return {};
            return {
                gcsUri: results
                    .map((r) => r.gcsUri || "")
                    .filter(Boolean)
                    .join(", "),
            };
        },
        saveToLibrary: async () => {},
        getSourcePortType: (node) => node.data.fileType || "any",
        defaultData: {
            type: "file",
            name: "File",
            fileType: null,
            fileUrl: "",
            fileName: "",
            width: 220,
            height: 300,
        },
    },

    canvas: null,
    agent: null,
};
