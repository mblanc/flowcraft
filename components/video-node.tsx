"use client";

import type React from "react";

import { memo, useRef, useEffect, useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { VideoData } from "@/lib/types";
import { Video, Play } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { useFlowExecution } from "@/hooks/use-flow-execution";
import logger from "@/app/logger";

export const VideoNode = memo(
    ({ data, selected, id }: NodeProps<Node<VideoData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const { executeNode } = useFlowExecution();
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const [localPrompt, setLocalPrompt] = useState(data.prompt);
        const [prevDataPrompt, setPrevDataPrompt] = useState(data.prompt);
        const [playbackUrlAsync, setPlaybackUrlAsync] = useState<
            string | undefined
        >(undefined);
        const [dimensions, setDimensions] = useState({
            width: data.width || 400,
            height: data.height || 600,
        });
        const [prevDataWidth, setPrevDataWidth] = useState(data.width);
        const [prevDataHeight, setPrevDataHeight] = useState(data.height);
        const [isResizing, setIsResizing] = useState(false);
        const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

        if (data.prompt !== prevDataPrompt) {
            setPrevDataPrompt(data.prompt);
            setLocalPrompt(data.prompt);
        }

        if (data.width !== prevDataWidth || data.height !== prevDataHeight) {
            setPrevDataWidth(data.width);
            setPrevDataHeight(data.height);
            setDimensions({
                width: data.width || 400,
                height: data.height || 600,
            });
        }

        const videoPlaybackUrl =
            (data.videoUrl?.startsWith("gs://")
                ? playbackUrlAsync
                : data.videoUrl) || undefined;

        const [prevDataVideoUrl, setPrevDataVideoUrl] = useState(data.videoUrl);
        if (data.videoUrl !== prevDataVideoUrl) {
            setPrevDataVideoUrl(data.videoUrl);
            if (!data.videoUrl?.startsWith("gs://")) {
                setPlaybackUrlAsync(undefined);
            }
        }

        useEffect(() => {
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
                textareaRef.current.style.height =
                    textareaRef.current.scrollHeight + "px";
            }
        }, [localPrompt]);

        useEffect(() => {
            const fetchSignedUrl = async (gcsUri: string) => {
                try {
                    const response = await fetch(
                        `/api/signed-url?gcsUri=${encodeURIComponent(gcsUri)}`,
                    );
                    const result = await response.json();
                    if (result.signedUrl) {
                        setPlaybackUrlAsync(result.signedUrl);
                    } else {
                        logger.error(
                            `Failed to get signed URL: ${result.error}`,
                        );
                        setPlaybackUrlAsync(undefined);
                    }
                } catch (error) {
                    logger.error("Error fetching signed URL:", error);
                    setPlaybackUrlAsync(undefined);
                }
            };

            if (data.videoUrl && data.videoUrl.startsWith("gs://")) {
                fetchSignedUrl(data.videoUrl);
            }
        }, [data.videoUrl]);

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

        const handleExecute = (e: React.MouseEvent) => {
            e.stopPropagation();
            executeNode(id);
        };

        const handlePromptChange = (
            e: React.ChangeEvent<HTMLTextAreaElement>,
        ) => {
            setLocalPrompt(e.target.value);
        };

        const handleBlur = () => {
            updateNodeData(id, { prompt: localPrompt });
        };

        return (
            <div
                className={`bg-card relative rounded-lg border-2 p-4 shadow-lg transition-all ${
                    selected
                        ? "border-primary shadow-primary/20"
                        : "border-border"
                } ${data.executing ? "animate-pulse-bg" : ""}`}
                style={{ width: dimensions.width }}
            >
                {/* Prompt Input Handle */}
                <Handle
                    type="target"
                    position={Position.Left}
                    id="prompt-input"
                    className="!bg-pink-500"
                    style={{ top: 35, left: -6 }}
                />
                <div className="absolute top-[18px] right-full mr-5 text-xs font-semibold whitespace-nowrap text-pink-500">
                    Prompt
                </div>

                {/* First Frame Input Handle */}
                <Handle
                    type="target"
                    position={Position.Left}
                    id="first-frame-input"
                    className="!bg-blue-500"
                    style={{ top: 65, left: -6 }}
                />
                <div className="absolute top-[48px] right-full mr-5 text-xs font-semibold whitespace-nowrap text-blue-500">
                    First Frame
                </div>

                {/* Last Frame Input Handle */}
                <Handle
                    type="target"
                    position={Position.Left}
                    id="last-frame-input"
                    className="!bg-purple-500"
                    style={{ top: 95, left: -6 }}
                />
                <div className="absolute top-[78px] right-full mr-5 text-xs font-semibold whitespace-nowrap text-purple-500">
                    Last Frame
                </div>

                {/* Image(s) Input Handle */}
                <Handle
                    type="target"
                    position={Position.Left}
                    id="image-input"
                    className="!bg-green-500"
                    style={{ top: 125, left: -6 }}
                />
                <div className="absolute top-[108px] right-full mr-5 text-xs font-semibold whitespace-nowrap text-green-500">
                    Image(s)
                </div>

                <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-pink-500/10">
                        <Video className="h-5 w-5 text-pink-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <h3 className="text-foreground mb-1 truncate text-sm font-semibold">
                            {data.name}
                        </h3>
                        <textarea
                            ref={textareaRef}
                            value={localPrompt}
                            onChange={handlePromptChange}
                            onBlur={handleBlur}
                            placeholder="Enter prompt..."
                            className="text-muted-foreground focus:text-foreground nodrag mb-2 w-full resize-none overflow-hidden border-none bg-transparent text-xs break-words transition-colors outline-none"
                            rows={1}
                        />
                        <div className="text-muted-foreground text-xs">
                            Video {data.videoUrl && "(Generated)"}
                            {data.executing && (
                                <span className="ml-2 text-pink-400">
                                    Generating...
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {data.videoUrl && (
                    <div
                        className="border-border mt-3 overflow-hidden rounded-md border"
                        style={{ maxHeight: dimensions.height - 200 }}
                    >
                        <video
                            src={videoPlaybackUrl}
                            controls
                            className="h-auto w-full object-contain"
                            style={{ maxHeight: dimensions.height - 200 }}
                        />
                    </div>
                )}

                <button
                    onClick={handleExecute}
                    disabled={data.executing}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-pink-500/10 px-3 py-2 text-xs font-medium text-pink-400 transition-colors hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Play className="h-3 w-3" />
                    Execute Node
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
                    className="!bg-pink-500"
                    id="result-output"
                />
            </div>
        );
    },
);

VideoNode.displayName = "VideoNode";
