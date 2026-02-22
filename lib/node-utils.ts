import { Node } from "@xyflow/react";
import { NodeData } from "./types";

/**
 * Generates a unique name for a node by incrementing a suffix.
 * e.g., "Image" -> "Image#1", "Image#2", etc.
 */
export function generateUniqueNodeName(
    nodes: Node<NodeData>[],
    baseName: string,
): string {
    const pattern = new RegExp(`^${baseName}#(\\d+)$`);
    let maxNumber = 0;

    nodes.forEach((node) => {
        const name = node.data.name;
        if (name === baseName) {
            maxNumber = Math.max(maxNumber, 0);
        } else {
            const match = name.match(pattern);
            if (match) {
                const num = parseInt(match[1], 10);
                if (!isNaN(num)) {
                    maxNumber = Math.max(maxNumber, num);
                }
            }
        }
    });

    return `${baseName}#${maxNumber + 1}`;
}
