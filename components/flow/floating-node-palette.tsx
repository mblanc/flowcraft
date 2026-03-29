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
            <div className="border-border bg-card/80 hover:bg-card/95 flex flex-col items-center gap-4 rounded-full border p-2 shadow-2xl backdrop-blur-xl transition-all duration-300">
                <TooltipProvider delayDuration={0}>
                    {/* Add Nodes Section */}
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
                                        "h-12 w-12 rounded-full transition-all duration-200",
                                        hoveredSection === "nodes"
                                            ? "bg-primary text-primary-foreground shadow-lg"
                                            : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                                    )}
                                >
                                    <Plus className="h-6 w-6" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                <p>Add Nodes</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Hover Menu for Native Nodes */}
                        <div
                            className={cn(
                                "absolute top-0 left-full ml-4 w-72 origin-left transition-all duration-300 ease-out",
                                hoveredSection === "nodes"
                                    ? "translate-x-0 scale-100 opacity-100"
                                    : "pointer-events-none -translate-x-2 scale-95 opacity-0",
                            )}
                        >
                            <div className="border-border bg-card/95 grid grid-cols-3 gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl">
                                {nativeItems.map((item) => (
                                    <div
                                        key={item.type}
                                        onDragStart={(event) =>
                                            onDragStart(event, item.type)
                                        }
                                        draggable
                                        className="group/item flex cursor-grab flex-col items-center gap-2 active:cursor-grabbing"
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
                                                "h-14 w-14 rounded-xl transition-all duration-200 group-hover/item:scale-110",
                                                item.color,
                                            )}
                                        >
                                            <item.icon className="h-7 w-7" />
                                        </Button>
                                        <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
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
                                                    className="group/item flex cursor-grab flex-col items-center gap-2 active:cursor-grabbing"
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
                                                            "h-14 w-14 rounded-xl transition-all duration-200 group-hover/item:scale-110",
                                                            item.color,
                                                        )}
                                                    >
                                                        <item.icon className="h-7 w-7" />
                                                    </Button>
                                                    <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                                                        {item.label}
                                                    </span>
                                                </div>
                                            ))}
                                        </>
                                    )}
                            </div>
                        </div>
                    </div>

                    {/* Add Custom Nodes Section */}
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
                                            "h-12 w-12 rounded-full transition-all duration-200",
                                            hoveredSection === "custom"
                                                ? "bg-purple-500 text-white shadow-lg"
                                                : "text-muted-foreground hover:bg-purple-100 hover:text-purple-500 dark:hover:bg-purple-900/40",
                                        )}
                                    >
                                        <Box className="h-6 w-6" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    <p>Custom Nodes</p>
                                </TooltipContent>
                            </Tooltip>

                            {/* Hover Menu for Custom Nodes */}
                            <div
                                className={cn(
                                    "absolute top-0 left-full ml-4 w-72 origin-left transition-all duration-300 ease-out",
                                    hoveredSection === "custom"
                                        ? "translate-x-0 scale-100 opacity-100"
                                        : "pointer-events-none -translate-x-2 scale-95 opacity-0",
                                )}
                            >
                                <div className="border-border bg-card/95 flex max-h-[400px] flex-col gap-2 overflow-y-auto rounded-2xl border p-4 shadow-2xl backdrop-blur-xl">
                                    <h3 className="text-muted-foreground mb-2 px-2 text-xs font-semibold tracking-widest uppercase">
                                        Available Components
                                    </h3>
                                    {customNodes.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-3">
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
                                                    className="group/item flex cursor-grab flex-col items-center gap-2 active:cursor-grabbing"
                                                >
                                                    <Button
                                                        onClick={() =>
                                                            handleAddCustomNode(
                                                                customNode,
                                                            )
                                                        }
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-14 w-14 rounded-xl bg-purple-50 text-purple-500 transition-all duration-200 group-hover/item:scale-110 group-hover/item:bg-purple-100 dark:bg-purple-900/20 dark:group-hover/item:bg-purple-900/40"
                                                    >
                                                        <Box className="h-7 w-7" />
                                                    </Button>
                                                    <span className="text-muted-foreground w-full truncate px-1 text-center text-[10px] font-medium">
                                                        {customNode.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-muted-foreground py-8 text-center text-sm italic">
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
