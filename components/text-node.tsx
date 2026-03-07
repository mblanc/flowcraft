"use client";

import type React from "react";

import { memo, useState, useEffect, useRef } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { TextData } from "@/lib/types";
import {
    FileText,
    Play,
    ChevronDown,
    FastForward,
    Loader2,
    Settings,
} from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { useFlowExecution } from "@/hooks/use-flow-execution";
import { Textarea } from "./ui/textarea";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCallback } from "react";

export const TextNode = memo(
    ({ data, selected, id }: NodeProps<Node<TextData>>) => {
        const selectNode = useFlowStore((state) => state.selectNode);
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const [localText, setLocalText] = useState(data.text);
        const [prevDataText, setPrevDataText] = useState(data.text);
        const [dimensions, setDimensions] = useState({
            width: data.width || 300,
            height: data.height || 150,
        });
        const [prevDataWidth, setPrevDataWidth] = useState(data.width);
        const [prevDataHeight, setPrevDataHeight] = useState(data.height);
        const [isResizing, setIsResizing] = useState(false);
        const { executeNode, runFromNode } = useFlowExecution();
        const [isRunMenuOpen, setIsRunMenuOpen] = useState(false);
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const nodeRef = useRef<HTMLDivElement>(null);
        const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

        if (data.text !== prevDataText) {
            setPrevDataText(data.text);
            setLocalText(data.text);
        }

        if (data.width !== prevDataWidth || data.height !== prevDataHeight) {
            setPrevDataWidth(data.width);
            setPrevDataHeight(data.height);
            setDimensions({
                width: data.width || 300,
                height: data.height || 150,
            });
        }

        // Prevent canvas zoom when scrolling inside textarea (works for mouse wheel and touchpad)
        useEffect(() => {
            const textarea = textareaRef.current;
            const container = nodeRef.current;
            if (!textarea || !container) return;

            const handleWheel = (e: WheelEvent) => {
                const target = e.target as HTMLElement;
                const isTextareaFocused = document.activeElement === textarea;
                const isInsideTextarea =
                    target === textarea || textarea.contains(target);

                // If wheel event is on textarea, inside it, or textarea is focused, prevent canvas zoom
                if (isInsideTextarea || isTextareaFocused) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    // Allow native scrolling behavior by not preventing default
                    return false;
                }
            };

            // Use capture phase to intercept before React Flow processes it
            // This catches events in the capture phase before they bubble up
            // Also handle at the textarea level with both capture and bubble phases
            const options = { capture: true, passive: false };
            container.addEventListener("wheel", handleWheel, options);
            textarea.addEventListener("wheel", handleWheel, options);
            // Also add non-capture listener for extra safety
            textarea.addEventListener("wheel", handleWheel, { passive: false });

            // Also handle focus/blur to track when textarea is active
            let focusedHandler: ((e: WheelEvent) => void) | null = null;

            const handleFocus = () => {
                // Add a more aggressive wheel handler when focused
                focusedHandler = (e: WheelEvent) => {
                    const target = e.target as HTMLElement;
                    // Only stop if event is on textarea or inside container
                    if (
                        target === textarea ||
                        textarea.contains(target) ||
                        container.contains(target)
                    ) {
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                    }
                };
                document.addEventListener("wheel", focusedHandler, {
                    capture: true,
                    passive: false,
                });
            };

            const handleBlur = () => {
                if (focusedHandler) {
                    document.removeEventListener("wheel", focusedHandler, {
                        capture: true,
                    });
                    focusedHandler = null;
                }
            };

            textarea.addEventListener("focus", handleFocus);
            textarea.addEventListener("blur", handleBlur);

            return () => {
                container.removeEventListener("wheel", handleWheel, {
                    capture: true,
                });
                textarea.removeEventListener("wheel", handleWheel, {
                    capture: true,
                });
                textarea.removeEventListener("wheel", handleWheel);
                textarea.removeEventListener("focus", handleFocus);
                textarea.removeEventListener("blur", handleBlur);
                if (focusedHandler) {
                    document.removeEventListener("wheel", focusedHandler, {
                        capture: true,
                    });
                }
            };
        }, []);

        const handleTextChange = (
            e: React.ChangeEvent<HTMLTextAreaElement>,
        ) => {
            setLocalText(e.target.value);
        };

        const handleBlur = () => {
            updateNodeData(id, { text: localText });
        };

        const handleWheel = (e: React.WheelEvent<HTMLTextAreaElement>) => {
            // Stop propagation to prevent canvas zoom when scrolling text
            e.stopPropagation();
        };

        const handleExecute = useCallback(
            (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                executeNode(id);
            },
            [executeNode, id],
        );

        const handleRunFromHere = useCallback(
            (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                runFromNode(id);
            },
            [runFromNode, id],
        );

        const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            setIsResizing(true);
            resizeStartRef.current = {
                x: e.clientX,
                y: e.clientY,
                width: dimensions.width,
                height: dimensions.height,
            };
        };

        useEffect(() => {
            if (!isResizing) return;

            const handleMouseMove = (e: MouseEvent) => {
                const deltaX = e.clientX - resizeStartRef.current.x;
                const deltaY = e.clientY - resizeStartRef.current.y;
                const newWidth = Math.max(
                    220,
                    resizeStartRef.current.width + deltaX,
                );
                const newHeight = Math.max(
                    100,
                    resizeStartRef.current.height + deltaY,
                );
                setDimensions({ width: newWidth, height: newHeight });
            };

            const handleMouseUp = () => {
                setIsResizing(false);
                updateNodeData(id, {
                    width: dimensions.width,
                    height: dimensions.height,
                });
            };

            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);

            return () => {
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
            };
        }, [
            isResizing,
            id,
            updateNodeData,
            dimensions.width,
            dimensions.height,
        ]);

        return (
            <div
                ref={nodeRef}
                className={`bg-card relative rounded-lg border-2 p-4 shadow-lg transition-all ${
                    selected
                        ? "border-primary shadow-primary/20"
                        : "border-border"
                }`}
                style={{ width: dimensions.width }}
            >
                {"executing" in data && data.executing && (
                    <div
                        className="border-beam-glow"
                        style={
                            { "--beam-color": "#a855f7" } as React.CSSProperties
                        }
                    />
                )}

                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-purple-500/10">
                        <FileText className="h-5 w-5 text-purple-400" />
                    </div>

                    <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-foreground mb-1 truncate text-sm font-semibold">
                                {data.name}
                            </h3>
                            <div className="flex items-center gap-1">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                selectNode(id);
                                                useFlowStore
                                                    .getState()
                                                    .setIsConfigSidebarOpen(
                                                        true,
                                                    );
                                            }}
                                            className="flex h-8 w-8 items-center justify-center rounded-full text-purple-400 transition-colors hover:bg-purple-500/20"
                                        >
                                            <Settings className="h-4 w-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Settings</p>
                                    </TooltipContent>
                                </Tooltip>
                                <button
                                    onClick={handleExecute}
                                    disabled={
                                        "executing" in data && data.executing
                                    }
                                    className="flex h-8 w-8 items-center justify-center rounded-md text-purple-400 transition-colors hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    title="Execute Node"
                                >
                                    {"executing" in data && data.executing ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Play
                                            className="h-4 w-4"
                                            fill="currentColor"
                                        />
                                    )}
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() =>
                                            setIsRunMenuOpen(!isRunMenuOpen)
                                        }
                                        disabled={
                                            "executing" in data &&
                                            data.executing
                                        }
                                        className={`flex h-8 w-8 items-center justify-center rounded-md text-purple-400 transition-colors hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${isRunMenuOpen ? "bg-purple-500/20" : ""}`}
                                    >
                                        <ChevronDown
                                            className={`h-4 w-4 transition-transform ${isRunMenuOpen ? "rotate-180" : ""}`}
                                        />
                                    </button>
                                    {isRunMenuOpen && (
                                        <div className="bg-card border-border absolute right-0 z-10 mt-1 min-w-[120px] rounded-md border shadow-lg">
                                            <button
                                                onClick={(e) => {
                                                    handleRunFromHere(e);
                                                    setIsRunMenuOpen(false);
                                                }}
                                                disabled={
                                                    "executing" in data &&
                                                    data.executing
                                                }
                                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-purple-400 transition-colors hover:bg-purple-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <FastForward className="h-3 w-3" />
                                                Run from here
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div
                            onWheel={(e) => {
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                            }}
                            className="nodrag"
                        >
                            <Textarea
                                ref={textareaRef}
                                value={localText}
                                onChange={handleTextChange}
                                onBlur={handleBlur}
                                onWheel={handleWheel}
                                placeholder="Enter text..."
                                className="nodrag w-full resize-none overflow-y-auto border-none bg-transparent px-2 py-1 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                                style={{ height: dimensions.height - 80 }}
                            />
                        </div>
                    </div>
                </div>

                {/* Resize handle */}
                <div
                    className="nodrag absolute right-0 bottom-0 h-4 w-4 cursor-se-resize"
                    onMouseDown={handleResizeStart}
                    style={{ touchAction: "none" }}
                >
                    <div className="border-muted-foreground/30 absolute right-1 bottom-1 h-3 w-3 rounded-br border-r-2 border-b-2" />
                </div>

                <Handle
                    type="source"
                    position={Position.Right}
                    className="!bg-purple-500"
                />
            </div>
        );
    },
);

TextNode.displayName = "TextNode";
