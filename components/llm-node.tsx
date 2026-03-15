"use client";

import type React from "react";

import { memo, useState } from "react";
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
import { NodeTitle } from "@/components/node-title";
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
import { MentionEditor } from "@/components/mention-editor";
import { useConnectedSourceNodes } from "@/hooks/use-connected-source-nodes";
import { BatchTextOutput } from "@/components/batch-text-output";
import { useNodeResize } from "@/hooks/use-node-resize";
import { useSyncedState } from "@/hooks/use-synced-state";

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 300;
const MIN_WIDTH = 340;
const MIN_HEIGHT = 150;

export const LLMNode = memo(
    ({ data, selected, id }: NodeProps<Node<LLMData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const selectNode = useFlowStore((state) => state.selectNode);
        const { executeNode, runFromNode } = useFlowExecution();

        const connectedNodes = useConnectedSourceNodes(id);

        const [localInstructions, setLocalInstructions] = useSyncedState(
            data.instructions || "",
        );
        const [localOutput, setLocalOutput] = useSyncedState(data.output || "");
        const [viewMode, setViewMode] = useState<"instructions" | "output">(
            "instructions",
        );
        const [isModalOpen, setIsModalOpen] = useState(false);
        const [isRunMenuOpen, setIsRunMenuOpen] = useState(false);
        const [batchOutputIndex, setBatchOutputIndex] = useState(0);

        const { dimensions, handleResizeStart } = useNodeResize(
            id,
            data.width,
            data.height,
            {
                defaultWidth: DEFAULT_WIDTH,
                defaultHeight: DEFAULT_HEIGHT,
                minWidth: MIN_WIDTH,
                minHeight: MIN_HEIGHT,
                useElementHeight: true,
            },
        );

        const handleInstructionsChange = (value: string) => {
            setLocalInstructions(value);
            // Keep the store in sync immediately so execution always has the
            // latest instructions even if blur hasn't fired yet.
            updateNodeData(id, { instructions: value });
        };

        const handleOutputChange = (
            e: React.ChangeEvent<HTMLTextAreaElement>,
        ) => {
            setLocalOutput(e.target.value);
        };

        const handleBlur = () => {
            // Flush output (instructions are already saved via handleInstructionsChange)
            updateNodeData(id, { output: localOutput });
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

        return (
            <div
                className={cn(
                    "bg-card relative flex flex-col rounded-lg border-2 p-4 shadow-lg transition-[border-color,shadow,background-color]",
                    selected
                        ? "border-primary shadow-primary/20"
                        : "border-border",
                )}
                style={{
                    width: dimensions.width,
                    height: dimensions.height,
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
                {data.batchTotal && data.batchTotal > 0 && !data.executing && (
                    <span className="bg-primary/20 text-primary absolute top-2 right-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold">
                        {data.batchTotal}x
                    </span>
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
                                <NodeTitle
                                    name={data.name}
                                    onRename={(n) =>
                                        updateNodeData(id, { name: n })
                                    }
                                    className="text-foreground mb-0"
                                />
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
                                                    <NodeTitle
                                                        name={data.name}
                                                        onRename={(n) =>
                                                            updateNodeData(id, {
                                                                name: n,
                                                            })
                                                        }
                                                    />
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
                                                    <MentionEditor
                                                        value={
                                                            localInstructions
                                                        }
                                                        onChange={
                                                            handleInstructionsChange
                                                        }
                                                        onBlur={handleBlur}
                                                        availableNodes={
                                                            connectedNodes
                                                        }
                                                        placeholder="Enter instructions..."
                                                        className="h-full w-full flex-1 text-base"
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
                                            {data.executing &&
                                            data.batchTotal ? (
                                                <span className="text-[10px] font-medium tabular-nums">
                                                    {data.batchProgress || 0}/
                                                    {data.batchTotal}
                                                </span>
                                            ) : data.executing ? (
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
                            <MentionEditor
                                value={localInstructions}
                                onChange={handleInstructionsChange}
                                onBlur={handleBlur}
                                availableNodes={connectedNodes}
                                placeholder="Enter instructions..."
                                className="nopan nodrag h-full w-full flex-1 text-xs"
                            />
                        ) : (
                            <div className="flex min-h-0 flex-1 flex-col">
                                {data.outputs && data.outputs.length > 1 ? (
                                    <BatchTextOutput
                                        outputs={data.outputs}
                                        currentIndex={batchOutputIndex}
                                        onIndexChange={setBatchOutputIndex}
                                        className="h-full w-full flex-1"
                                    />
                                ) : (
                                    <Textarea
                                        value={localOutput}
                                        onChange={handleOutputChange}
                                        onBlur={handleBlur}
                                        placeholder="No output yet."
                                        className="nowheel nopan nodrag h-full w-full flex-1 resize-none border-none bg-transparent p-0 font-mono text-xs leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0"
                                    />
                                )}
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
    (prevProps, nextProps) => {
        return (
            prevProps.id === nextProps.id &&
            prevProps.selected === nextProps.selected &&
            prevProps.data === nextProps.data
        );
    },
);

LLMNode.displayName = "LLMNode";
