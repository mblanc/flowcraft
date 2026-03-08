"use client";

import type React from "react";

import { memo, useState, useEffect, useRef, useCallback } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { ListData } from "@/lib/types";
import { ListOrdered, Plus, Trash2, ImageIcon, FileText } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { NodeTitle } from "@/components/node-title";
import { cn } from "@/lib/utils";
import { Textarea } from "./ui/textarea";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export const ListNode = memo(
    ({ data, selected, id }: NodeProps<Node<ListData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const [localItems, setLocalItems] = useState<string[]>(data.items);
        const [prevDataItems, setPrevDataItems] = useState<string[]>(
            data.items,
        );
        const [dimensions, setDimensions] = useState({
            width: data.width || 320,
            height: data.height || 300,
        });
        const [prevDataWidth, setPrevDataWidth] = useState(data.width);
        const [prevDataHeight, setPrevDataHeight] = useState(data.height);
        const [isResizing, setIsResizing] = useState(false);
        const nodeRef = useRef<HTMLDivElement>(null);
        const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

        if (data.items !== prevDataItems) {
            setPrevDataItems(data.items);
            setLocalItems(data.items);
        }

        if (data.width !== prevDataWidth || data.height !== prevDataHeight) {
            setPrevDataWidth(data.width);
            setPrevDataHeight(data.height);
            setDimensions({
                width: data.width || 320,
                height: data.height || 300,
            });
        }

        const syncItems = useCallback(
            (items: string[]) => {
                updateNodeData(id, { items });
            },
            [id, updateNodeData],
        );

        const handleItemChange = (index: number, value: string) => {
            const updated = [...localItems];
            updated[index] = value;
            setLocalItems(updated);
        };

        const handleItemBlur = () => {
            syncItems(localItems);
        };

        const handleAddItem = () => {
            const updated = [...localItems, ""];
            setLocalItems(updated);
            syncItems(updated);
        };

        const handleRemoveItem = (index: number) => {
            if (localItems.length <= 1) return;
            const updated = localItems.filter((_, i) => i !== index);
            setLocalItems(updated);
            syncItems(updated);
        };

        const handleItemTypeChange = (itemType: "text" | "image") => {
            updateNodeData(id, { itemType, items: [""] });
            setLocalItems([""]);
        };

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
                    200,
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
                className={cn(
                    "bg-card relative rounded-lg border-2 p-4 shadow-lg transition-all",
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
                            {
                                "--beam-color": "#14b8a6",
                            } as React.CSSProperties
                        }
                    />
                )}

                <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-teal-500/10">
                        <ListOrdered className="h-5 w-5 text-teal-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <NodeTitle
                                name={data.name}
                                onRename={(n) =>
                                    updateNodeData(id, { name: n })
                                }
                                className="text-foreground mb-1"
                            />
                            <span className="text-muted-foreground rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold text-teal-400">
                                {localItems.length} item
                                {localItems.length !== 1 ? "s" : ""}
                            </span>
                        </div>

                        <div className="flex items-center gap-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() =>
                                            handleItemTypeChange("text")
                                        }
                                        className={cn(
                                            "flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-medium transition-colors",
                                            data.itemType === "text"
                                                ? "bg-teal-500/20 text-teal-400"
                                                : "text-muted-foreground hover:bg-teal-500/10",
                                        )}
                                    >
                                        <FileText className="h-3 w-3" />
                                        Text
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>List of text items</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() =>
                                            handleItemTypeChange("image")
                                        }
                                        className={cn(
                                            "flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-medium transition-colors",
                                            data.itemType === "image"
                                                ? "bg-teal-500/20 text-teal-400"
                                                : "text-muted-foreground hover:bg-teal-500/10",
                                        )}
                                    >
                                        <ImageIcon className="h-3 w-3" />
                                        Image
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>List of image URLs</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                </div>

                <div
                    className="nowheel nopan space-y-2 overflow-y-auto pr-1"
                    style={{ maxHeight: dimensions.height - 140 }}
                >
                    {localItems.map((item, index) => (
                        <div key={index} className="group flex items-start gap-1">
                            <span className="text-muted-foreground mt-1.5 w-5 flex-shrink-0 text-right text-[10px] font-mono">
                                {index + 1}.
                            </span>
                            <Textarea
                                value={item}
                                onChange={(e) =>
                                    handleItemChange(index, e.target.value)
                                }
                                onBlur={handleItemBlur}
                                placeholder={
                                    data.itemType === "text"
                                        ? "Enter text..."
                                        : "Enter image URL..."
                                }
                                className="nodrag nowheel nopan min-h-[32px] flex-1 resize-none border-none bg-transparent px-2 py-1 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                                rows={1}
                            />
                            <button
                                onClick={() => handleRemoveItem(index)}
                                className={cn(
                                    "mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-red-400 opacity-0 transition-opacity hover:bg-red-500/10 group-hover:opacity-100",
                                    localItems.length <= 1 &&
                                        "pointer-events-none",
                                )}
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleAddItem}
                    className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-teal-500/30 py-1.5 text-[11px] font-medium text-teal-400 transition-colors hover:bg-teal-500/10"
                >
                    <Plus className="h-3 w-3" />
                    Add item
                </button>

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
                    className="!bg-teal-500"
                    id="list-output"
                />
            </div>
        );
    },
);

ListNode.displayName = "ListNode";
