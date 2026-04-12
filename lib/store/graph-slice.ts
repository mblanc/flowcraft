"use client";

import {
    type Node,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
} from "@xyflow/react";
import type { StateCreator } from "zustand";
import { createNode, getUniqueNodeName } from "@/lib/node-factory";
import type { NodeData } from "@/lib/types";
import { migrateNodes } from "@/lib/migration";
import type { FlowState, GraphSlice } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildNodesById(
    nodes: Node<NodeData>[],
): Record<string, Node<NodeData>> {
    const map: Record<string, Node<NodeData>> = {};
    for (const node of nodes) map[node.id] = node;
    return map;
}

function deriveSelectedNode(
    nodesById: Record<string, Node<NodeData>>,
    selectedNodeId: string | null,
): Node<NodeData> | null {
    if (!selectedNodeId) return null;
    return nodesById[selectedNodeId] ?? null;
}

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

export const createGraphSlice: StateCreator<FlowState, [], [], GraphSlice> = (
    set,
    get,
) => ({
    nodes: [],
    nodesById: {},
    edges: [],
    selectedNodeId: null,
    selectedNode: null,
    flowId: null,
    flowName: "Untitled Flow",
    entityType: "flow",
    visibility: null,
    sharedWith: [],
    isTemplate: false,
    ownerId: null,
    lastModified: 0,

    setNodes: (nodes) => {
        const migrated = migrateNodes(nodes);
        const nodesById = buildNodesById(migrated);
        set({
            nodes: migrated,
            nodesById,
            selectedNode: deriveSelectedNode(nodesById, get().selectedNodeId),
            lastModified: Date.now(),
        });
    },

    setEdges: (edges) => set({ edges, lastModified: Date.now() }),

    onNodesChange: (changes) => {
        const updatedNodes = applyNodeChanges(
            changes,
            get().nodes,
        ) as Node<NodeData>[];
        const nodesById = buildNodesById(updatedNodes);
        set({
            nodes: updatedNodes,
            nodesById,
            selectedNode: deriveSelectedNode(nodesById, get().selectedNodeId),
            lastModified: Date.now(),
        });
    },

    onEdgesChange: (changes) => {
        set({
            edges: applyEdgeChanges(changes, get().edges),
            lastModified: Date.now(),
        });
    },

    onConnect: (connection) => {
        set({
            edges: addEdge(connection, get().edges),
            lastModified: Date.now(),
        });
    },

    setFlowId: (flowId) => set({ flowId }),
    setFlowName: (flowName) => set({ flowName, lastModified: Date.now() }),
    setEntityType: (entityType) => set({ entityType }),
    setSharing: (data) => set({ ...data, lastModified: Date.now() }),

    updateNodeData: (nodeId, data) => {
        const { nodes, nodesById, selectedNodeId } = get();
        const existing = nodesById[nodeId];
        if (!existing) return;

        const isExecuting = data.executing === true;
        const updatedNode: Node<NodeData> = {
            ...existing,
            selected: isExecuting ? false : existing.selected,
            data: { ...existing.data, ...data } as NodeData,
        };

        const newNodesById = { ...nodesById, [nodeId]: updatedNode };
        // Array still needed by React Flow – map over existing with O(1) hit
        const updatedNodes = nodes.map((n) =>
            n.id === nodeId ? updatedNode : n,
        ) as Node<NodeData>[];

        const newSelectedNodeId =
            isExecuting && selectedNodeId === nodeId ? null : selectedNodeId;

        set({
            nodes: updatedNodes,
            nodesById: newNodesById,
            selectedNodeId: newSelectedNodeId,
            selectedNode: deriveSelectedNode(newNodesById, newSelectedNodeId),
            lastModified: Date.now(),
        });
    },

    addNode: (node) => {
        const updatedNodes = [...get().nodes, node];
        const nodesById = { ...get().nodesById, [node.id]: node };
        set({ nodes: updatedNodes, nodesById, lastModified: Date.now() });
    },

    addNodeWithType: (type, position, data) => {
        const node = createNode(type, position);
        if (data) {
            node.data = { ...node.data, ...data } as NodeData;
        }

        node.data = {
            ...node.data,
            name: getUniqueNodeName(get().nodes, node.data.name),
        } as NodeData;

        const updatedNodes = [...get().nodes, node];
        const nodesById = { ...get().nodesById, [node.id]: node };
        set({ nodes: updatedNodes, nodesById, lastModified: Date.now() });
    },

    selectNode: (nodeId) => {
        const { nodes } = get();
        const updatedNodes = nodes.map((n) => ({
            ...n,
            selected: n.id === nodeId,
        })) as Node<NodeData>[];
        const nodesById = buildNodesById(updatedNodes);
        set({
            nodes: updatedNodes,
            nodesById,
            selectedNodeId: nodeId,
            selectedNode: deriveSelectedNode(nodesById, nodeId),
            lastModified: Date.now(),
        });
    },

    removeEdges: (edgeIds) => {
        set({
            edges: get().edges.filter((edge) => !edgeIds.includes(edge.id)),
            lastModified: Date.now(),
        });
    },

    loadFlow: (
        id,
        nodes,
        edges,
        name,
        entityType = "flow",
        sharing,
        remoteUpdatedAt?: string,
    ) => {
        const { flowId, lastModified } = get();

        // RECONCILIATION: If we are reloading the same flow and we have a local
        // version that is newer than the remote version, do not overwrite.
        if (flowId === id && remoteUpdatedAt) {
            const remoteTimestamp = new Date(remoteUpdatedAt).getTime();
            if (lastModified > remoteTimestamp) {
                console.warn(
                    `[FlowStore] Preserve local draft for flow ${id} (Local: ${new Date(lastModified).toISOString()}, Remote: ${remoteUpdatedAt})`,
                );
                return;
            }
        }

        const migrated = migrateNodes(nodes);
        const nodesById = buildNodesById(migrated);
        set({
            flowId: id,
            nodes: migrated,
            nodesById,
            edges,
            flowName: name,
            entityType,
            selectedNodeId: null,
            selectedNode: null,
            visibility: sharing?.visibility ?? null,
            sharedWith: sharing?.sharedWith ?? [],
            isTemplate: sharing?.isTemplate ?? false,
            ownerId: sharing?.ownerId ?? null,
            lastModified: remoteUpdatedAt
                ? new Date(remoteUpdatedAt).getTime()
                : Date.now(),
        });
    },
});
