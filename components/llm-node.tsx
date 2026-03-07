"use client";

import type React from "react";

import { memo, useRef, useEffect, useState, useCallback } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { LLMData } from "@/lib/types";
import {
    Bot,
    Play,
    ChevronDown,
    FastForward,
    Loader2,
    Settings,
} from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { useFlowExecution } from "@/hooks/use-flow-execution";
import { MODELS } from "@/lib/constants";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

const DEFAULT_WIDTH = 220;
const MIN_WIDTH = 180;
const MIN_HEIGHT = 150;

export const LLMNode = memo(
    ({ data, selected, id }: NodeProps<Node<LLMData>>) => {
        const selectNode = useFlowStore((state) => state.selectNode);
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const { executeNode, runFromNode } = useFlowExecution();
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const [localInstructions, setLocalInstructions] = useState(
            data.instructions,
        );
        const [prevDataInstructions, setPrevDataInstructions] = useState(
            data.instructions,
        );
        const [isRunMenuOpen, setIsRunMenuOpen] = useState(false);

        // Resize state
        const [dimensions, setDimensions] = useState({
            width: data.width || DEFAULT_WIDTH,
            height: data.height || undefined,
        });
        const [isResizing, setIsResizing] = useState(false);
        const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

        // Sync dimensions with data using comparison pattern (avoids useEffect setState)
        const [prevDimensions, setPrevDimensions] = useState({
            width: data.width,
            height: data.height,
        });
        if (
            data.width !== prevDimensions.width ||
            data.height !== prevDimensions.height
        ) {
            setPrevDimensions({ width: data.width, height: data.height });
            setDimensions({
                width: data.width || DEFAULT_WIDTH,
                height: data.height || undefined,
            });
        }

        if (data.instructions !== prevDataInstructions) {
            setPrevDataInstructions(data.instructions);
            setLocalInstructions(data.instructions);
        }

        useEffect(() => {
            if (textareaRef.current && !dimensions.height) {
                textareaRef.current.style.height = "auto";
                textareaRef.current.style.height =
                    textareaRef.current.scrollHeight + "px";
            }
        }, [localInstructions, dimensions.height]);

        const handleInstructionsChange = (
            e: React.ChangeEvent<HTMLTextAreaElement>,
        ) => {
            setLocalInstructions(e.target.value);
        };

        const handleBlur = () => {
            updateNodeData(id, { instructions: localInstructions });
        };

        const handleExecute = (e: React.MouseEvent) => {
            e.stopPropagation();
            executeNode(id);
        };

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
            const nodeElement = e.currentTarget.parentElement;
            resizeStartRef.current = {
                x: e.clientX,
                y: e.clientY,
                width: dimensions.width,
                height: nodeElement?.offsetHeight || MIN_HEIGHT,
            };
        };

        useEffect(() => {
            if (!isResizing) return;

            const handleMouseMove = (e: MouseEvent) => {
                const deltaX = e.clientX - resizeStartRef.current.x;
                const deltaY = e.clientY - resizeStartRef.current.y;
                setDimensions({
                    width: Math.max(
                        MIN_WIDTH,
                        resizeStartRef.current.width + deltaX,
                    ),
                    height: Math.max(
                        MIN_HEIGHT,
                        resizeStartRef.current.height + deltaY,
                    ),
                });
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
        }, [isResizing, id, updateNodeData, dimensions]);

        return (
            <div
                className={`bg-card relative rounded-lg border-2 p-4 shadow-lg transition-all ${
                    selected
                        ? "border-primary shadow-primary/20"
                        : "border-border"
                }`}
                style={{
                    width: dimensions.width,
                    minHeight: dimensions.height,
                }}
            >
                {data.executing && (
                    <div
                        className="border-beam-glow"
                        style={
                            {
                                "--beam-color": "var(--primary)",
                            } as React.CSSProperties
                        }
                    />
                )}

                <Handle
                    type="target"
                    position={Position.Left}
                    id="prompts-input"
                    className="!bg-blue-500"
                    style={{ top: 35 }}
                />
                <div className="absolute top-[18px] right-full mr-5 text-xs font-semibold whitespace-nowrap text-blue-500">
                    Prompts
                </div>

                <Handle
                    type="target"
                    position={Position.Left}
                    id="file-input"
                    className="!bg-cyan-500"
                    style={{ top: 65 }}
                />
                <div className="absolute top-[48px] right-full mr-5 text-xs font-semibold whitespace-nowrap text-cyan-500">
                    File(s)
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md">
                        <Bot className="text-primary h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-foreground truncate text-sm font-semibold">
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
                                            className="hover:bg-primary/20 text-primary flex h-8 w-8 items-center justify-center rounded-full transition-colors"
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
                                    disabled={data.executing}
                                    className="hover:bg-primary/20 text-primary flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                    title="Execute Node"
                                >
                                    {data.executing ? (
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
                                        disabled={data.executing}
                                        className={`hover:bg-primary/20 text-primary flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isRunMenuOpen ? "bg-primary/20" : ""}`}
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
                                                disabled={data.executing}
                                                className="hover:bg-primary/10 text-primary flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <FastForward className="h-3 w-3" />
                                                Run from here
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <textarea
                            ref={textareaRef}
                            value={localInstructions}
                            onChange={handleInstructionsChange}
                            onBlur={handleBlur}
                            placeholder="Enter instructions..."
                            className="text-muted-foreground focus:text-foreground nodrag mt-2 w-full resize-none overflow-hidden border-none bg-transparent text-xs transition-colors outline-none"
                            rows={1}
                            style={
                                dimensions.height
                                    ? { height: "auto", minHeight: "60px" }
                                    : undefined
                            }
                        />
                        {data.error && (
                            <div className="text-destructive mt-2 text-xs font-medium">
                                Error: {data.error}
                            </div>
                        )}
                    </div>
                </div>

                {data.output && (
                    <div className="border-border/50 mt-3 border-t pt-3">
                        <div className="text-muted-foreground mb-1 text-xs">
                            Output:
                        </div>
                        <div
                            className="text-foreground bg-muted/30 overflow-y-auto rounded-md p-2 text-xs break-words whitespace-pre-wrap"
                            style={{
                                maxHeight: dimensions.height
                                    ? dimensions.height - 180
                                    : 200,
                            }}
                        >
                            {data.output}
                        </div>
                    </div>
                )}

                <div className="border-border/50 mt-3 flex flex-wrap gap-2 border-t pt-3">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="w-fit">
                                    <Select
                                        value={data.model}
                                        onValueChange={(value) =>
                                            updateNodeData(id, { model: value })
                                        }
                                    >
                                        <SelectTrigger
                                            size="sm"
                                            className="h-7 w-fit rounded-full px-3 text-[10px]"
                                        >
                                            <SelectValue placeholder="Model" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem
                                                value={
                                                    MODELS.TEXT
                                                        .GEMINI_3_PRO_PREVIEW
                                                }
                                            >
                                                Gemini 3 Pro Preview
                                            </SelectItem>
                                            <SelectItem
                                                value={
                                                    MODELS.TEXT
                                                        .GEMINI_3_FLASH_PREVIEW
                                                }
                                            >
                                                Gemini 3 Flash Preview
                                            </SelectItem>
                                            <SelectItem
                                                value={
                                                    MODELS.TEXT.GEMINI_2_5_PRO
                                                }
                                            >
                                                Gemini 2.5 Pro
                                            </SelectItem>
                                            <SelectItem
                                                value={
                                                    MODELS.TEXT.GEMINI_2_5_FLASH
                                                }
                                            >
                                                Gemini 2.5 Flash
                                            </SelectItem>
                                            <SelectItem
                                                value={
                                                    MODELS.TEXT
                                                        .GEMINI_2_5_FLASH_LITE
                                                }
                                            >
                                                Gemini 2.5 Flash Lite
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Model</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                <Handle
                    type="source"
                    position={Position.Right}
                    className="!bg-primary"
                />

                {/* Resize handle */}
                <div
                    className="nodrag absolute right-0 bottom-0 h-4 w-4 cursor-se-resize"
                    onMouseDown={handleResizeStart}
                    style={{ touchAction: "none" }}
                >
                    <div className="border-muted-foreground/30 absolute right-1 bottom-1 h-3 w-3 rounded-br border-r-2 border-b-2" />
                </div>
            </div>
        );
    },
);

LLMNode.displayName = "LLMNode";
