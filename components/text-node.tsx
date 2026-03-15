"use client";

import type React from "react";

import { memo, useState, useEffect, useRef } from "react";
import { useNodeResize } from "@/hooks/use-node-resize";
import { useSyncedState } from "@/hooks/use-synced-state";
import { NodeResizeHandle } from "@/components/nodes/node-resize-handle";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { TextData } from "@/lib/types";
import { FileText, Maximize2 } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { NodeTitle } from "@/components/node-title";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "./ui/textarea";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export const TextNode = memo(
    ({ data, selected, id }: NodeProps<Node<TextData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const [localText, setLocalText] = useSyncedState(data.text);
        const { dimensions, handleResizeStart } = useNodeResize(
            id,
            data.width,
            data.height,
            {
                defaultWidth: 300,
                defaultHeight: 150,
                minWidth: 220,
                minHeight: 100,
            },
        );
        const [isModalOpen, setIsModalOpen] = useState(false);
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const nodeRef = useRef<HTMLDivElement>(null);

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

        return (
            <div
                ref={nodeRef}
                className={cn(
                    "bg-card relative rounded-lg border-2 p-4 shadow-lg transition-[border-color,shadow,background-color]",
                    selected
                        ? "border-primary shadow-primary/20"
                        : "border-border",
                )}
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
                            <NodeTitle
                                name={data.name}
                                onRename={(n) =>
                                    updateNodeData(id, { name: n })
                                }
                                className="text-foreground mb-1"
                            />
                            <div className="flex items-center gap-1">
                                <Dialog
                                    open={isModalOpen}
                                    onOpenChange={setIsModalOpen}
                                >
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <DialogTrigger asChild>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                    }}
                                                    className="flex h-8 w-8 items-center justify-center rounded-full text-purple-400 transition-colors hover:bg-purple-500/20"
                                                >
                                                    <Maximize2 className="h-4 w-4" />
                                                </button>
                                            </DialogTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Expand text editor</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    <DialogContent className="flex h-[90vh] max-w-[90vw] flex-col overflow-hidden p-0">
                                        <DialogHeader className="border-b p-4">
                                            <DialogTitle className="flex items-center gap-2">
                                                <FileText className="h-5 w-5 text-purple-400" />
                                                <NodeTitle
                                                    name={data.name}
                                                    onRename={(n) =>
                                                        updateNodeData(id, {
                                                            name: n,
                                                        })
                                                    }
                                                />
                                            </DialogTitle>
                                        </DialogHeader>
                                        <div className="flex-1 overflow-hidden p-4">
                                            <Textarea
                                                value={localText}
                                                onChange={handleTextChange}
                                                onBlur={handleBlur}
                                                placeholder="Enter text..."
                                                className="nowheel nopan h-full w-full resize-none border-none bg-transparent p-0 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                                            />
                                        </div>
                                    </DialogContent>
                                </Dialog>
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
                                className="nowheel nopan nodrag w-full resize-none overflow-y-auto border-none bg-transparent px-2 py-1 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                                style={{ height: dimensions.height - 80 }}
                            />
                        </div>
                    </div>
                </div>

                <NodeResizeHandle onResizeStart={handleResizeStart} />

                <Handle
                    type="source"
                    position={Position.Right}
                    className="!bg-purple-500"
                />
            </div>
        );
    },
    (prevProps, nextProps) => {
        return (
            prevProps.id === nextProps.id &&
            prevProps.selected === nextProps.selected &&
            prevProps.data === nextProps.data
        );
    },
);

TextNode.displayName = "TextNode";
