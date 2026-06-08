import { Edge, Node } from "@xyflow/react";
import { NodeData } from "../types";
import { getNodeDefinition } from "../flow/node-registry";

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

        // Apply defaultData as baseline so fields added after initial save
        // are populated with sensible defaults on old nodes.
        // Use per-key merge so that empty-string values ("") from old Firestore
        // documents don't silently override the intended defaults.
        const nodeType = (nodeData as Record<string, unknown>).type;
        const def = getNodeDefinition(nodeType as NodeData["type"]);
        if (def?.defaultData) {
            const merged: Record<string, unknown> = { ...nodeData };
            for (const [key, defaultValue] of Object.entries(def.defaultData)) {
                const stored = (nodeData as Record<string, unknown>)[key];
                if (stored === null || stored === undefined || stored === "") {
                    merged[key] = defaultValue;
                }
            }
            nodeData = merged;
        }

        return { ...node, data: nodeData } as Node<NodeData>;
    });
}

/**
 * Migrates old edge handle IDs to the current names.
 * Current migrations:
 * - list node source handle: "result-output" -> "list-output"
 * - file node source handle: "result-output" -> null (primitives refactoring dropped explicit id)
 */
export function migrateEdges(
    edges: Edge[],
    nodes: Node<Record<string, unknown>>[],
): Edge[] {
    const nodeTypeById = new Map(
        nodes.map((n) => [n.id, n.type ?? n.data?.type]),
    );
    return edges.map((edge) => {
        if (edge.sourceHandle === "result-output") {
            const sourceType = nodeTypeById.get(edge.source);
            if (sourceType === "list") {
                return { ...edge, sourceHandle: "list-output" };
            }
            if (sourceType === "file") {
                return { ...edge, sourceHandle: null };
            }
        }
        return edge;
    });
}
