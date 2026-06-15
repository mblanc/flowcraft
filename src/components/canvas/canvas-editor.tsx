"use client";

import { useMemo, useCallback, useEffect, useRef, useState } from "react";
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
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CanvasHeader } from "./canvas-header";
import { CanvasToolbar } from "./canvas-toolbar";
import { CanvasChatPanel } from "./canvas-chat-panel";
import { CanvasNode as CanvasImageNode } from "@/primitives/image/CanvasNode";
import { CanvasNode as CanvasVideoNode } from "@/primitives/video/CanvasNode";
import { CanvasNode as CanvasAudioNode } from "@/primitives/music/CanvasNode";
import { CanvasTextNode } from "./nodes/canvas-text-node";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { useCanvasDragDrop } from "@/hooks/use-canvas-drag-drop";
import logger from "@/app/logger";

const canvasNodeTypes = {
    "canvas-image": CanvasImageNode,
    "canvas-video": CanvasVideoNode,
    "canvas-audio": CanvasAudioNode,
    "canvas-text": CanvasTextNode,
};

export function CanvasEditor({ readOnly = false }: { readOnly?: boolean }) {
    const router = useRouter();
    const { resolvedTheme } = useTheme();
    const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
    const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(
        null,
    );
    const [fittedCanvasId, setFittedCanvasId] = useState<string | null>(null);
    const [cloning, setCloning] = useState(false);

    const nodes = useCanvasStore((s) => s.nodes);
    const canvasId = useCanvasStore((s) => s.canvasId);
    const onNodesChange = useCanvasStore((s) => s.onNodesChange);
    const setViewport = useCanvasStore((s) => s.setViewport);
    const removeSelectedNodes = useCanvasStore((s) => s.removeSelectedNodes);
    const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);

    const { onDragOver, onDrop } = useCanvasDragDrop(rfInstance);

    const handleClone = useCallback(async () => {
        if (!canvasId) return;
        setCloning(true);
        try {
            const res = await fetch(`/api/canvases/${canvasId}/clone`, {
                method: "POST",
            });
            if (res.ok) {
                const clone = await res.json();
                router.push(`/canvas/${clone.id}`);
            }
        } catch (err) {
            logger.error("Clone failed:", err);
        } finally {
            setCloning(false);
        }
    }, [canvasId, router]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleInit = useCallback((instance: ReactFlowInstance<any>) => {
        rfInstanceRef.current = instance as ReactFlowInstance;
        setRfInstance(instance as ReactFlowInstance);
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

    const centerOnNodes = useCallback((x: number, y: number) => {
        const instance = rfInstanceRef.current;
        if (!instance) return;
        const { zoom } = instance.getViewport();
        instance.setCenter(x, y, { zoom, duration: 600 });
    }, []);

    useEffect(() => {
        if (
            rfInstance &&
            nodes.length > 0 &&
            fittedCanvasId !== canvasId &&
            canvasId
        ) {
            window.requestAnimationFrame(() => {
                rfInstance.fitView({ padding: 0.2 });
                setFittedCanvasId(canvasId);
            });
        }
    }, [rfInstance, nodes.length, fittedCanvasId, canvasId]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                (e.target instanceof HTMLElement && e.target.isContentEditable)
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
            <CanvasHeader readOnly={readOnly} />
            {readOnly && (
                <div className="bg-muted/60 border-border flex items-center justify-between border-b px-4 py-2">
                    <p className="text-muted-foreground text-sm">
                        You are viewing this canvas in read-only mode.
                    </p>
                    <Button size="sm" onClick={handleClone} disabled={cloning}>
                        <Copy className="mr-2 h-3.5 w-3.5" />
                        {cloning ? "Cloning…" : "Clone to my workspace"}
                    </Button>
                </div>
            )}
            <div className="flex flex-1 overflow-hidden">
                {/* Canvas area */}
                <div className="relative h-full flex-1">
                    {!readOnly && (
                        <CanvasToolbar getViewportCenter={getViewportCenter} />
                    )}
                    <ReactFlow
                        nodes={nodes}
                        edges={[]}
                        onNodesChange={readOnly ? undefined : onNodesChange}
                        nodeTypes={canvasNodeTypes}
                        onInit={handleInit}
                        onMoveEnd={handleMoveEnd}
                        onPaneClick={handlePaneClick}
                        onDragOver={readOnly ? undefined : onDragOver}
                        onDrop={readOnly ? undefined : onDrop}
                        selectionOnDrag={!readOnly}
                        selectionMode={SelectionMode.Partial}
                        panOnDrag={[2]}
                        panOnScroll
                        nodesDraggable={!readOnly}
                        nodesConnectable={!readOnly}
                        elementsSelectable={!readOnly}
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

                    {!readOnly && (
                        <CanvasChatPanel
                            getViewportCenter={getViewportCenter}
                            centerOnNodes={centerOnNodes}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
