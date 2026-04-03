"use client";

import { useMemo, useCallback, useEffect, useRef } from "react";
import {
    ReactFlow,
    Controls,
    Background,
    BackgroundVariant,
    SelectionMode,
    type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { CanvasHeader } from "./canvas-header";
import { CanvasToolbar } from "./canvas-toolbar";
import { CanvasChatPanel } from "./canvas-chat-panel";
import { CanvasImageNode } from "./nodes/canvas-image-node";
import { CanvasVideoNode } from "./nodes/canvas-video-node";
import { CanvasTextNode } from "./nodes/canvas-text-node";
import { useCanvasStore } from "@/lib/store/use-canvas-store";

const canvasNodeTypes = {
    "canvas-image": CanvasImageNode,
    "canvas-video": CanvasVideoNode,
    "canvas-text": CanvasTextNode,
};

export function CanvasEditor() {
    const { resolvedTheme } = useTheme();
    const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

    const nodes = useCanvasStore((s) => s.nodes);
    const onNodesChange = useCanvasStore((s) => s.onNodesChange);
    const setViewport = useCanvasStore((s) => s.setViewport);
    const removeSelectedNodes = useCanvasStore((s) => s.removeSelectedNodes);
    const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleInit = useCallback((instance: ReactFlowInstance<any>) => {
        rfInstanceRef.current = instance as ReactFlowInstance;
    }, []);

    const handleMoveEnd = useCallback(
        (_: unknown, viewport: { x: number; y: number; zoom: number }) => {
            setViewport(viewport);
        },
        [setViewport],
    );

    const handlePaneClick = useCallback(() => {
        useCanvasStore.getState().setSelectedNodeIds([]);
    }, []);

    const getViewportCenter = useCallback(() => {
        const instance = rfInstanceRef.current;
        if (!instance) return { x: 0, y: 0 };
        const container = document.querySelector(".react-flow");
        const w = container?.clientWidth ?? 800;
        const h = container?.clientHeight ?? 600;
        return instance.screenToFlowPosition({
            x: w / 2,
            y: h / 2,
        });
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
            ) {
                return;
            }

            if (
                (e.key === "Delete" || e.key === "Backspace") &&
                selectedNodeIds.length > 0
            ) {
                e.preventDefault();
                removeSelectedNodes();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [selectedNodeIds, removeSelectedNodes]);

    const background = useMemo(
        () => (
            <Background
                color={resolvedTheme === "dark" ? "#ffffff" : "#000000"}
                variant={BackgroundVariant.Dots}
            />
        ),
        [resolvedTheme],
    );

    return (
        <div className="bg-background flex h-screen flex-col">
            <CanvasHeader />
            <div className="flex flex-1 overflow-hidden">
                <CanvasToolbar getViewportCenter={getViewportCenter} />

                {/* Canvas area */}
                <div className="relative h-full flex-1">
                    <ReactFlow
                        nodes={nodes}
                        edges={[]}
                        onNodesChange={onNodesChange}
                        nodeTypes={canvasNodeTypes}
                        onInit={handleInit}
                        onMoveEnd={handleMoveEnd}
                        onPaneClick={handlePaneClick}
                        selectionOnDrag
                        selectionMode={SelectionMode.Partial}
                        panOnDrag={[2]}
                        panOnScroll
                        proOptions={{ hideAttribution: true }}
                        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                        minZoom={0.1}
                        maxZoom={4}
                        className="react-flow"
                        deleteKeyCode={null}
                    >
                        {background}
                        <Controls />
                    </ReactFlow>

                    <CanvasChatPanel getViewportCenter={getViewportCenter} />
                </div>
            </div>
        </div>
    );
}
