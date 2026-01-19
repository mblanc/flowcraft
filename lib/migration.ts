import { Node } from "@xyflow/react";
import { NodeData } from "./types";

/**
 * Migrates old node data structures to the current version.
 * Current migrations:
 * - agent -> llm
 */
export function migrateNodes(nodes: Node<any>[]): Node<NodeData>[] {
    return nodes.map((node) => {
        // Migration: agent -> llm
        if (node.type === "agent" || (node.data && node.data.type === "agent")) {
            return {
                ...node,
                type: "llm",
                data: {
                    ...node.data,
                    type: "llm",
                },
            };
        }
        return node;
    });
}
