"use client";

import type React from "react";
import { memo, useRef, useEffect, useState } from "react";
import Image from "next/image";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { ResizeData } from "@/lib/types";
import { Play, Scaling } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { useFlowExecution } from "@/hooks/use-flow-execution";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { MediaViewer } from "@/components/media-viewer";
import logger from "@/app/logger";

export const ResizeNode = memo(
    ({ data, selected, id }: NodeProps<Node<ResizeData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const { executeNode } = useFlowExecution();
        const nodeRef = useRef<HTMLDivElement>(null);
        const [isImageOpen, setIsImageOpen] = useState(false);
        const [dimensions, setDimensions] = useState({
            width: data.width || 400,
            height: data.height || 600,
        });
        const [prevDataWidth, setPrevDataWidth] = useState(data.width);
        const [prevDataHeight, setPrevDataHeight] = useState(data.height);
        const [isResizing, setIsResizing] = useState(false);
        const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
        const [playbackUrlAsync, setPlaybackUrlAsync] = useState<
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

        const [prevDataOutput, setPrevDataOutput] = useState(data.output);
        if (data.output !== prevDataOutput) {
            setPrevDataOutput(data.output);
            if (!data.output?.startsWith("gs://")) {
                setPlaybackUrlAsync(undefined);
            }
        }

        const outputSignedUrl =
            (data.output?.startsWith("gs://")
                ? playbackUrlAsync
                : data.output) || undefined;

        useEffect(() => {
            if (data.output && data.output.startsWith("gs://")) {
                fetch(
                    `/api/signed-url?gcsUri=${encodeURIComponent(data.output)}`,
                )
                    .then((res) => res.json())
                    .then((result) => {
                        if (result.signedUrl) {
                            setPlaybackUrlAsync(result.signedUrl);
                        } else {
                            logger.error(
                                `Failed to get signed URL: ${result.error}`,
                            );
                            setPlaybackUrlAsync(undefined);
                        }
                    })
                    .catch((error) => {
                        logger.error("Error fetching signed URL:", error);
                        setPlaybackUrlAsync(undefined);
                    });
            }
        }, [data.output]);

        const handleExecute = (e: React.MouseEvent) => {
            e.stopPropagation();
            executeNode(id);
        };

        const handleAspectRatioChange = (value: "16:9" | "9:16") => {
            updateNodeData(id, { aspectRatio: value });
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
                    style={{ top: "50%", left: -6 }}
                />
                <div className="absolute top-1/2 right-full mr-5 -translate-y-1/2 text-xs font-semibold whitespace-nowrap text-green-500">
                    Input Image
                </div>

                <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                        <Scaling className="h-5 w-5 text-blue-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <h3 className="text-foreground mb-1 truncate text-sm font-semibold">
                            {data.name}
                        </h3>
                        <div className="nodrag">
                            <Select
                                value={data.aspectRatio}
                                onValueChange={handleAspectRatioChange}
                            >
                                <SelectTrigger className="h-8 w-full text-xs">
                                    <SelectValue placeholder="Select Aspect Ratio" />
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

                {outputSignedUrl && (
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
                                style={{ maxHeight: dimensions.height - 150 }}
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
                )}

                <button
                    onClick={handleExecute}
                    disabled={data.executing}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Play className="h-3 w-3" />
                    Resize
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
                    className="!bg-blue-500"
                    id="result-output"
                />
            </div>
        );
    },
);

ResizeNode.displayName = "ResizeNode";
