/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Primitive } from "../types";
import type { TextData } from "@/lib/types";

export const textPrimitive: Primitive<TextData, any, any, any> = {
    id: "text",
    label: "Text",
    mediaType: "text",
    requestSchema: null,
    outputShape: null,
    execute: null,

    flow: {
        type: "text",
        inputs: {},
        outputs: {
            "": "text",
        },
        gatherInputs: () => ({}),
        mergeResults: (results) => {
            if (results.length === 0) return {};
            return {
                text: results.map((r) => r.text || "").join("\n\n---\n\n"),
            };
        },
        saveToLibrary: async () => {},
        defaultData: {
            type: "text",
            name: "Text",
            text: "",
        },
    },

    canvas: null,
    agent: null,
};
