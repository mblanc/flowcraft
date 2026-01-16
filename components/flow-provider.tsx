"use client";

import { createContext, useContext, useCallback, type ReactNode } from "react";
import {
    type Node,
    type Edge,
    type Connection,
    type NodeChange,
    type EdgeChange,
} from "@xyflow/react";
import { NodeData, NodeType } from "@/lib/types";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { useFlowExecution } from "@/hooks/use-flow-execution";
import { useFlowPersistence } from "@/hooks/use-flow-persistence";
import { createNode } from "@/lib/node-factory";

interface FlowContextType {
    nodes: Node<NodeData>[];
    edges: Edge[];
    selectedNode: Node<NodeData> | null;
    isRunning: boolean;
    flowId: string | null;
    flowName: string;
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection) => void;
    addAgentNode: (position?: { x: number; y: number }) => void;
    addTextNode: (position?: { x: number; y: number }) => void;
    addImageNode: (position?: { x: number; y: number }) => void;
    addVideoNode: (position?: { x: number; y: number }) => void;
    addFileNode: (position?: { x: number; y: number }) => void;
    addUpscaleNode: (position?: { x: number; y: number }) => void;
    addResizeNode: (position?: { x: number; y: number }) => void;
    addNode: (type: NodeType, position?: { x: number; y: number }) => void;
    selectNode: (nodeId: string | null) => void;
    updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
    updateFlowName: (name: string) => void;
    runFlow: () => Promise<void>;
    executeNode: (nodeId: string) => Promise<void>;
    exportFlow: () => void;
    importFlow: () => void;
    loadFlow: (
        id: string,
        nodes: Node<NodeData>[],
        edges: Edge[],
        name: string,
    ) => void;
    saveFlow: () => Promise<void>;
}

const FlowContext = createContext<FlowContextType | null>(null);

export function useFlow() {
    const context = useContext(FlowContext);
    if (!context) {
        throw new Error("useFlow must be used within FlowProvider");
    }
    return context;
}

export function FlowProvider({ children }: { children: ReactNode }) {
    const store = useFlowStore();
    const { runFlow, executeNode } = useFlowExecution();
    const { saveFlow, exportFlow, importFlow } = useFlowPersistence();
    const { addNode: storeAddNode } = useFlowStore();

    const addNode = useCallback(
        (type: NodeType, position?: { x: number; y: number }) => {
            storeAddNode(createNode(type, position));
        },
        [storeAddNode],
    );

    const addAgentNode = useCallback(
        (position?: { x: number; y: number }) => {
            addNode("agent", position);
        },
        [addNode],
    );

    const addTextNode = useCallback(
        (position?: { x: number; y: number }) => {
            addNode("text", position);
        },
        [addNode],
    );

    const addImageNode = useCallback(
        (position?: { x: number; y: number }) => {
            addNode("image", position);
        },
        [addNode],
    );

    const addVideoNode = useCallback(
        (position?: { x: number; y: number }) => {
            addNode("video", position);
        },
        [addNode],
    );

    const addFileNode = useCallback(
        (position?: { x: number; y: number }) => {
            addNode("file", position);
        },
        [addNode],
    );

    const addUpscaleNode = useCallback(
        (position?: { x: number; y: number }) => {
            addNode("upscale", position);
        },
        [addNode],
    );

    const addResizeNode = useCallback(
        (position?: { x: number; y: number }) => {
            addNode("resize", position);
        },
        [addNode],
    );

    return (
        <FlowContext.Provider
            value={{
                nodes: store.nodes,
                edges: store.edges,
                selectedNode: store.selectedNode,
                isRunning: store.isRunning,
                flowId: store.flowId,
                flowName: store.flowName,
                onNodesChange: store.onNodesChange,
                onEdgesChange: store.onEdgesChange,
                onConnect: store.onConnect,
                addAgentNode,
                addTextNode,
                addImageNode,
                addVideoNode,
                addFileNode,
                addUpscaleNode,
                addResizeNode,
                addNode,
                selectNode: store.selectNode,
                updateNodeData: store.updateNodeData,
                updateFlowName: store.setFlowName,
                runFlow,
                executeNode,
                exportFlow,
                importFlow,
                loadFlow: store.loadFlow,
                saveFlow,
            }}
        >
            {children}
        </FlowContext.Provider>
    );
}
