import { type Node } from "@xyflow/react";
import { type NodeType, type NodeData } from "../types";
import { getNodeDefinition } from "./node-registry";

export function createNode(
    type: NodeType,
    position: { x: number; y: number } = { x: 250, y: 250 },
): Node<NodeData> {
    const id = `${type}-${Date.now()}`;
    const def = getNodeDefinition(type);

    if (!def) {
        throw new Error(`Unknown node type: ${type}`);
    }

    return {
        id,
        type,
        position,
        data: {
            type,
            name: def.defaultData?.name || type.toUpperCase(),
            ...def.defaultData,
        } as NodeData,
    };
}

/**
 * Generates a unique name for a node by appending a counter if the base name already exists.
 * @param existingNodes Current list of nodes in the flow
 * @param baseName The starting name (e.g., "Image")
 * @returns A unique name (e.g., "Image 1", "Image 2")
 */
export function getUniqueNodeName(
    existingNodes: Node<NodeData>[],
    baseName: string,
): string {
    const existingNames = new Set(existingNodes.map((n) => n.data.name));
    let counter = 1;
    let candidate = `${baseName}${counter}`;

    while (existingNames.has(candidate)) {
        counter += 1;
        candidate = `${baseName}${counter}`;
    }

    return candidate;
}
