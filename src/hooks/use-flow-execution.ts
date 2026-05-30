"use client";

import { useCallback } from "react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { WorkflowEngine } from "@/lib/workflow-engine";
import logger from "@/app/logger";

function buildContext() {
    const { flowId, flowName, ownerId } = useFlowStore.getState();
    return {
        userId: ownerId ?? undefined,
        flowId: flowId ?? undefined,
        flowName: flowName ?? undefined,
    };
}

export function useFlowExecution() {
    const setIsRunning = useFlowStore((state) => state.setIsRunning);

    const runFlow = useCallback(async () => {
        const { nodes, edges, updateNodeData } = useFlowStore.getState();
        setIsRunning(true);
        try {
            const engine = new WorkflowEngine(
                nodes,
                edges,
                updateNodeData,
                buildContext(),
            );
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
            const engine = new WorkflowEngine(
                nodes,
                edges,
                updateNodeData,
                buildContext(),
            );
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
                const engine = new WorkflowEngine(
                    nodes,
                    edges,
                    updateNodeData,
                    buildContext(),
                );
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
            const engine = new WorkflowEngine(
                nodes,
                edges,
                updateNodeData,
                buildContext(),
            );
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
