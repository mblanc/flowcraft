"use client";

import {
    type Node,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
} from "@xyflow/react";
import type { StateCreator } from "zustand";
import { createNode, getUniqueNodeName } from "@/lib/flow/node-factory";
import type { NodeData } from "@/lib/types";
import { migrateEdges, migrateNodes } from "@/lib/db/migration";
import { isOmniVideoModel } from "@/lib/constants";
import { getSourcePortType } from "@/lib/flow/node-registry";
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
    saveStatus: "saved",
    setSaveStatus: (status) => set({ saveStatus: status }),

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

        // Prevent selecting nodes that are currently executing
        const sanitizedNodes = updatedNodes.map((node) => {
            if (node.selected && node.data.executing) {
                return { ...node, selected: false };
            }
            return node;
        });

        const shouldUpdateLastModified = changes.some(
            (c) =>
                c.type === "remove" ||
                c.type === "add" ||
                c.type === "replace" ||
                (c.type === "position" && c.dragging === false),
        );

        const nodesById = buildNodesById(sanitizedNodes);
        set({
            nodes: sanitizedNodes,
            nodesById,
            selectedNode: deriveSelectedNode(nodesById, get().selectedNodeId),
            ...(shouldUpdateLastModified ? { lastModified: Date.now() } : {}),
        });
    },

    onEdgesChange: (changes) => {
        const shouldUpdateLastModified = changes.some(
            (c) => c.type !== "select",
        );
        set({
            edges: applyEdgeChanges(changes, get().edges),
            ...(shouldUpdateLastModified ? { lastModified: Date.now() } : {}),
        });
    },

    onConnect: (connection) => {
        const conn = { ...connection };
        const { nodesById } = get();

        if (conn.target) {
            const targetNode = nodesById[conn.target];
            if (targetNode?.data?.type === "video") {
                const targetModel = (
                    targetNode.data as Record<string, unknown> | undefined
                )?.model;
                const isOmni = isOmniVideoModel(targetModel);

                const sourceNode = conn.source
                    ? nodesById[conn.source]
                    : undefined;

                if (
                    isOmni &&
                    (conn.targetHandle === "first-frame-input" ||
                        conn.targetHandle === "last-frame-input")
                ) {
                    conn.targetHandle = "image-input";
                } else if (!conn.targetHandle) {
                    const sourcePortType = sourceNode
                        ? getSourcePortType(sourceNode, conn.sourceHandle)
                        : undefined;
                    if (
                        sourcePortType === "image" ||
                        sourceNode?.data?.type === "image"
                    ) {
                        conn.targetHandle = "image-input";
                    } else if (
                        sourcePortType === "video" ||
                        sourceNode?.data?.type === "video"
                    ) {
                        conn.targetHandle = "video-input";
                    } else if (
                        sourcePortType === "text" ||
                        sourceNode?.data?.type === "text"
                    ) {
                        conn.targetHandle = "prompt-input";
                    }
                }
            }
        }

        set({
            edges: addEdge(conn, get().edges),
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

        // Is it executing AFTER this update?
        // It's executing if data says so explicitly, or if it was already executing and data doesn't say it finished.
        const isExecuting =
            data.executing !== undefined
                ? data.executing
                : !!existing.data.executing;

        const updatedNode: Node<NodeData> = {
            ...existing,
            // Force deselection if it is/was executing.
            // If it's finishing (data.executing === false), we also keep it deselected.
            selected:
                isExecuting || data.executing === false
                    ? false
                    : existing.selected,
            data: { ...existing.data, ...data } as NodeData,
        };

        const newNodesById = { ...nodesById, [nodeId]: updatedNode };
        const updatedNodes = nodes.map((n) =>
            n.id === nodeId ? updatedNode : n,
        ) as Node<NodeData>[];

        // If it is executing or just finished, it shouldn't be the selectedNodeId.
        const newSelectedNodeId =
            (isExecuting || data.executing === false) &&
            selectedNodeId === nodeId
                ? null
                : selectedNodeId;

        let extraEdgesState = {};
        const updatedModel = (data as Record<string, unknown>).model;
        if (updatedModel && existing.data.type === "video") {
            if (isOmniVideoModel(updatedModel)) {
                const currentEdges = get().edges;
                let edgesChanged = false;
                const newEdges = currentEdges.map((e) => {
                    if (
                        e.target === nodeId &&
                        (e.targetHandle === "first-frame-input" ||
                            e.targetHandle === "last-frame-input")
                    ) {
                        edgesChanged = true;
                        return { ...e, targetHandle: "image-input" };
                    }
                    return e;
                });
                if (edgesChanged) {
                    extraEdgesState = { edges: newEdges };
                }
            }
        }

        set({
            nodes: updatedNodes,
            nodesById: newNodesById,
            selectedNodeId: newSelectedNodeId,
            selectedNode: deriveSelectedNode(newNodesById, newSelectedNodeId),
            lastModified: Date.now(),
            ...extraEdgesState,
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
            // Prevent selecting nodes that are currently executing
            selected: n.id === nodeId && !n.data.executing,
        })) as Node<NodeData>[];
        const nodesById = buildNodesById(updatedNodes);
        // Only set selectedNodeId if the node exists and is NOT executing
        const finalSelectedId =
            nodeId && nodesById[nodeId] && !nodesById[nodeId].data.executing
                ? nodeId
                : null;

        set({
            nodes: updatedNodes,
            nodesById,
            selectedNodeId: finalSelectedId,
            selectedNode: deriveSelectedNode(nodesById, finalSelectedId),
        });
    },

    deleteNode: (nodeId) => {
        const { nodes, edges, selectedNodeId } = get();
        const updatedNodes = nodes.filter(
            (n) => n.id !== nodeId,
        ) as Node<NodeData>[];
        const updatedEdges = edges.filter(
            (e) => e.source !== nodeId && e.target !== nodeId,
        );
        const nodesById = buildNodesById(updatedNodes);
        const newSelectedId = selectedNodeId === nodeId ? null : selectedNodeId;
        set({
            nodes: updatedNodes,
            nodesById,
            edges: updatedEdges,
            selectedNodeId: newSelectedId,
            selectedNode: deriveSelectedNode(nodesById, newSelectedId),
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
                // Still apply migrations to the preserved local nodes so that
                // fields added after the original save get their default values.
                const { nodes: localNodes } = get();
                const migrated = migrateNodes(
                    localNodes as Node<Record<string, unknown>>[],
                );
                set({
                    nodes: migrated,
                    nodesById: buildNodesById(migrated),
                });
                return;
            }
        }

        const migrated = migrateNodes(nodes);
        const nodesById = buildNodesById(migrated);
        const migratedEdges = migrateEdges(edges, migrated);
        set({
            flowId: id,
            nodes: migrated,
            nodesById,
            edges: migratedEdges,
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
