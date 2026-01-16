"use client";

import { useCallback } from "react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { ImageData, UpscaleData, ResizeData, VideoData } from "@/lib/types";

export function useFlowPersistence() {
    const nodes = useFlowStore((state) => state.nodes);
    const edges = useFlowStore((state) => state.edges);
    const flowId = useFlowStore((state) => state.flowId);
    const flowName = useFlowStore((state) => state.flowName);
    const setNodes = useFlowStore((state) => state.setNodes);
    const setEdges = useFlowStore((state) => state.setEdges);
    const setFlowName = useFlowStore((state) => state.setFlowName);

    const saveFlow = useCallback(
        async (thumbnail?: string) => {
            if (!flowId) return;

            let thumbnailToUse = thumbnail;

            if (!thumbnailToUse) {
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
                    if (data.type === "image")
                        thumbnailToUse = (data as ImageData).images[0];
                    else if (data.type === "upscale")
                        thumbnailToUse = (data as UpscaleData).image;
                    else if (data.type === "resize")
                        thumbnailToUse = (data as ResizeData).output;
                    else if (data.type === "video")
                        thumbnailToUse = (data as VideoData).images[0];
                }
            }

            try {
                await fetch(`/api/flows/${flowId}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        name: flowName,
                        nodes,
                        edges,
                        ...(thumbnailToUse !== undefined && {
                            thumbnail: thumbnailToUse,
                        }),
                    }),
                });
                console.log("Flow auto-saved");
            } catch (error) {
                console.error("Error saving flow:", error);
            }
        },
        [flowId, flowName, nodes, edges],
    );

    const exportFlow = useCallback(() => {
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
    }, [flowName, nodes, edges]);

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
                        console.error("Error importing flow:", error);
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
