"use client";

import type React from "react";

import { memo, useRef, useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { UpscaleData } from "@/lib/types";
import {
    ZoomIn,
    Play,
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
import logger from "@/app/logger";

export const UpscaleNode = memo(
    ({ data, selected, id }: NodeProps<Node<UpscaleData>>) => {
        const selectNode = useFlowStore((state) => state.selectNode);
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const { executeNode, runFromNode } = useFlowExecution();
        const nodeRef = useRef<HTMLDivElement>(null);
        const [isRunMenuOpen, setIsRunMenuOpen] = useState(false);
        const [isImageOpen, setIsImageOpen] = useState(false);
        const [dimensions, setDimensions] = useState({
            width: data.width || 400,
            height: data.height || 600,
        });
        const [prevDataWidth, setPrevDataWidth] = useState(data.width);
        const [prevDataHeight, setPrevDataHeight] = useState(data.height);
        const [isResizing, setIsResizing] = useState(false);
        const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
        const [asyncSignedUrl, setAsyncSignedUrl] = useState<
            string | undefined
        >(undefined);

        if (data.width !== prevDataWidth || data.height !== prevDataHeight) {
            setPrevDataWidth(data.width);
            setPrevDataHeight(data.height);
            setDimensions({
                width: data.width || 400,
                height: data.height || 600,
            });
        }

        const displayUrl =
            (data.image?.startsWith("gs://") ? asyncSignedUrl : data.image) ||
            "/placeholder.svg";

        const [prevDataImage, setPrevDataImage] = useState(data.image);
        if (data.image !== prevDataImage) {
            setPrevDataImage(data.image);
            if (!data.image?.startsWith("gs://")) {
                setAsyncSignedUrl(undefined);
            }
        }

        useEffect(() => {
            if (data.image && data.image.startsWith("gs://")) {
                fetch(
                    `/api/signed-url?gcsUri=${encodeURIComponent(data.image)}`,
                )
                    .then((res) => res.json())
                    .then((result) => {
                        if (result.signedUrl) {
                            setAsyncSignedUrl(result.signedUrl);
                        } else {
                            logger.error(
                                `Failed to get signed URL: ${result.error}`,
                            );
                            setAsyncSignedUrl(undefined);
                        }
                    })
                    .catch((error) => {
                        logger.error("Error fetching signed URL:", error);
                        setAsyncSignedUrl(undefined);
                    });
            }
        }, [data.image]);

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
                    300,
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
                className={`bg-card relative rounded-lg border-2 p-4 shadow-lg transition-all ${
                    selected
                        ? "border-primary shadow-primary/20"
                        : "border-border"
                }`}
                style={{ width: dimensions.width }}
            >
                {data.executing && (
                    <div
                        className="border-beam-glow"
                        style={
                            { "--beam-color": "#ef4444" } as React.CSSProperties
                        }
                    />
                )}
                {data.batchTotal && data.batchTotal > 0 && !data.executing && (
                    <span className="absolute top-2 right-2 z-10 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
                        {data.batchTotal}x
                    </span>
                )}

                {/* Image Input Handle */}
                <Handle
                    type="target"
                    position={Position.Left}
                    id="image-input"
                    className="!bg-green-500"
                    style={{ top: 35, left: -6 }}
                />
                <div className="absolute top-[18px] right-full mr-5 text-xs font-semibold whitespace-nowrap text-green-500">
                    Image
                </div>

                <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-red-500/10">
                        <ZoomIn className="h-5 w-5 text-red-400" />
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
                                            className="flex h-8 w-8 items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-500/20"
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
                                    className="flex h-8 w-8 items-center justify-center rounded-md text-red-400 transition-colors hover:bg-red-500/20"
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
                                        className={`flex h-8 w-8 items-center justify-center rounded-md text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${isRunMenuOpen ? "bg-red-500/20" : ""}`}
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
                                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <FastForward className="h-3 w-3" />
                                                Run from here
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="text-muted-foreground text-xs">
                            {data.image ? "Upscaled Image" : "No image"}
                            {data.executing && (
                                <span className="ml-2 text-red-400">
                                    Upscaling...
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

                {data.images && data.images.length > 1 ? (
                    <BatchMediaGallery
                        items={data.images}
                        type="image"
                        maxHeight={dimensions.height - 200}
                        nodeWidth={dimensions.width}
                    />
                ) : (
                    data.image &&
                    displayUrl && (
                        <>
                            <div
                                className="border-border mt-3 cursor-pointer overflow-hidden rounded-md border transition-opacity hover:opacity-90"
                                style={{
                                    maxHeight: dimensions.height - 200,
                                    position: "relative",
                                }}
                                onClick={() => setIsImageOpen(true)}
                            >
                                <Image
                                    src={displayUrl}
                                    alt={data.name}
                                    width={dimensions.width - 32}
                                    height={dimensions.height - 200}
                                    className="h-auto w-full object-contain"
                                    style={{
                                        maxHeight: dimensions.height - 200,
                                    }}
                                    unoptimized={displayUrl.startsWith("data:")}
                                    onContextMenu={(e) => {
                                        e.stopPropagation();
                                    }}
                                />
                            </div>
                            <MediaViewer
                                isOpen={isImageOpen}
                                onOpenChange={setIsImageOpen}
                                url={displayUrl}
                                alt={data.name}
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
                                        value={data.upscaleFactor}
                                        onValueChange={(value) =>
                                            updateNodeData(id, {
                                                upscaleFactor: value as
                                                    | "x2"
                                                    | "x3"
                                                    | "x4",
                                            })
                                        }
                                    >
                                        <SelectTrigger
                                            size="sm"
                                            className="h-7 w-fit rounded-full px-3 text-[10px]"
                                        >
                                            <SelectValue placeholder="Scale" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="x2">
                                                2x
                                            </SelectItem>
                                            <SelectItem value="x3">
                                                3x
                                            </SelectItem>
                                            <SelectItem value="x4">
                                                4x
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Upscale Factor</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

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
                    className="!bg-red-500"
                    id="result-output"
                />
            </div>
        );
    },
);

UpscaleNode.displayName = "UpscaleNode";
