import { Node } from "@xyflow/react";
import { NodeData } from "./types";

/**
 * Migrates old node data structures to the current version.
 * Current migrations:
 * - agent -> llm
 * - image node: resolution -> imageSize
 */
export function migrateNodes(
    nodes: Node<Record<string, unknown>>[],
): Node<NodeData>[] {
    return nodes.map((node) => {
        let nodeData = node.data;

        // Migration: agent -> llm
        const isAgent =
            node.type === "agent" ||
            (typeof nodeData === "object" &&
                nodeData !== null &&
                "type" in nodeData &&
                nodeData.type === "agent");

        if (isAgent) {
            nodeData = { ...nodeData, type: "llm" };
            node = { ...node, type: "llm" };
        }

        // Migration: image node resolution -> imageSize
        if (
            typeof nodeData === "object" &&
            nodeData !== null &&
            "type" in nodeData &&
            nodeData.type === "image" &&
            "resolution" in nodeData &&
            !("imageSize" in nodeData)
        ) {
            const { resolution, ...rest } = nodeData;
            nodeData = { ...rest, imageSize: resolution };
        }

        return { ...node, data: nodeData } as Node<NodeData>;
    });
}
