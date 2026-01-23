"use client";

import { create } from "zustand";
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
import { createNode } from "@/lib/node-factory";
import { NodeData, NodeType } from "@/lib/types";
import { migrateNodes } from "@/lib/migration";

export type EntityType = "flow" | "custom-node";

export interface FlowState {
    nodes: Node<NodeData>[];
    edges: Edge[];
    selectedNode: Node<NodeData> | null;
    isRunning: boolean;
    flowId: string | null;
    flowName: string;
    entityType: EntityType;
    entityVersion: number | null;

    // Actions
    setNodes: (nodes: Node<NodeData>[]) => void;
    setEdges: (edges: Edge[]) => void;
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection) => void;
    setSelectedNode: (node: Node<NodeData> | null) => void;
    setIsRunning: (isRunning: boolean) => void;
    setFlowId: (id: string | null) => void;
    setFlowName: (name: string) => void;
    setEntityType: (type: EntityType) => void;
    setEntityVersion: (version: number | null) => void;

    // Node Mutations
    updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
    addNode: (node: Node<NodeData>) => void;
    addNodeWithType: (
        type: NodeType,
        position?: { x: number; y: number },
        data?: Partial<NodeData>,
    ) => void;
    selectNode: (nodeId: string | null) => void;
    removeEdges: (edgeIds: string[]) => void;

    // Load/Reset
    loadFlow: (
        id: string,
        nodes: Node<NodeData>[],
        edges: Edge[],
        name: string,
        entityType?: EntityType,
        version?: number | null,
    ) => void;
}

export const useFlowStore = create<FlowState>((set, get) => ({
    nodes: [],
    edges: [],
    selectedNode: null,
    isRunning: false,
    flowId: null,
    flowName: "Untitled Flow",
    entityType: "flow",
    entityVersion: null,

    setNodes: (nodes) => set({ nodes: migrateNodes(nodes) }),
    setEdges: (edges) => set({ edges }),

    onNodesChange: (changes) => {
        set({
            nodes: applyNodeChanges(changes, get().nodes) as Node<NodeData>[],
        });
    },

    onEdgesChange: (changes) => {
        set({
            edges: applyEdgeChanges(changes, get().edges),
        });
    },

    onConnect: (connection) => {
        set({
            edges: addEdge(connection, get().edges),
        });
    },

    setSelectedNode: (selectedNode) => set({ selectedNode }),
    setIsRunning: (isRunning) => set({ isRunning }),
    setFlowId: (flowId) => set({ flowId }),
    setFlowName: (flowName) => set({ flowName }),
    setEntityType: (entityType) => set({ entityType }),
    setEntityVersion: (entityVersion) => set({ entityVersion }),

    updateNodeData: (nodeId, data) => {
        const { nodes, selectedNode } = get();
        const updatedNodes = nodes.map((node) =>
            node.id === nodeId
                ? { ...node, data: { ...node.data, ...data } as NodeData }
                : node,
        ) as Node<NodeData>[];

        const updatedSelectedNode =
            selectedNode?.id === nodeId
                ? {
                      ...selectedNode,
                      data: { ...selectedNode.data, ...data } as NodeData,
                  }
                : selectedNode;

        set({ nodes: updatedNodes, selectedNode: updatedSelectedNode });
    },

    addNode: (node) => {
        set({ nodes: [...get().nodes, node] });
    },

    addNodeWithType: (type, position, data) => {
        const node = createNode(type, position);
        if (data) {
            node.data = { ...node.data, ...data } as NodeData;
        }
        set({ nodes: [...get().nodes, node] });
    },

    selectNode: (nodeId) => {
        const { nodes } = get();
        if (nodeId) {
            const updatedNodes = nodes.map((node) => ({
                ...node,
                selected: node.id === nodeId,
            }));
            const node = nodes.find((n) => n.id === nodeId);
            set({ nodes: updatedNodes, selectedNode: node || null });
        } else {
            const updatedNodes = nodes.map((node) => ({
                ...node,
                selected: false,
            }));
            set({ nodes: updatedNodes, selectedNode: null });
        }
    },

    removeEdges: (edgeIds) => {
        set({
            edges: get().edges.filter((edge) => !edgeIds.includes(edge.id)),
        });
    },

    loadFlow: (id, nodes, edges, name, entityType = "flow", version = null) => {
        set({
            flowId: id,
            nodes: migrateNodes(nodes),
            edges,
            flowName: name,
            entityType,
            entityVersion: version,
        });
    },
}));
