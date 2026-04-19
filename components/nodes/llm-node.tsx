"use client";

import type React from "react";

import { memo, useState, useEffect, useRef } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { LLMData } from "@/lib/types";
import { Bot, Maximize2 } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { NodeTitle } from "@/components/nodes/node-title";
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
import { MentionEditor } from "@/components/nodes/mention-editor";
import { useConnectedSourceNodes } from "@/hooks/use-connected-source-nodes";
import { BatchTextOutput } from "@/components/nodes/batch-text-output";
import { useNodeResize } from "@/hooks/use-node-resize";
import { useSyncedState } from "@/hooks/use-synced-state";
import { NodeResizeHandle } from "@/components/nodes/node-resize-handle";
import { NodeActionBar } from "@/components/nodes/node-action-bar";

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 300;
const MIN_WIDTH = 300;
const MIN_HEIGHT = 150;

export const LLMNode = memo(
    ({ data, selected, id }: NodeProps<Node<LLMData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const selectNode = useFlowStore((state) => state.selectNode);
        const deleteNode = useFlowStore((state) => state.deleteNode);
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
        const [batchOutputIndex, setBatchOutputIndex] = useState(0);
        const [isHovered, setIsHovered] = useState(false);
        const nodeRef = useRef<HTMLDivElement>(null);

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

        const wasExecutingRef = useRef(false);
        useEffect(() => {
            if (data.executing) {
                wasExecutingRef.current = true;
            } else if (wasExecutingRef.current) {
                wasExecutingRef.current = false;
                (document.activeElement as HTMLElement)?.blur();
            }
        }, [data.executing]);

        const handleInstructionsChange = (value: string) => {
            setLocalInstructions(value);
            updateNodeData(id, { instructions: value });
        };

        const handleOutputChange = (
            e: React.ChangeEvent<HTMLTextAreaElement>,
        ) => {
            setLocalOutput(e.target.value);
        };

        const handleBlur = () => {
            updateNodeData(id, { output: localOutput });
        };

        const handleExecute = () => {
            executeNode(id);
        };

        const handleRunFromHere = () => {
            runFromNode(id);
        };

        const handleOpenSettings = () => {
            selectNode(id);
            useFlowStore.getState().setIsConfigSidebarOpen(true);
        };

        const handleDelete = () => deleteNode(id);

        const handleDownload = () => {
            const text = localOutput;
            if (!text) return;
            const blob = new Blob([text], { type: "text/plain" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${data.name || "output"}.txt`;
            a.click();
            URL.revokeObjectURL(a.href);
        };

        return (
            <div
                ref={nodeRef}
                className="relative"
                style={{
                    width: dimensions.width,
                    height: dimensions.height,
                }}
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

                {/* Action bar — visible on hover, selection, or execution */}
                <NodeActionBar
                    isVisible={selected || isHovered || data.executing}
                    onGenerate={handleExecute}
                    onRunFromHere={handleRunFromHere}
                    onSettings={handleOpenSettings}
                    onFullscreen={() => setIsModalOpen(true)}
                    onDownload={localOutput ? handleDownload : undefined}
                    onDelete={handleDelete}
                    isExecuting={data.executing}
                    batchProgress={data.batchProgress}
                    batchTotal={data.batchTotal}
                />

                {/* Beam glow when executing */}
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

                {/* Batch badge */}
                {data.batchTotal && data.batchTotal > 0 && !data.executing && (
                    <span className="bg-primary/20 text-primary absolute top-2 right-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold">
                        {data.batchTotal}x
                    </span>
                )}

                {/* Handle labels */}
                <div
                    className="text-muted-foreground absolute right-full mr-3 text-[10px] font-medium whitespace-nowrap"
                    style={{ top: "33%", transform: "translateY(-50%)" }}
                >
                    Prompts
                </div>
                <div
                    className="text-muted-foreground absolute right-full mr-3 text-[10px] font-medium whitespace-nowrap"
                    style={{ top: "66%", transform: "translateY(-50%)" }}
                >
                    File(s)
                </div>

                {/* Media box */}
                <div
                    className={cn(
                        "bg-card relative flex h-full w-full flex-col overflow-hidden rounded-lg border transition-[border-color,border-width] duration-150",
                        selected
                            ? "border-primary border-2"
                            : "border-border border",
                    )}
                >
                    {/* Mode tabs */}
                    <div className="border-border flex shrink-0 items-center gap-0.5 border-b px-2 pt-1.5 pb-1">
                        <button
                            onClick={() => setViewMode("instructions")}
                            className={cn(
                                "rounded px-2 py-0.5 text-[10px] transition-colors duration-150",
                                viewMode === "instructions"
                                    ? "bg-muted text-foreground font-medium"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            Instructions
                        </button>
                        <button
                            onClick={() => setViewMode("output")}
                            className={cn(
                                "rounded px-2 py-0.5 text-[10px] transition-colors duration-150",
                                viewMode === "output"
                                    ? "bg-muted text-foreground font-medium"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            Output
                        </button>
                        <div className="flex-1" />
                        {/* Inline expand trigger */}
                        <Dialog
                            open={isModalOpen}
                            onOpenChange={setIsModalOpen}
                        >
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DialogTrigger asChild>
                                            <button
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                                className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-5 w-5 items-center justify-center rounded transition-colors"
                                            >
                                                <Maximize2 className="h-3 w-3" />
                                            </button>
                                        </DialogTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Expand editor</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <DialogContent className="flex h-[95vh] max-w-[95vw] flex-col overflow-hidden p-0">
                                <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b p-4">
                                    <DialogTitle className="flex items-center gap-2">
                                        <Bot className="text-primary h-5 w-5" />
                                        <NodeTitle
                                            name={data.name}
                                            onRename={(n) =>
                                                updateNodeData(id, { name: n })
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
                                                checked={viewMode === "output"}
                                                onCheckedChange={(checked) =>
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
                                            value={localInstructions}
                                            onChange={handleInstructionsChange}
                                            onBlur={handleBlur}
                                            availableNodes={connectedNodes}
                                            placeholder="Enter instructions..."
                                            className="h-full w-full flex-1 text-base"
                                        />
                                    ) : (
                                        <div className="flex min-h-0 flex-1 flex-col">
                                            {data.outputs &&
                                            data.outputs.length > 1 ? (
                                                <BatchTextOutput
                                                    outputs={data.outputs}
                                                    currentIndex={
                                                        batchOutputIndex
                                                    }
                                                    onIndexChange={
                                                        setBatchOutputIndex
                                                    }
                                                    className="h-full w-full flex-1"
                                                />
                                            ) : (
                                                <Textarea
                                                    value={localOutput}
                                                    onChange={
                                                        handleOutputChange
                                                    }
                                                    onBlur={handleBlur}
                                                    placeholder="No output yet."
                                                    className="nowheel nopan h-full w-full flex-1 resize-none border-none bg-transparent p-0 font-mono text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                                                />
                                            )}
                                            {data.error && (
                                                <div className="bg-destructive/10 text-destructive mt-2 rounded-md p-2 text-sm">
                                                    Error: {data.error}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Editor content */}
                    <div className="min-h-0 flex-1 overflow-hidden p-2">
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
                            <div className="flex h-full min-h-0 flex-col">
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

                {/* Params panel — floating below media box */}
                <div
                    className={cn(
                        "border-border bg-card absolute inset-x-0 z-20 rounded-lg border px-3 py-2 shadow-sm transition-opacity duration-150",
                        selected || isHovered
                            ? "opacity-100"
                            : "pointer-events-none opacity-0",
                    )}
                    style={{ top: dimensions.height + 8 }}
                >
                    <Select
                        value={data.model}
                        onValueChange={(value) =>
                            updateNodeData(id, { model: value })
                        }
                    >
                        <SelectTrigger
                            size="sm"
                            className="h-6 w-fit rounded-md px-2 text-[10px]"
                        >
                            <SelectValue placeholder="Model" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem
                                value={MODELS.TEXT.GEMINI_3_1_PRO_PREVIEW}
                            >
                                Gemini 3 Pro Preview
                            </SelectItem>
                            <SelectItem
                                value={MODELS.TEXT.GEMINI_3_FLASH_PREVIEW}
                            >
                                Gemini 3 Flash Preview
                            </SelectItem>
                            <SelectItem
                                value={
                                    MODELS.TEXT.GEMINI_3_1_FLASH_LITE_PREVIEW
                                }
                            >
                                Gemini 3.1 Flash Lite Preview
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Handles */}
                <Handle
                    type="target"
                    position={Position.Left}
                    id="prompts-input"
                    className="port-string"
                    style={{ top: "33%" }}
                />
                <Handle
                    type="target"
                    position={Position.Left}
                    id="file-input"
                    className="port-json"
                    style={{ top: "66%" }}
                />
                <Handle
                    type="source"
                    position={Position.Right}
                    className="bg-primary"
                />

                <NodeResizeHandle onResizeStart={handleResizeStart} />
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
