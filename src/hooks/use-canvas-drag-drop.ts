"use client";

import { useCallback } from "react";
import type React from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import type { CanvasNode } from "@/lib/canvas/types";
import logger from "@/app/logger";
import { uploadFile } from "@/lib/utils";

export function useCanvasDragDrop(rfInstance: ReactFlowInstance | null) {
    const addNode = useCanvasStore((s) => s.addNode);
    const updateNodeData = useCanvasStore((s) => s.updateNodeData);
    const getNextLabel = useCanvasStore((s) => s.getNextLabel);
    const getNextNodeId = useCanvasStore((s) => s.getNextNodeId);

    const onDragOver = useCallback((event: React.DragEvent) => {
        if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
        }
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            if (!rfInstance) return;
            if (!event.dataTransfer.files?.length) return;

            const file = event.dataTransfer.files[0];
            const isImage = file.type.startsWith("image/");
            const isVideo = file.type.startsWith("video/");
            if (!isImage && !isVideo) return;

            event.preventDefault();

            const position = rfInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const nodeType = isImage ? "canvas-image" : "canvas-video";
            const id = getNextNodeId(nodeType);
            const label = getNextLabel(nodeType);

            const node: CanvasNode = {
                id,
                type: nodeType,
                position,
                data: isImage
                    ? {
                          type: "canvas-image" as const,
                          label,
                          sourceUrl: "",
                          mimeType: file.type,
                          width: 300,
                          height: 300,
                          status: "pending" as const,
                      }
                    : {
                          type: "canvas-video" as const,
                          label,
                          sourceUrl: "",
                          mimeType: file.type,
                          status: "pending" as const,
                      },
            };

            addNode(node);

            uploadFile(file)
                .then((data) => {
                    updateNodeData(id, {
                        sourceUrl: data.gcsUri,
                        status: "ready",
                    });
                })
                .catch((err) => {
                    logger.error("Canvas drop upload error:", err);
                    updateNodeData(id, { status: "error" });
                });
        },
        [rfInstance, addNode, updateNodeData, getNextLabel, getNextNodeId],
    );

    return { onDragOver, onDrop };
}
