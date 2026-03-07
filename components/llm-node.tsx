"use client";

import type React from "react";

import { memo, useRef, useEffect, useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { LLMData } from "@/lib/types";
import {
    Bot,
    Maximize2,
    Play,
    Loader2,
    Settings,
    ChevronDown,
    FastForward,
} from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { useFlowExecution } from "@/hooks/use-flow-execution";
import { MODELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const selectNode = useFlowStore((state) => state.selectNode);
        const { executeNode, runFromNode } = useFlowExecution();
        const [localInstructions, setLocalInstructions] = useState(
            data.instructions,
        );
        const [prevDataInstructions, setPrevDataInstructions] = useState(
            data.instructions,
        );
        const [localOutput, setLocalOutput] = useState(data.output || "");
        const [prevDataOutput, setPrevDataOutput] = useState(data.output || "");
        const [viewMode, setViewMode] = useState<"instructions" | "output">(
            "instructions",
        );
        const [isModalOpen, setIsModalOpen] = useState(false);
        const [isRunMenuOpen, setIsRunMenuOpen] = useState(false);

        // Resize state
        const [dimensions, setDimensions] = useState({
            width: data.width || DEFAULT_WIDTH,
            height: data.height || undefined,
        });
        const [isResizing, setIsResizing] = useState(false);
        const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

        // Keep local UI state aligned with external node data.
        useEffect(() => {
            setDimensions({
                width: data.width || DEFAULT_WIDTH,
                height: data.height || undefined,
            });
        }, [data.width, data.height]);

        useEffect(() => {
            if (data.instructions !== prevDataInstructions) {
                setPrevDataInstructions(data.instructions);
                setLocalInstructions(data.instructions);
            }
        }, [data.instructions, prevDataInstructions]);

        useEffect(() => {
            if (data.output !== prevDataOutput) {
                setPrevDataOutput(data.output || "");
                setLocalOutput(data.output || "");
            }
        }, [data.output, prevDataOutput]);

        const handleInstructionsChange = (
            e: React.ChangeEvent<HTMLTextAreaElement>,
        ) => {
            setLocalInstructions(e.target.value);
        };

        const handleOutputChange = (
            e: React.ChangeEvent<HTMLTextAreaElement>,
        ) => {
            setLocalOutput(e.target.value);
        };

        const handleBlur = () => {
            updateNodeData(id, {
                instructions: localInstructions,
                output: localOutput,
            });
        };

        const handleExecute = (e: React.MouseEvent) => {
            e.stopPropagation();
            executeNode(id);
        };

        const handleRunFromHere = (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            runFromNode(id);
        };

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
                className={cn(
                    "bg-card relative flex flex-col rounded-lg border-2 p-4 shadow-lg transition-all",
                    selected
                        ? "border-primary shadow-primary/20"
                        : "border-border",
                )}
                style={{
                    width: dimensions.width,
                    minHeight: dimensions.height || 180,
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
                <div className="absolute top-[18px] right-full mr-5 text-[10px] font-semibold whitespace-nowrap text-blue-500">
                    Prompts
                </div>

                <Handle
                    type="target"
                    position={Position.Left}
                    id="file-input"
                    className="!bg-cyan-500"
                    style={{ top: 65 }}
                />
                <div className="absolute top-[48px] right-full mr-5 text-[10px] font-semibold whitespace-nowrap text-cyan-500">
                    File(s)
                </div>

                <div className="flex min-h-0 flex-1 flex-col">
                    <div className="mb-3 flex items-center gap-3">
                        <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md">
                            <Bot className="text-primary h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-foreground truncate text-sm font-semibold">
                                    {data.name}
                                </h3>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id={`view-mode-switch-${id}`}
                                            checked={viewMode === "output"}
                                            onCheckedChange={(checked) =>
                                                setViewMode(
                                                    checked
                                                        ? "output"
                                                        : "instructions",
                                                )
                                            }
                                            className="data-[state=checked]:bg-primary h-4 w-7"
                                        />
                                        <Label
                                            htmlFor={`view-mode-switch-${id}`}
                                            className="cursor-pointer text-[10px]"
                                        >
                                            {viewMode === "output"
                                                ? "Output"
                                                : "Instructions"}
                                        </Label>
                                    </div>

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
                                                        className="hover:bg-primary/20 text-primary flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                                                    >
                                                        <Maximize2 className="h-4 w-4" />
                                                    </button>
                                                </DialogTrigger>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Expand editor</p>
                                            </TooltipContent>
                                        </Tooltip>
                                        <DialogContent className="flex h-[95vh] max-w-[95vw] flex-col overflow-hidden p-0">
                                            <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b p-4">
                                                <DialogTitle className="flex items-center gap-2">
                                                    <Bot className="text-primary h-5 w-5" />
                                                    {data.name}
                                                </DialogTitle>
                                                <div className="flex items-center space-x-4 pr-8">
                                                    <div className="flex items-center space-x-2">
                                                        <Label
                                                            htmlFor={`modal-view-mode-switch-${id}`}
                                                            className="cursor-pointer text-sm"
                                                        >
                                                            Instructions
                                                        </Label>
                                                        <Switch
                                                            id={`modal-view-mode-switch-${id}`}
                                                            checked={
                                                                viewMode ===
                                                                "output"
                                                            }
                                                            onCheckedChange={(
                                                                checked,
                                                            ) =>
                                                                setViewMode(
                                                                    checked
                                                                        ? "output"
                                                                        : "instructions",
                                                                )
                                                            }
                                                        />
                                                        <Label
                                                            htmlFor={`modal-view-mode-switch-${id}`}
                                                            className="cursor-pointer text-sm"
                                                        >
                                                            Output
                                                        </Label>
                                                    </div>
                                                </div>
                                            </DialogHeader>
                                            <div className="flex flex-1 flex-col overflow-hidden p-4">
                                                {viewMode === "instructions" ? (
                                                    <Textarea
                                                        value={
                                                            localInstructions
                                                        }
                                                        onChange={
                                                            handleInstructionsChange
                                                        }
                                                        onBlur={handleBlur}
                                                        placeholder="Enter instructions..."
                                                        className="nowheel nopan h-full w-full flex-1 resize-none border-none bg-transparent p-0 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                                                    />
                                                ) : (
                                                    <div className="flex min-h-0 flex-1 flex-col">
                                                        <Textarea
                                                            value={localOutput}
                                                            onChange={
                                                                handleOutputChange
                                                            }
                                                            onBlur={handleBlur}
                                                            placeholder="No output yet."
                                                            className="nowheel nopan h-full w-full flex-1 resize-none border-none bg-transparent p-0 font-mono text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                                                        />
                                                        {data.error && (
                                                            <div className="bg-destructive/10 text-destructive mt-2 rounded-md p-2 text-sm">
                                                                Error:{" "}
                                                                {data.error}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </DialogContent>
                                    </Dialog>

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

                                    <div className="flex items-center">
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
                                                    setIsRunMenuOpen(
                                                        !isRunMenuOpen,
                                                    )
                                                }
                                                disabled={data.executing}
                                                className={cn(
                                                    "hover:bg-primary/20 text-primary flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                                                    isRunMenuOpen &&
                                                        "bg-primary/20",
                                                )}
                                            >
                                                <ChevronDown
                                                    className={cn(
                                                        "h-4 w-4 transition-transform",
                                                        isRunMenuOpen &&
                                                            "rotate-180",
                                                    )}
                                                />
                                            </button>
                                            {isRunMenuOpen && (
                                                <div className="bg-card border-border absolute right-0 z-10 mt-1 min-w-[120px] rounded-md border shadow-lg">
                                                    <button
                                                        onClick={(e) => {
                                                            handleRunFromHere(
                                                                e,
                                                            );
                                                            setIsRunMenuOpen(
                                                                false,
                                                            );
                                                        }}
                                                        disabled={
                                                            data.executing
                                                        }
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
                            </div>
                        </div>
                    </div>

                    <div className="bg-muted/20 flex min-h-0 flex-1 flex-col rounded-md p-2">
                        {viewMode === "instructions" ? (
                            <Textarea
                                value={localInstructions}
                                onChange={handleInstructionsChange}
                                onBlur={handleBlur}
                                placeholder="Enter instructions..."
                                className="nowheel nopan nodrag h-full w-full flex-1 resize-none border-none bg-transparent p-0 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                            />
                        ) : (
                            <div className="flex min-h-0 flex-1 flex-col">
                                <Textarea
                                    value={localOutput}
                                    onChange={handleOutputChange}
                                    onBlur={handleBlur}
                                    placeholder="No output yet."
                                    className="nowheel nopan nodrag h-full w-full flex-1 resize-none border-none bg-transparent p-0 font-mono text-xs leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0"
                                />
                                {data.error && (
                                    <div className="text-destructive mt-1 text-[10px] font-medium">
                                        Error: {data.error}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-border/50 mt-3 pt-3">
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
