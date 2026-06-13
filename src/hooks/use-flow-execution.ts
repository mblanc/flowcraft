"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
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

function buildContext(userId: string | undefined): ExecutionContext {
    const { flowId, flowName } = useFlowStore.getState();
    const ctx: Pick<ExecutionContext, "userId" | "flowId" | "flowName"> = {
        userId,
        flowId: flowId ?? undefined,
        flowName: flowName ?? undefined,
    };
    return {
        ...ctx,
        onMediaGenerated: (node, result) => onMediaGenerated(node, result, ctx),
        signedUrlPrefetch,
    };
}

// Captures current graph state at call time — must not be memoised at render time.
function createEngine(userId: string | undefined): WorkflowEngine {
    const { nodes, edges, updateNodeData } = useFlowStore.getState();
    return new WorkflowEngine(
        nodes,
        edges,
        updateNodeData,
        buildContext(userId),
    );
}

export function useFlowExecution() {
    const { data: session } = useSession();
    const userId = session?.user?.id ?? undefined;

    const runFromNode = useCallback(
        async (nodeId: string) => {
            try {
                await createEngine(userId).runFromNode(nodeId);
            } catch (error) {
                logger.error("Error running from node:", error);
            }
        },
        [userId],
    );

    const executeNode = useCallback(
        async (nodeId: string) => {
            try {
                await createEngine(userId).executeNodeWithRouterResolution(
                    nodeId,
                );
            } catch (error) {
                logger.error("Error executing node:", error);
            }
        },
        [userId],
    );

    const runToNode = useCallback(
        async (nodeId: string) => {
            try {
                await createEngine(userId).runToNode(nodeId);
            } catch (error) {
                logger.error("Error running to node:", error);
            }
        },
        [userId],
    );

    return {
        runFromNode,
        executeNode,
        runToNode,
    };
}
