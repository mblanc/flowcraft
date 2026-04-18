"use client";

import type React from "react";

import { memo, useState, useEffect, useRef } from "react";
import { useNodeResize } from "@/hooks/use-node-resize";
import { useSyncedState } from "@/hooks/use-synced-state";
import { NodeResizeHandle } from "@/components/nodes/node-resize-handle";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { TextData } from "@/lib/types";
import { FileText, GripHorizontal } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { NodeTitle } from "@/components/nodes/node-title";
import { NodeActionBar } from "@/components/nodes/node-action-bar";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "../ui/textarea";

export const TextNode = memo(
    ({ data, selected, id }: NodeProps<Node<TextData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const selectNode = useFlowStore((state) => state.selectNode);
        const deleteNode = useFlowStore((state) => state.deleteNode);
        const [localText, setLocalText] = useSyncedState(data.text);
        const { dimensions, handleResizeStart } = useNodeResize(
            id,
            data.width,
            data.height,
            {
                defaultWidth: 280,
                defaultHeight: 200,
                minWidth: 200,
                minHeight: 120,
            },
        );
        const [isModalOpen, setIsModalOpen] = useState(false);
        const [isHovered, setIsHovered] = useState(false);
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const nodeRef = useRef<HTMLDivElement>(null);

        // Prevent canvas zoom when scrolling inside textarea
        useEffect(() => {
            const textarea = textareaRef.current;
            const container = nodeRef.current;
            if (!textarea || !container) return;

            const handleWheel = (e: WheelEvent) => {
                const target = e.target as HTMLElement;
                const isTextareaFocused = document.activeElement === textarea;
                const isInsideTextarea =
                    target === textarea || textarea.contains(target);

                if (isInsideTextarea || isTextareaFocused) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                }
            };

            const options = { capture: true, passive: false };
            container.addEventListener("wheel", handleWheel, options);
            textarea.addEventListener("wheel", handleWheel, options);
            textarea.addEventListener("wheel", handleWheel, { passive: false });

            let focusedHandler: ((e: WheelEvent) => void) | null = null;

            const handleFocus = () => {
                focusedHandler = (e: WheelEvent) => {
                    const target = e.target as HTMLElement;
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

        const handleDelete = () => deleteNode(id);

        const handleDownload = () => {
            if (!localText) return;
            const blob = new Blob([localText], { type: "text/plain" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${data.name || "text"}.txt`;
            a.click();
            URL.revokeObjectURL(a.href);
        };

        const handleWheel = (e: React.WheelEvent<HTMLTextAreaElement>) => {
            e.stopPropagation();
        };

        return (
            <div
                ref={nodeRef}
                className="relative"
                style={{ width: dimensions.width, height: dimensions.height }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onFocusCapture={() => {
                    selectNode(id);
                }}
            >
                {/* Floating title */}
                <div className="pointer-events-auto absolute -top-7 left-2 z-20 flex items-center">
                    <NodeTitle
                        name={data.name}
                        onRename={(n) => updateNodeData(id, { name: n })}
                        className="text-foreground text-xs"
                    />
                </div>

                {/* Action bar — visible on hover or selection */}
                <NodeActionBar
                    isVisible={selected || isHovered}
                    onFullscreen={() => setIsModalOpen(true)}
                    onDownload={localText ? handleDownload : undefined}
                    onDelete={handleDelete}
                />

                {/* Fullscreen dialog */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="flex h-[90vh] max-w-[90vw] flex-col overflow-hidden p-0">
                        <DialogHeader className="border-b p-4">
                            <DialogTitle className="flex items-center gap-2">
                                <FileText className="text-muted-foreground h-5 w-5" />
                                <NodeTitle
                                    name={data.name}
                                    onRename={(n) =>
                                        updateNodeData(id, { name: n })
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

                {/* Media box */}
                <div
                    className={cn(
                        "bg-card relative flex h-full w-full flex-col overflow-hidden rounded-lg border transition-[border-color,border-width] duration-150",
                        selected
                            ? "border-primary border-2"
                            : "border-border border",
                    )}
                >
                    {/* Drag header */}
                    <div className="border-border flex shrink-0 cursor-grab items-center justify-center border-b py-1 active:cursor-grabbing">
                        <GripHorizontal className="text-muted-foreground/40 h-3 w-3" />
                    </div>

                    {"executing" in data && data.executing && (
                        <div
                            className="border-beam-glow"
                            style={
                                {
                                    "--beam-color": "var(--color-port-string)",
                                } as React.CSSProperties
                            }
                        />
                    )}
                    <div
                        onWheel={(e) => {
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                        }}
                        className="min-h-0 flex-1"
                    >
                        <Textarea
                            ref={textareaRef}
                            value={localText}
                            onChange={handleTextChange}
                            onBlur={handleBlur}
                            onWheel={handleWheel}
                            placeholder="Enter text..."
                            className="nowheel nopan nodrag h-full w-full resize-none overflow-y-auto border-none bg-transparent px-3 py-2 text-xs leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                    </div>
                </div>

                <NodeResizeHandle onResizeStart={handleResizeStart} />

                <Handle
                    type="source"
                    position={Position.Right}
                    className="bg-port-string"
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
