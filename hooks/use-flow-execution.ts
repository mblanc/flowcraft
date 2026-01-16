"use client";

import { useCallback } from "react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { WorkflowEngine } from "@/lib/workflow-engine";

export function useFlowExecution() {
    const nodes = useFlowStore((state) => state.nodes);
    const edges = useFlowStore((state) => state.edges);
    const updateNodeData = useFlowStore((state) => state.updateNodeData);
    const setIsRunning = useFlowStore((state) => state.setIsRunning);

    const runFlow = useCallback(async () => {
        setIsRunning(true);
        try {
            const engine = new WorkflowEngine(nodes, edges, updateNodeData);
            await engine.run();
        } catch (error) {
            console.error("Error running flow:", error);
        } finally {
            setIsRunning(false);
        }
    }, [nodes, edges, updateNodeData, setIsRunning]);

    const executeNode = useCallback(
        async (nodeId: string) => {
            try {
                const engine = new WorkflowEngine(nodes, edges, updateNodeData);
                await engine.executeNode(nodeId);
            } catch (error) {
                console.error("Error executing node:", error);
            }
        },
        [nodes, edges, updateNodeData],
    );

    return {
        runFlow,
        executeNode,
    };
}
