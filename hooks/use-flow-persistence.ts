"use client";

import { useCallback, useRef, useEffect } from "react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import { ImageData, UpscaleData, ResizeData, VideoData, NodeData } from "@/lib/types";
import logger from "@/app/logger";
import { useSession } from "next-auth/react";

export function useFlowPersistence() {
    const setNodes = useFlowStore((state) => state.setNodes);
    const setEdges = useFlowStore((state) => state.setEdges);
    const setFlowName = useFlowStore((state) => state.setFlowName);
    const flowId = useFlowStore((state: FlowState) => state.flowId);
    const lastModified = useFlowStore((state: FlowState) => state.lastModified);
    const ownerId = useFlowStore((state: FlowState) => state.ownerId);
    const sharedWith = useFlowStore((state: FlowState) => state.sharedWith);
    const isTemplate = useFlowStore((state: FlowState) => state.isTemplate);
    const entityType = useFlowStore((state: FlowState) => state.entityType);

    const { data: session } = useSession();
    const lastSavedRef = useRef<number>(0);

    const isOwner =
        !!session?.user?.id && !!ownerId && session.user.id === ownerId;
    const isEditor =
        !!session?.user?.email &&
        sharedWith?.some(
            (s: any) => s.email === session.user?.email && s.role === "edit",
        );
    const isEditable = isOwner || isEditor || isTemplate;

    const getThumbnailFromNodes = useCallback(
        (
            nodes: ReturnType<typeof useFlowStore.getState>["nodes"],
        ): string | undefined => {
            const imageNodes = nodes.filter((node) => {
                const data = node.data;
                if (
                    data.type === "image" &&
                    (data as ImageData).images?.length > 0
                )
                    return true;
                if (data.type === "upscale" && (data as UpscaleData).image)
                    return true;
                if (data.type === "resize" && (data as ResizeData).output)
                    return true;
                if (
                    data.type === "video" &&
                    (data as VideoData).images?.length > 0
                )
                    return true;
                return false;
            });

            if (imageNodes.length > 0) {
                imageNodes.sort((a, b) => {
                    const timeA = a.data.generatedAt || 0;
                    const timeB = b.data.generatedAt || 0;
                    return timeB - timeA;
                });

                const latestNode = imageNodes[0];
                const data = latestNode.data;
                if (data.type === "image") return (data as ImageData).images[0];
                else if (data.type === "upscale")
                    return (data as UpscaleData).image;
                else if (data.type === "resize")
                    return (data as ResizeData).output;
                else if (data.type === "video")
                    return (data as VideoData).images[0];
            }
            return undefined;
        },
        [],
    );

    const saveFlow = useCallback(
        async (thumbnail?: string) => {
            const { flowId, flowName, nodes, edges, entityType } =
                useFlowStore.getState();
            if (!flowId || !isEditable) return;

            const thumbnailToUse = thumbnail || getThumbnailFromNodes(nodes);

            const apiPath =
                entityType === "custom-node"
                    ? `/api/custom-nodes/${flowId}`
                    : `/api/flows/${flowId}`;

            const currentModified = useFlowStore.getState().lastModified;
            lastSavedRef.current = currentModified;

            try {
                // Strip transient UI flags from node data before persisting to Firestore
                const cleanedNodes = nodes.map((node) => {
                    const { executing, batchProgress, batchTotal, ...cleanData } =
                        node.data;
                    return {
                        ...node,
                        data: cleanData,
                    };
                });

                const response = await fetch(apiPath, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        name: flowName,
                        nodes: cleanedNodes,
                        edges,
                        ...(thumbnailToUse !== undefined && {
                            thumbnail: thumbnailToUse,
                        }),
                    }),
                });

                if (response.ok) {
                    logger.info(
                        `${entityType === "custom-node" ? "Custom node" : "Flow"} saved successfully`,
                    );
                }
            } catch (error) {
                logger.error("Error saving:", error);
            }
        },
        [getThumbnailFromNodes, isEditable],
    );

    const exportFlow = useCallback(() => {
        const { flowName, nodes, edges } = useFlowStore.getState();
        const flowData = {
            name: flowName,
            nodes,
            edges,
        };
        const blob = new Blob([JSON.stringify(flowData, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${flowName.replace(/\s+/g, "-").toLowerCase()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);

    const importFlow = useCallback(() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const flowData = JSON.parse(
                            event.target?.result as string,
                        );
                        if (flowData.nodes && flowData.edges) {
                            setNodes(flowData.nodes);
                            setEdges(flowData.edges);
                            if (flowData.name) setFlowName(flowData.name);
                        }
                    } catch (error) {
                        logger.error("Error importing flow:", error);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }, [setNodes, setEdges, setFlowName]);

    // Auto-save logic
    useEffect(() => {
        if (!isEditable || !flowId || !lastModified) return;

        // If we haven't modified since last save, skip
        if (lastModified <= lastSavedRef.current) return;

        const timeout = setTimeout(() => {
            void saveFlow();
        }, 3000); // 3-second debounce

        return () => clearTimeout(timeout);
    }, [lastModified, flowId, isEditable, saveFlow]);

    return {
        saveFlow,
        exportFlow,
        importFlow,
    };
}
