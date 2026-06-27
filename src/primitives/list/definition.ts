/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Primitive } from "../types";
import type { ListData } from "@/lib/types";

export const listPrimitive: Primitive<ListData, any, any, any> = {
    id: "list",
    label: "List",
    mediaType: "any",
    requestSchema: null,
    outputShape: null,
    execute: null,

    flow: {
        type: "list",
        inputs: {},
        outputs: {
            "list-output": "collection:text",
        },
        gatherInputs: () => ({}),
        mergeResults: (results) => {
            if (results.length === 0) return {};
            const allItems = results.flatMap((r) => r.items || []);
            return {
                items: allItems,
            };
        },
        saveToLibrary: async () => {},
        getSourcePortType: (node) => `collection:${node.data.itemType}`,
        defaultData: {
            type: "list",
            name: "List",
            itemType: "text",
            items: [""],
        },
    },

    canvas: null,
    agent: null,
};
