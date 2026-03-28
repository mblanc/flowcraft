"use client";

import type React from "react";
import { memo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { ResizeData } from "@/lib/types";
import {
    Play,
    Scaling,
    ChevronDown,
    FastForward,
    Loader2,
    Settings,
} from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { NodeTitle } from "@/components/node-title";
import { useFlowExecution } from "@/hooks/use-flow-execution";
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
import { MediaViewer } from "@/components/media-viewer";
import { BatchMediaGallery } from "@/components/batch-media-gallery";
import { useNodeResize } from "@/hooks/use-node-resize";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { NodeResizeHandle } from "@/components/nodes/node-resize-handle";

export const ResizeNode = memo(
    ({ data, selected, id }: NodeProps<Node<ResizeData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const selectNode = useFlowStore((state) => state.selectNode);
        const { executeNode, runFromNode } = useFlowExecution();
        const nodeRef = useRef<HTMLDivElement>(null);
        const [isImageOpen, setIsImageOpen] = useState(false);
        const [isRunMenuOpen, setIsRunMenuOpen] = useState(false);
        const { dimensions, handleResizeStart } = useNodeResize(
            id,
            data.width,
            data.height,
            {
                defaultWidth: 400,
                defaultHeight: 600,
                minWidth: 220,
                minHeight: 300,
            },
        );

        const { displayUrl: outputSignedUrl } = useSignedUrl(data.output);

        const handleExecute = (e: React.MouseEvent) => {
            e.stopPropagation();
            executeNode(id);
        };

        const handleAspectRatioChange = (value: "16:9" | "9:16") => {
            updateNodeData(id, { aspectRatio: value });
        };

        const handleRunFromHere = useCallback(
            (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                runFromNode(id);
            },
            [runFromNode, id],
        );

        return (
            <div
                ref={nodeRef}
                className={`node-container ${selected ? "selected" : ""}`}
                style={{ width: dimensions.width }}
            >
                {data.executing && (
                    <div
                        className="border-beam-glow"
                        style={
                            { "--beam-color": "#3b82f6" } as React.CSSProperties
                        }
                    />
                )}
                {data.batchTotal && data.batchTotal > 0 && !data.executing && (
                    <span className="absolute top-2 right-2 z-10 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                        {data.batchTotal}x
                    </span>
                )}

                {/* Image Input Handle */}
                <Handle
                    type="target"
                    position={Position.Left}
                    id="image-input"
                    className="bg-green-500"
                    style={{ top: "50%", left: -6 }}
                />
                <div className="absolute top-1/2 right-full mr-5 -translate-y-1/2 text-xs font-semibold whitespace-nowrap text-green-500">
                    Input Image
                </div>

                <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                        <Scaling className="h-5 w-5 text-blue-400" />
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
                                            className="flex h-8 w-8 items-center justify-center rounded-full text-blue-400 transition-colors hover:bg-blue-500/20"
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
                                    className="flex h-8 w-8 items-center justify-center rounded-md text-blue-400 transition-colors hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    title="Execute Node"
                                >
                                    {data.executing && data.batchTotal ? (
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
                                            setIsRunMenuOpen(!isRunMenuOpen)
                                        }
                                        disabled={data.executing}
                                        className={`flex h-8 w-8 items-center justify-center rounded-md text-blue-400 transition-colors hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${isRunMenuOpen ? "bg-blue-500/20" : ""}`}
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
                                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <FastForward className="h-3 w-3" />
                                                Run from here
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="text-muted-foreground mt-1 text-xs">
                            {data.executing && (
                                <span className="text-blue-400">
                                    Resizing...
                                </span>
                            )}
                        </div>
                        {data.error && (
                            <div className="text-destructive mt-2 text-xs font-medium">
                                Error: {data.error}
                            </div>
                        )}
                    </div>
                </div>

                {data.outputs && data.outputs.length > 1 ? (
                    <BatchMediaGallery
                        items={data.outputs}
                        type="image"
                        maxHeight={dimensions.height - 150}
                        nodeWidth={dimensions.width}
                    />
                ) : (
                    outputSignedUrl && (
                        <>
                            <div
                                className="border-border mt-3 cursor-pointer overflow-hidden rounded-md border transition-opacity hover:opacity-90"
                                style={{
                                    maxHeight: dimensions.height - 150,
                                    position: "relative",
                                }}
                                onClick={() => setIsImageOpen(true)}
                            >
                                <Image
                                    src={outputSignedUrl}
                                    alt="Resized output"
                                    width={dimensions.width - 32}
                                    height={dimensions.height - 150}
                                    className="h-auto w-full object-contain"
                                    style={{
                                        maxHeight: dimensions.height - 150,
                                    }}
                                    unoptimized={outputSignedUrl.startsWith(
                                        "data:",
                                    )}
                                    onContextMenu={(e) => e.stopPropagation()}
                                />
                            </div>
                            <MediaViewer
                                isOpen={isImageOpen}
                                onOpenChange={setIsImageOpen}
                                url={outputSignedUrl}
                                alt="Resized output"
                            />
                        </>
                    )
                )}

                <div className="border-border/50 mt-3 flex flex-wrap gap-2 border-t pt-3">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="w-fit">
                                    <Select
                                        value={data.aspectRatio}
                                        onValueChange={handleAspectRatioChange}
                                    >
                                        <SelectTrigger
                                            size="sm"
                                            className="h-7 w-fit rounded-full px-3 text-[10px]"
                                        >
                                            <SelectValue placeholder="Size" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="16:9">
                                                16:9 (1920x1080)
                                            </SelectItem>
                                            <SelectItem value="9:16">
                                                9:16 (1080x1920)
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Aspect Ratio</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                <NodeResizeHandle onResizeStart={handleResizeStart} />

                <Handle
                    type="source"
                    position={Position.Right}
                    className="bg-blue-500"
                    id="result-output"
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

ResizeNode.displayName = "ResizeNode";
