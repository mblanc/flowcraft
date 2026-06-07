import { Node } from "@xyflow/react";
import {
    NodeData,
    NodeType,
    NodeInputs,
    ExecutionContext,
    NodeExecutor,
    NodeDefinition,
} from "./types";
import { allNodeDefinitions } from "./nodes";

// Re-export registry interfaces so existing imports continue to work
export type { ExecutionContext, NodeExecutor, NodeDefinition };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new Map<NodeType, NodeDefinition<any, any>>();

export function registerNode<T extends NodeData, I extends NodeInputs>(
    definition: NodeDefinition<T, I>,
) {
    registry.set(definition.type, definition);
}

export function getNodeDefinition<T extends NodeData>(
    type: T["type"],
): NodeDefinition<T, NodeInputs> | undefined {
    return registry.get(type) as NodeDefinition<T, NodeInputs> | undefined;
}

// Register all node definitions
for (const def of allNodeDefinitions) {
    registerNode(def);
}

export function getSourcePortType(
    node: Node<NodeData>,
    handleId?: string | null,
): string {
    const def = getNodeDefinition(node.data.type);
    if (def?.getSourcePortType) {
        return def.getSourcePortType(node, handleId);
    }

    const outputs = def?.outputs || {};
    const normalizedHandleId = handleId === null ? "" : handleId || "";

    let baseType: string;
    if (normalizedHandleId === "" && Object.keys(outputs).length === 1) {
        baseType = Object.values(outputs)[0];
    } else {
        baseType = outputs[normalizedHandleId] || "any";
    }

    if (node.data.batchTotal && node.data.batchTotal > 0) {
        return `collection:${baseType}`;
    }

    return baseType;
}

export function getTargetPortType(
    node: Node<NodeData>,
    handleId?: string | null,
): string {
    const def = getNodeDefinition(node.data.type);
    if (def?.getTargetPortType) {
        return def.getTargetPortType(node, handleId);
    }

    const inputs = def?.inputs || {};
    const normalizedHandleId = handleId === null ? "" : handleId || "";

    if (normalizedHandleId === "" && Object.keys(inputs).length === 1) {
        return Object.values(inputs)[0];
    }

    return inputs[normalizedHandleId] || "any";
}
