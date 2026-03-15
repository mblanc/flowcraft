"use client";

import {
    type Node,
    type Edge,
    type Connection,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    type NodeChange,
    type EdgeChange,
} from "@xyflow/react";
import type { StateCreator } from "zustand";
import { createNode } from "@/lib/node-factory";
import type { NodeData, NodeType } from "@/lib/types";
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

    setNodes: (nodes) => {
        const migrated = migrateNodes(nodes);
        const nodesById = buildNodesById(migrated);
        set({
            nodes: migrated,
            nodesById,
            selectedNode: deriveSelectedNode(nodesById, get().selectedNodeId),
        });
    },

    setEdges: (edges) => set({ edges }),

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
        });
    },

    onEdgesChange: (changes) => {
        set({ edges: applyEdgeChanges(changes, get().edges) });
    },

    onConnect: (connection) => {
        set({ edges: addEdge(connection, get().edges) });
    },

    setFlowId: (flowId) => set({ flowId }),
    setFlowName: (flowName) => set({ flowName }),
    setEntityType: (entityType) => set({ entityType }),
    setSharing: (data) => set({ ...data }),

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
        });
    },

    addNode: (node) => {
        const updatedNodes = [...get().nodes, node];
        const nodesById = { ...get().nodesById, [node.id]: node };
        set({ nodes: updatedNodes, nodesById });
    },

    addNodeWithType: (type, position, data) => {
        const node = createNode(type, position);
        if (data) {
            node.data = { ...node.data, ...data } as NodeData;
        }

        const existingNames = new Set(get().nodes.map((n) => n.data.name));
        const baseName = node.data.name;
        let candidate = `${baseName}1`;
        let counter = 1;
        while (existingNames.has(candidate)) {
            counter += 1;
            candidate = `${baseName}${counter}`;
        }
        node.data = { ...node.data, name: candidate } as NodeData;

        const updatedNodes = [...get().nodes, node];
        const nodesById = { ...get().nodesById, [node.id]: node };
        set({ nodes: updatedNodes, nodesById });
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
        });
    },

    removeEdges: (edgeIds) => {
        set({
            edges: get().edges.filter((edge) => !edgeIds.includes(edge.id)),
        });
    },

    loadFlow: (id, nodes, edges, name, entityType = "flow", sharing) => {
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
        });
    },
});
