"use client";

import React, { useState } from "react";
import { Plus, Box, LucideIcon } from "lucide-react";
import { Button } from "../ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "../ui/tooltip";
import { NodeType, NodeData, CustomNodePort } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CustomNodeItem {
    id: string;
    name: string;
    inputs: CustomNodePort[];
    outputs: CustomNodePort[];
}

interface NodePaletteItem {
    type: string;
    icon: LucideIcon;
    color: string;
    label: string;
}

interface FloatingNodePaletteProps {
    nativeItems: readonly NodePaletteItem[];
    workflowIOItems: readonly NodePaletteItem[];
    customNodes: CustomNodeItem[];
    isCustomNodeEditor: boolean;
    addNodeWithType: (
        type: NodeType,
        position?: { x: number; y: number },
        data?: Partial<NodeData>,
    ) => void;
    onDragStart: (event: React.DragEvent, nodeType: string) => void;
    onCustomNodeDragStart: (
        event: React.DragEvent,
        customNode: CustomNodeItem,
    ) => void;
    handleAddCustomNode: (customNode: CustomNodeItem) => void;
}

export function FloatingNodePalette({
    nativeItems,
    workflowIOItems,
    customNodes,
    isCustomNodeEditor,
    addNodeWithType,
    onDragStart,
    onCustomNodeDragStart,
    handleAddCustomNode,
}: FloatingNodePaletteProps) {
    const [hoveredSection, setHoveredSection] = useState<
        "nodes" | "custom" | null
    >(null);

    return (
        <div className="fixed top-1/2 left-6 z-50 -translate-y-1/2">
            <div className="border-border bg-card/80 hover:bg-card/95 flex flex-col items-center gap-3 rounded-xl border p-2 shadow-md backdrop-blur-xl transition-all duration-150">
                <TooltipProvider delayDuration={0}>
                    {/* Add nodes section */}
                    <div
                        className="group relative"
                        onMouseEnter={() => setHoveredSection("nodes")}
                        onMouseLeave={() => setHoveredSection(null)}
                    >
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "h-10 w-10 rounded-md transition-colors duration-150",
                                        hoveredSection === "nodes"
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                                    )}
                                >
                                    <Plus className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                <p>Add nodes</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Hover menu — native nodes */}
                        <div
                            className={cn(
                                "absolute top-0 left-full ml-3 w-64 origin-left transition-all duration-250 ease-out",
                                hoveredSection === "nodes"
                                    ? "translate-x-0 opacity-100"
                                    : "pointer-events-none -translate-x-1 opacity-0",
                            )}
                        >
                            <div className="border-border bg-card/95 grid grid-cols-3 gap-2 rounded-lg border p-3 shadow-md backdrop-blur-xl">
                                {nativeItems.map((item) => (
                                    <div
                                        key={item.type}
                                        onDragStart={(event) =>
                                            onDragStart(event, item.type)
                                        }
                                        draggable
                                        className="group/item flex cursor-grab flex-col items-center gap-1.5 active:cursor-grabbing"
                                    >
                                        <Button
                                            onClick={() =>
                                                addNodeWithType(
                                                    item.type as NodeType,
                                                )
                                            }
                                            size="icon"
                                            variant="ghost"
                                            className={cn(
                                                "h-12 w-12 rounded-md transition-colors duration-150",
                                                item.color,
                                            )}
                                        >
                                            <item.icon className="h-6 w-6" />
                                        </Button>
                                        <span className="text-muted-foreground text-[10px] font-medium">
                                            {item.label}
                                        </span>
                                    </div>
                                ))}

                                {isCustomNodeEditor &&
                                    workflowIOItems.length > 0 && (
                                        <>
                                            <div className="border-border col-span-3 my-1 border-t" />
                                            {workflowIOItems.map((item) => (
                                                <div
                                                    key={item.type}
                                                    onDragStart={(event) =>
                                                        onDragStart(
                                                            event,
                                                            item.type,
                                                        )
                                                    }
                                                    draggable
                                                    className="group/item flex cursor-grab flex-col items-center gap-1.5 active:cursor-grabbing"
                                                >
                                                    <Button
                                                        onClick={() =>
                                                            addNodeWithType(
                                                                item.type as NodeType,
                                                            )
                                                        }
                                                        size="icon"
                                                        variant="ghost"
                                                        className={cn(
                                                            "h-12 w-12 rounded-md transition-colors duration-150",
                                                            item.color,
                                                        )}
                                                    >
                                                        <item.icon className="h-6 w-6" />
                                                    </Button>
                                                    <span className="text-muted-foreground text-[10px] font-medium">
                                                        {item.label}
                                                    </span>
                                                </div>
                                            ))}
                                        </>
                                    )}
                            </div>
                        </div>
                    </div>

                    {/* Custom nodes section */}
                    {!isCustomNodeEditor && (
                        <div
                            className="group relative"
                            onMouseEnter={() => setHoveredSection("custom")}
                            onMouseLeave={() => setHoveredSection(null)}
                        >
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn(
                                            "h-10 w-10 rounded-md transition-colors duration-150",
                                            hoveredSection === "custom"
                                                ? "bg-primary text-primary-foreground"
                                                : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                                        )}
                                    >
                                        <Box className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    <p>Custom nodes</p>
                                </TooltipContent>
                            </Tooltip>

                            {/* Hover menu — custom nodes */}
                            <div
                                className={cn(
                                    "absolute top-0 left-full ml-3 w-64 origin-left transition-all duration-250 ease-out",
                                    hoveredSection === "custom"
                                        ? "translate-x-0 opacity-100"
                                        : "pointer-events-none -translate-x-1 opacity-0",
                                )}
                            >
                                <div className="border-border bg-card/95 flex max-h-[400px] flex-col gap-2 overflow-y-auto rounded-lg border p-3 shadow-md backdrop-blur-xl">
                                    <h3 className="text-muted-foreground mb-1 px-1 text-xs font-semibold">
                                        Custom nodes
                                    </h3>
                                    {customNodes.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {customNodes.map((customNode) => (
                                                <div
                                                    key={customNode.id}
                                                    onDragStart={(event) =>
                                                        onCustomNodeDragStart(
                                                            event,
                                                            customNode,
                                                        )
                                                    }
                                                    draggable
                                                    className="group/item flex cursor-grab flex-col items-center gap-1.5 active:cursor-grabbing"
                                                >
                                                    <Button
                                                        onClick={() =>
                                                            handleAddCustomNode(
                                                                customNode,
                                                            )
                                                        }
                                                        size="icon"
                                                        variant="ghost"
                                                        className="text-muted-foreground hover:bg-accent hover:text-foreground h-12 w-12 rounded-md transition-colors duration-150"
                                                    >
                                                        <Box className="h-6 w-6" />
                                                    </Button>
                                                    <span className="text-muted-foreground w-full truncate px-1 text-center text-[10px] font-medium">
                                                        {customNode.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-muted-foreground py-8 text-center text-sm">
                                            No custom nodes yet
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </TooltipProvider>
            </div>
        </div>
    );
}
