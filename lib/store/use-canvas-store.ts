"use client";

import { create } from "zustand";
import { applyNodeChanges, type NodeChange } from "@xyflow/react";
import type {
    CanvasDocument,
    CanvasNode,
    ChatMessage,
} from "@/lib/canvas-types";

export interface CanvasStore {
    // Canvas data
    canvasId: string | null;
    canvasName: string;
    nodes: CanvasNode[];
    viewport: { x: number; y: number; zoom: number };
    messages: ChatMessage[];

    // UI state
    selectedNodeIds: string[];
    isSaving: boolean;
    saveStatus: "saved" | "saving" | "error";
    isChatLoading: boolean;
    generatingNodeIds: string[];

    // Dirty tracking for auto-save
    lastModified: number;

    // Actions
    setCanvas: (canvas: CanvasDocument) => void;
    setCanvasName: (name: string) => void;
    addNode: (node: CanvasNode) => void;
    updateNode: (id: string, data: Partial<CanvasNode>) => void;
    updateNodeData: (id: string, data: Record<string, unknown>) => void;
    removeNode: (id: string) => void;
    removeSelectedNodes: () => void;
    setNodes: (nodes: CanvasNode[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onNodesChange: (changes: NodeChange<any>[]) => void;
    setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
    setSelectedNodeIds: (ids: string[]) => void;
    addMessage: (message: ChatMessage) => void;
    updateMessage: (id: string, data: Partial<ChatMessage>) => void;
    setIsChatLoading: (loading: boolean) => void;
    setSaveStatus: (status: "saved" | "saving" | "error") => void;

    // Node ID generation
    getNextLabel: (
        type: "canvas-image" | "canvas-video" | "canvas-text",
    ) => string;
    getNextNodeId: (
        type: "canvas-image" | "canvas-video" | "canvas-text",
    ) => string;
}

const TYPE_PREFIX_MAP = {
    "canvas-image": "Image",
    "canvas-video": "Video",
    "canvas-text": "Text",
} as const;

export const useCanvasStore = create<CanvasStore>()((set, get) => ({
    canvasId: null,
    canvasName: "Untitled Canvas",
    nodes: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    messages: [],
    selectedNodeIds: [],
    isSaving: false,
    saveStatus: "saved" as const,
    isChatLoading: false,
    generatingNodeIds: [],
    lastModified: 0,

    setCanvas: (canvas) =>
        set({
            canvasId: canvas.id,
            canvasName: canvas.name,
            nodes: canvas.nodes,
            viewport: canvas.viewport,
            messages: canvas.messages,
            selectedNodeIds: [],
            lastModified: 0,
        }),

    setCanvasName: (name) =>
        set({ canvasName: name, lastModified: Date.now() }),

    addNode: (node) =>
        set((state) => ({
            nodes: [...state.nodes, node],
            lastModified: Date.now(),
        })),

    updateNode: (id, data) =>
        set((state) => ({
            nodes: state.nodes.map((n) =>
                n.id === id ? { ...n, ...data } : n,
            ),
            lastModified: Date.now(),
        })),

    updateNodeData: (id, data) =>
        set((state) => ({
            nodes: state.nodes.map((n) =>
                n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
            ),
            lastModified: Date.now(),
        })),

    removeNode: (id) =>
        set((state) => ({
            nodes: state.nodes.filter((n) => n.id !== id),
            selectedNodeIds: state.selectedNodeIds.filter((nid) => nid !== id),
            lastModified: Date.now(),
        })),

    removeSelectedNodes: () =>
        set((state) => ({
            nodes: state.nodes.filter(
                (n) => !state.selectedNodeIds.includes(n.id),
            ),
            selectedNodeIds: [],
            lastModified: Date.now(),
        })),

    setNodes: (nodes) => set({ nodes, lastModified: Date.now() }),

    onNodesChange: (changes) => {
        set((state) => {
            const nextNodes = applyNodeChanges(
                changes,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                state.nodes as any[],
            ) as unknown as CanvasNode[];
            const selectedIds = nextNodes
                .filter((n) => n.selected)
                .map((n) => n.id);
            const hasMutations = changes.some(
                (c) =>
                    c.type === "position" ||
                    c.type === "dimensions" ||
                    c.type === "remove",
            );
            return {
                nodes: nextNodes,
                selectedNodeIds: selectedIds,
                ...(hasMutations ? { lastModified: Date.now() } : {}),
            };
        });
    },

    setViewport: (viewport) => set({ viewport, lastModified: Date.now() }),

    setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),

    addMessage: (message) =>
        set((state) => ({
            messages: [...state.messages, message],
            lastModified: Date.now(),
        })),

    updateMessage: (id, data) =>
        set((state) => ({
            messages: state.messages.map((m) =>
                m.id === id ? { ...m, ...data } : m,
            ),
            lastModified: Date.now(),
        })),

    setIsChatLoading: (loading) => set({ isChatLoading: loading }),

    setSaveStatus: (status) =>
        set({ saveStatus: status, isSaving: status === "saving" }),

    getNextLabel: (type) => {
        const prefix = TYPE_PREFIX_MAP[type];
        const existing = get().nodes.filter((n) => n.type === type);
        const maxIndex = existing.reduce((max, node) => {
            const match = node.data.label.match(
                new RegExp(`^${prefix} (\\d+)$`),
            );
            return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        return `${prefix} ${maxIndex + 1}`;
    },

    getNextNodeId: (type) => {
        const prefix = type.replace("canvas-", "");
        const existing = get().nodes.filter((n) => n.type === type);
        const maxIndex = existing.reduce((max, node) => {
            const match = node.id.match(new RegExp(`^${prefix}-(\\d+)$`));
            return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        return `${prefix}-${maxIndex + 1}`;
    },
}));
