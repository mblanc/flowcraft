import { Node } from "@xyflow/react";
import { NodeData } from "./types";

/**
 * Migrates old node data structures to the current version.
 * Current migrations:
 * - agent -> llm
 */
export function migrateNodes(
    nodes: Node<Record<string, unknown>>[],
): Node<NodeData>[] {
    return nodes.map((node) => {
        // Migration: agent -> llm
        const nodeData = node.data;
        const isAgent =
            node.type === "agent" ||
            (typeof nodeData === "object" &&
                nodeData !== null &&
                "type" in nodeData &&
                nodeData.type === "agent");

        if (isAgent) {
            return {
                ...node,
                type: "llm",
                data: {
                    ...nodeData,
                    type: "llm",
                },
            } as Node<NodeData>;
        }
        return node as Node<NodeData>;
    });
}
