"use client";

import { useCallback } from "react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { WorkflowEngine } from "@/lib/workflow-engine";
import logger from "@/app/logger";

export function useFlowExecution() {
    const setIsRunning = useFlowStore((state) => state.setIsRunning);

    const runFlow = useCallback(async () => {
        const { nodes, edges, updateNodeData } = useFlowStore.getState();
        setIsRunning(true);
        try {
            const engine = new WorkflowEngine(nodes, edges, updateNodeData);
            await engine.run();
        } catch (error) {
            logger.error("Error running flow:", error);
        } finally {
            setIsRunning(false);
        }
    }, [setIsRunning]);

    const runSelectedNodes = useCallback(async () => {
        const { nodes, edges, updateNodeData } = useFlowStore.getState();
        const selectedNodes = nodes.filter((n) => n.selected);
        if (selectedNodes.length === 0) return;

        setIsRunning(true);
        try {
            const engine = new WorkflowEngine(nodes, edges, updateNodeData);
            // We need to execute nodes in order. The engine doesn't currently have a "runSelected"
            // but we can execute them individually or enhance the engine.
            // For now, let's run them individually if they have no dependencies within the selection,
            // or just rely on the engine's executeNode logic for each selected node.
            for (const node of selectedNodes) {
                await engine.executeNode(node.id);
            }
        } catch (error) {
            logger.error("Error running selected nodes:", error);
        } finally {
            setIsRunning(false);
        }
    }, [setIsRunning]);

    const runFromNode = useCallback(
        async (nodeId: string) => {
            const { nodes, edges, updateNodeData } = useFlowStore.getState();
            setIsRunning(true);
            try {
                const engine = new WorkflowEngine(nodes, edges, updateNodeData);
                await engine.runFromNode(nodeId);
            } catch (error) {
                logger.error("Error running from node:", error);
            } finally {
                setIsRunning(false);
            }
        },
        [setIsRunning],
    );

    const executeNode = useCallback(async (nodeId: string) => {
        const { nodes, edges, updateNodeData } = useFlowStore.getState();
        try {
            const engine = new WorkflowEngine(nodes, edges, updateNodeData);
            await engine.executeNode(nodeId);
        } catch (error) {
            logger.error("Error executing node:", error);
        }
    }, []);

    return {
        runFlow,
        runSelectedNodes,
        runFromNode,
        executeNode,
    };
}
