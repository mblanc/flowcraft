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
        executeNode,
    };
}
