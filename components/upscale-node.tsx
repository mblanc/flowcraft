"use client";

import type React from "react";

import { memo, useRef, useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { UpscaleData } from "@/lib/types";
import { ZoomIn, Play, ChevronDown, FastForward } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { useFlowExecution } from "@/hooks/use-flow-execution";

import { MediaViewer } from "@/components/media-viewer";
import logger from "@/app/logger";

export const UpscaleNode = memo(
    ({ data, selected, id }: NodeProps<Node<UpscaleData>>) => {
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

        const handleUpscaleFactorChange = (
            e: React.ChangeEvent<HTMLSelectElement>,
        ) => {
            updateNodeData(id, {
                upscaleFactor: e.target.value as "x2" | "x3" | "x4",
            });
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
                } ${data.executing ? "animate-pulse-bg" : ""}`}
                style={{ width: dimensions.width }}
            >
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

                <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-red-500/10">
                        <ZoomIn className="h-5 w-5 text-red-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <h3 className="text-foreground mb-1 truncate text-sm font-semibold">
                            {data.name}
                        </h3>
                        <div className="mb-2">
                            <label className="text-muted-foreground mb-1 block text-xs">
                                Upscale Factor
                            </label>
                            <select
                                value={data.upscaleFactor}
                                onChange={handleUpscaleFactorChange}
                                className="bg-background border-border text-foreground focus:ring-primary nodrag w-full rounded border px-2 py-1 text-xs focus:ring-2 focus:outline-none"
                            >
                                <option value="x2">2x</option>
                                <option value="x3">3x</option>
                                <option value="x4">4x</option>
                            </select>
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

                {data.image && displayUrl && (
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
                                style={{ maxHeight: dimensions.height - 200 }}
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
                )}

                <div className="mt-3 flex w-full flex-col gap-1">
                    <div className="flex w-full">
                        <button
                            onClick={handleExecute}
                            disabled={data.executing}
                            className="flex flex-1 items-center justify-center gap-2 rounded-l-md border-r border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Play className="h-3 w-3" />
                            Execute Node
                        </button>
                        <button
                            onClick={() => setIsRunMenuOpen(!isRunMenuOpen)}
                            disabled={data.executing}
                            className={`flex items-center justify-center rounded-r-md bg-red-500/10 px-2 py-2 text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${isRunMenuOpen ? "bg-red-500/20" : ""}`}
                            aria-label="Run options"
                            title="Run options"
                        >
                            <ChevronDown
                                className={`h-4 w-4 transition-transform ${isRunMenuOpen ? "rotate-180" : ""}`}
                            />
                        </button>
                    </div>
                    {isRunMenuOpen && (
                        <button
                            onClick={(e) => {
                                handleRunFromHere(e);
                                setIsRunMenuOpen(false);
                            }}
                            disabled={data.executing}
                            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <FastForward className="h-3 w-3" />
                            Run from here
                        </button>
                    )}
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
