"use client";

import { useCallback, useRef, useEffect } from "react";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import logger from "@/app/logger";

const AUTO_SAVE_DEBOUNCE_MS = 500;

export function useCanvasPersistence() {
    const canvasId = useCanvasStore((s) => s.canvasId);
    const lastModified = useCanvasStore((s) => s.lastModified);
    const setSaveStatus = useCanvasStore((s) => s.setSaveStatus);
    const lastSavedRef = useRef<number>(0);

    const saveCanvas = useCallback(async () => {
        const { canvasId, canvasName, nodes, viewport, messages } =
            useCanvasStore.getState();
        if (!canvasId) return;

        const currentModified = useCanvasStore.getState().lastModified;
        lastSavedRef.current = currentModified;
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

    useEffect(() => {
        if (!canvasId || !lastModified) return;
        if (lastModified <= lastSavedRef.current) return;

        const timeout = setTimeout(() => {
            void saveCanvas();
        }, AUTO_SAVE_DEBOUNCE_MS);

        return () => clearTimeout(timeout);
    }, [lastModified, canvasId, saveCanvas]);

    return { saveCanvas };
}
