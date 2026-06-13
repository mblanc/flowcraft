"use client";

import { useCallback } from "react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { WorkflowEngine } from "@/lib/flow/workflow-engine";
import { fetchAndCacheSignedUrl } from "@/lib/cache/signed-urls";
import { registry } from "@/primitives/registry";
import type { NodeData, ExecutionContext } from "@/lib/types";
import type { Node } from "@xyflow/react";
import logger from "@/app/logger";

async function onMediaGenerated(
    node: Node<NodeData>,
    result: Partial<NodeData>,
    ctx: Pick<ExecutionContext, "userId" | "flowId" | "flowName" | "fetch">,
): Promise<void> {
    const { userId, flowId } = ctx;
    if (!userId || !flowId) return;
    const primitive = registry.getByFlowType(node.data.type);
    if (!primitive?.flow?.saveToLibrary) return;
    await primitive.flow.saveToLibrary(node, result, {
        userId,
        flowId,
        flowName: ctx.flowName,
        fetch: ctx.fetch ?? fetch,
    });
}

async function signedUrlPrefetch(uris: string[]): Promise<void> {
    await Promise.all(uris.map(fetchAndCacheSignedUrl));
}

function buildContext(): ExecutionContext {
    const { flowId, flowName, ownerId } = useFlowStore.getState();
    const ctx: Pick<ExecutionContext, "userId" | "flowId" | "flowName"> = {
        userId: ownerId ?? undefined,
        flowId: flowId ?? undefined,
        flowName: flowName ?? undefined,
    };
    return {
        ...ctx,
        onMediaGenerated: (node, result) => onMediaGenerated(node, result, ctx),
        signedUrlPrefetch,
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
