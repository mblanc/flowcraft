"use client";

import type {
    Node,
    Edge,
    Connection,
    NodeChange,
    EdgeChange,
} from "@xyflow/react";
import type { NodeData, NodeType } from "@/lib/types";

export type EntityType = "flow" | "custom-node";

export type SharedWith = { email: string; role: "view" | "edit" };

export type SharingData = {
    visibility?: "private" | "public" | "restricted";
    sharedWith?: SharedWith[];
    isTemplate?: boolean;
};

/**
 * All workflow graph state: nodes, edges, selection, flow metadata, and
 * every action that mutates them. This slice is persisted to Firestore.
 */
export interface GraphSlice {
    // --- Core graph data ---
    nodes: Node<NodeData>[];
    /**
     * O(1) lookup map kept in sync with `nodes` by every mutating action.
     * Read-only for consumers – always mutate through store actions.
     */
    nodesById: Record<string, Node<NodeData>>;
    edges: Edge[];

    // --- Selection ---
    /** Source of truth for which node is selected. Drives `selectedNode`. */
    selectedNodeId: string | null;
    /**
     * Derived from `selectedNodeId + nodesById`. Always reflects the latest
     * node data without requiring separate sync logic.
     */
    selectedNode: Node<NodeData> | null;

    // --- Flow metadata ---
    flowId: string | null;
    flowName: string;
    entityType: EntityType;
    visibility: "private" | "public" | "restricted" | null;
    sharedWith: SharedWith[];
    isTemplate: boolean;
    ownerId: string | null;

    // --- React Flow integration handlers ---
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection) => void;

    // --- Setters ---
    setNodes: (nodes: Node<NodeData>[]) => void;
    setEdges: (edges: Edge[]) => void;
    setFlowId: (id: string | null) => void;
    setFlowName: (name: string) => void;
    setEntityType: (type: EntityType) => void;
    setSharing: (data: SharingData) => void;

    // --- Node mutations ---
    updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
    addNode: (node: Node<NodeData>) => void;
    addNodeWithType: (
        type: NodeType,
        position?: { x: number; y: number },
        data?: Partial<NodeData>,
    ) => void;
    selectNode: (nodeId: string | null) => void;
    removeEdges: (edgeIds: string[]) => void;

    // --- Load / reset ---
    loadFlow: (
        id: string,
        nodes: Node<NodeData>[],
        edges: Edge[],
        name: string,
        entityType?: EntityType,
        sharing?: {
            visibility?: "private" | "public" | "restricted";
            sharedWith?: SharedWith[];
            isTemplate?: boolean;
            ownerId?: string;
        },
    ) => void;
}

/**
 * Transient UI state that does not belong in the graph snapshot: running
 * status, sidebar visibility, etc.
 */
export interface UISlice {
    isRunning: boolean;
    isConfigSidebarOpen: boolean;
    setIsRunning: (isRunning: boolean) => void;
    setIsConfigSidebarOpen: (isOpen: boolean) => void;
}

/** Combined store type consumed by all components and hooks. */
export type FlowState = GraphSlice & UISlice;
