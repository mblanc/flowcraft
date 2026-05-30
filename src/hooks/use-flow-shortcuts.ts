import { useCallback, useEffect } from "react";
import type { ReactFlowInstance, Node, Edge } from "@xyflow/react";
import type { NodeData } from "@/lib/types";
import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import { v4 as uuidv4 } from "uuid";
import logger from "@/app/logger";

export function useFlowShortcuts(rfInstance: ReactFlowInstance | null) {
    const nodes = useFlowStore((state: FlowState) => state.nodes);
    const edges = useFlowStore((state: FlowState) => state.edges);
    const onNodesChange = useFlowStore(
        (state: FlowState) => state.onNodesChange,
    );
    const onEdgesChange = useFlowStore(
        (state: FlowState) => state.onEdgesChange,
    );

    const copyNodes = useCallback(() => {
        if (!rfInstance) return;
        const selectedNodes = rfInstance.getNodes().filter((n) => n.selected);
        const selectedEdges = rfInstance.getEdges().filter((e) => e.selected);
        if (selectedNodes.length > 0) {
            const copyData = { nodes: selectedNodes, edges: selectedEdges };
            localStorage.setItem(
                "flowcraft-copy-buffer",
                JSON.stringify(copyData),
            );
        }
    }, [rfInstance]);

    const pasteNodes = useCallback(() => {
        const copyDataStr = localStorage.getItem("flowcraft-copy-buffer");
        if (copyDataStr && rfInstance) {
            try {
                const { nodes: copiedNodes, edges: copiedEdges } =
                    JSON.parse(copyDataStr);
                const idMap: Record<string, string> = {};

                const offset = { x: 50, y: 50 };

                const newNodes = (copiedNodes as Node<NodeData>[]).map(
                    (node: Node<NodeData>) => {
                        const newId = uuidv4();
                        idMap[node.id] = newId;
                        return {
                            ...node,
                            id: newId,
                            position: {
                                x: node.position.x + offset.x,
                                y: node.position.y + offset.y,
                            },
                            selected: true,
                        } as Node<NodeData>;
                    },
                );

                const newEdges = (copiedEdges || [])
                    .map((edge: Edge) => ({
                        ...edge,
                        id: uuidv4(),
                        source: idMap[edge.source] || edge.source,
                        target: idMap[edge.target] || edge.target,
                        selected: true,
                    }))
                    .filter(
                        (edge: Edge) =>
                            idMap[edge.source] && idMap[edge.target],
                    );

                onNodesChange(
                    nodes.map((n) => ({
                        id: n.id,
                        type: "select",
                        selected: false,
                    })),
                );
                onEdgesChange(
                    edges.map((e) => ({
                        id: e.id,
                        type: "select",
                        selected: false,
                    })),
                );

                newNodes.forEach((node: Node<NodeData>) =>
                    useFlowStore.getState().addNode(node),
                );
                if (newEdges.length > 0) {
                    useFlowStore
                        .getState()
                        .setEdges([
                            ...useFlowStore.getState().edges,
                            ...newEdges,
                        ]);
                }
            } catch (error) {
                logger.error("Error pasting nodes:", error);
            }
        }
    }, [rfInstance, onNodesChange, onEdgesChange, nodes, edges]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            const isEditable =
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target?.isContentEditable;

            if ((event.ctrlKey || event.metaKey) && event.key === "c") {
                if (isEditable) return;

                const selection = window.getSelection();
                if (selection && selection.toString().length > 0) {
                    return;
                }

                copyNodes();
            }
            if ((event.ctrlKey || event.metaKey) && event.key === "v") {
                if (isEditable) return;
                pasteNodes();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [copyNodes, pasteNodes]);
}
