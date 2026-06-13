"use client";

import { useCallback } from "react";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import logger from "@/app/logger";
import { useAutoSave } from "@/hooks/use-auto-save";

const AUTO_SAVE_DEBOUNCE_MS = 2000;

export function useCanvasPersistence() {
    const canvasId = useCanvasStore((s) => s.canvasId);
    const lastModified = useCanvasStore((s) => s.lastModified);
    const setSaveStatus = useCanvasStore((s) => s.setSaveStatus);

    const saveCanvas = useCallback(async () => {
        const { canvasId, canvasName, nodes, viewport, messages } =
            useCanvasStore.getState();
        if (!canvasId) return;

        setSaveStatus("saving");

        try {
            const response = await fetch(`/api/canvases/${canvasId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: canvasName,
                    nodes,
                    viewport,
                    messages,
                }),
            });

            if (response.ok) {
                setSaveStatus("saved");
                logger.info("Canvas saved successfully");
            } else {
                setSaveStatus("error");
                logger.error("Error saving canvas: bad response");
            }
        } catch (error) {
            setSaveStatus("error");
            logger.error("Error saving canvas:", error);
        }
    }, [setSaveStatus]);

    useAutoSave({
        entityId: canvasId,
        lastModified,
        onSave: saveCanvas,
        debounceMs: AUTO_SAVE_DEBOUNCE_MS,
    });

    return { saveCanvas };
}
