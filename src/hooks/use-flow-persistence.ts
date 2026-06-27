"use client";

import { useCallback } from "react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { ImageData, UpscaleData, ResizeData, VideoData } from "@/lib/types";
import logger from "@/app/logger";
import { useSession } from "next-auth/react";
import { useAutoSave } from "@/hooks/use-auto-save";
import { FlowImportSchema } from "@/lib/schemas";

const AUTO_SAVE_DEBOUNCE_MS = 2000;

export function useFlowPersistence() {
    const setNodes = useFlowStore((state) => state.setNodes);
    const setEdges = useFlowStore((state) => state.setEdges);
    const setFlowName = useFlowStore((state) => state.setFlowName);
    const setSaveStatus = useFlowStore((state) => state.setSaveStatus);
    const flowId = useFlowStore((state) => state.flowId);
    const lastModified = useFlowStore((state) => state.lastModified);
    const ownerId = useFlowStore((state) => state.ownerId);
    const sharedWith = useFlowStore((state) => state.sharedWith);

    const { data: session } = useSession();

    const isOwner =
        !!session?.user?.id && !!ownerId && session.user.id === ownerId;
    const isEditor =
        !!session?.user?.email &&
        sharedWith?.some(
            (s) => s.email === session.user?.email && s.role === "edit",
        );
    const isEditable = isOwner || isEditor;

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

            if (imageNodes.length === 0) return undefined;

            imageNodes.sort(
                (a, b) => (b.data.generatedAt || 0) - (a.data.generatedAt || 0),
            );

            const { data } = imageNodes[0];
            if (data.type === "image") return (data as ImageData).images[0];
            if (data.type === "upscale") return (data as UpscaleData).image;
            if (data.type === "resize") return (data as ResizeData).output;
            if (data.type === "video") return (data as VideoData).images[0];
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

            setSaveStatus("saving");

            const cleanedNodes = nodes.map((node) => {
                const {
                    executing: _executing,
                    batchProgress: _batchProgress,
                    batchTotal: _batchTotal,
                    ...cleanData
                } = node.data;
                return { ...node, data: cleanData };
            });

            let response: Response;
            try {
                response = await fetch(apiPath, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: flowName,
                        nodes: cleanedNodes,
                        edges,
                        ...(thumbnailToUse !== undefined && {
                            thumbnail: thumbnailToUse,
                        }),
                    }),
                });
            } catch (error) {
                setSaveStatus("error");
                logger.error("Error saving:", error);
                throw error;
            }

            if (response.ok) {
                setSaveStatus("saved");
                logger.info(
                    `${entityType === "custom-node" ? "Custom node" : "Flow"} saved successfully`,
                );
            } else {
                setSaveStatus("error");
                logger.error("Error saving: bad response");
                throw new Error("Save failed: bad response");
            }
        },
        [getThumbnailFromNodes, isEditable, setSaveStatus],
    );

    useAutoSave({
        entityId: isEditable ? flowId : null,
        lastModified,
        onSave: saveFlow,
        debounceMs: AUTO_SAVE_DEBOUNCE_MS,
    });

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
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 100);
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
                        const parsed = FlowImportSchema.safeParse(
                            JSON.parse(event.target?.result as string),
                        );
                        if (!parsed.success) {
                            logger.error(
                                "Error importing flow: invalid format",
                                parsed.error,
                            );
                            return;
                        }
                        const { nodes, edges, name } = parsed.data;
                        setNodes(nodes);
                        setEdges(edges);
                        if (name) setFlowName(name);
                    } catch (error) {
                        logger.error("Error importing flow:", error);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }, [setNodes, setEdges, setFlowName]);

    return {
        saveFlow,
        exportFlow,
        importFlow,
    };
}
