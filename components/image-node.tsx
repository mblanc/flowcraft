"use client";

import type React from "react";

import { memo, useRef, useEffect, useState } from "react";
import Image from "next/image";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { ImageData } from "@/lib/types";
import { ImageIcon, Play } from "lucide-react";
import { useFlow } from "./flow-provider";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import logger from "@/app/logger";

export const ImageNode = memo(
    ({ data, selected, id }: NodeProps<Node<ImageData>>) => {
        const { executeNode, updateNodeData } = useFlow();
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const nodeRef = useRef<HTMLDivElement>(null);
        const [localPrompt, setLocalPrompt] = useState(data.prompt);
        const [prevDataPrompt, setPrevDataPrompt] = useState(data.prompt);
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

        const imageSource =
            data.images && data.images.length > 0 ? data.images[0] : undefined;
        const [prevImageSource, setPrevImageSource] = useState(imageSource);

        if (imageSource !== prevImageSource) {
            setPrevImageSource(imageSource);
            if (!imageSource?.startsWith("gs://")) {
                setAsyncSignedUrl(undefined);
            }
        }

        const displayUrl =
            (imageSource?.startsWith("gs://") ? asyncSignedUrl : imageSource) ||
            "/placeholder.svg";

        // Prevent canvas zoom when scrolling inside textarea (works for mouse wheel and touchpad)
        useEffect(() => {
            const textarea = textareaRef.current;
            const container = nodeRef.current;
            if (!textarea || !container) return;

            const handleWheel = (e: WheelEvent) => {
                const target = e.target as HTMLElement;
                const isTextareaFocused = document.activeElement === textarea;
                const isInsideTextarea =
                    target === textarea || textarea.contains(target);

                // If wheel event is on textarea, inside it, or textarea is focused, prevent canvas zoom
                if (isInsideTextarea || isTextareaFocused) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    // Allow native scrolling behavior by not preventing default
                    return false;
                }
            };

            // Use capture phase to intercept before React Flow processes it
            // This catches events in the capture phase before they bubble up
            // Also handle at the textarea level with both capture and bubble phases
            const options = { capture: true, passive: false };
            container.addEventListener("wheel", handleWheel, options);
            textarea.addEventListener("wheel", handleWheel, options);
            // Also add non-capture listener for extra safety
            textarea.addEventListener("wheel", handleWheel, { passive: false });

            // Also handle focus/blur to track when textarea is active
            let focusedHandler: ((e: WheelEvent) => void) | null = null;

            const handleTextareaFocus = () => {
                // Add a more aggressive wheel handler when focused
                focusedHandler = (e: WheelEvent) => {
                    const target = e.target as HTMLElement;
                    // Only stop if event is on textarea or inside container
                    if (
                        target === textarea ||
                        textarea.contains(target) ||
                        container.contains(target)
                    ) {
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                    }
                };
                document.addEventListener("wheel", focusedHandler, {
                    capture: true,
                    passive: false,
                });
            };

            const handleTextareaBlur = () => {
                if (focusedHandler) {
                    document.removeEventListener("wheel", focusedHandler, {
                        capture: true,
                    });
                    focusedHandler = null;
                }
            };

            textarea.addEventListener("focus", handleTextareaFocus);
            textarea.addEventListener("blur", handleTextareaBlur);

            return () => {
                container.removeEventListener("wheel", handleWheel, {
                    capture: true,
                });
                textarea.removeEventListener("wheel", handleWheel, {
                    capture: true,
                });
                textarea.removeEventListener("wheel", handleWheel);
                textarea.removeEventListener("focus", handleTextareaFocus);
                textarea.removeEventListener("blur", handleTextareaBlur);
                if (focusedHandler) {
                    document.removeEventListener("wheel", focusedHandler, {
                        capture: true,
                    });
                }
            };
        }, []);

        useEffect(() => {
            if (imageSource && imageSource.startsWith("gs://")) {
                fetch(
                    `/api/signed-url?gcsUri=${encodeURIComponent(imageSource)}`,
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
        }, [imageSource]);

        // Auto-resize textarea based on content
        useEffect(() => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            const adjustHeight = () => {
                textarea.style.height = "auto";
                const scrollHeight = textarea.scrollHeight;
                const maxHeight = 200;
                textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
            };

            adjustHeight();
        }, [localPrompt]);

        const handleExecute = (e: React.MouseEvent) => {
            e.stopPropagation();
            executeNode(id);
        };

        const handlePromptChange = (
            e: React.ChangeEvent<HTMLTextAreaElement>,
        ) => {
            setLocalPrompt(e.target.value);
            // Auto-resize textarea
            const textarea = e.target;
            textarea.style.height = "auto";
            const scrollHeight = textarea.scrollHeight;
            const maxHeight = 200;
            textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
        };

        const handleBlur = () => {
            updateNodeData(id, { prompt: localPrompt });
        };

        const handleWheel = (e: React.WheelEvent<HTMLTextAreaElement>) => {
            // Stop propagation to prevent canvas zoom when scrolling text
            e.stopPropagation();
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

                {/* Image Input Handle */}
                <Handle
                    type="target"
                    position={Position.Left}
                    id="image-input"
                    className="!bg-green-500"
                    style={{ top: 65, left: -6 }}
                />
                <div className="absolute top-[48px] right-full mr-5 text-xs font-semibold whitespace-nowrap text-green-500">
                    Image(s)
                </div>

                <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-orange-500/10">
                        <ImageIcon className="h-5 w-5 text-orange-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <h3 className="text-foreground mb-1 truncate text-sm font-semibold">
                            {data.name}
                        </h3>
                        <div
                            onWheel={(e) => {
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                            }}
                            className="nodrag"
                        >
                            <textarea
                                ref={textareaRef}
                                value={localPrompt}
                                onChange={handlePromptChange}
                                onBlur={handleBlur}
                                onWheel={handleWheel}
                                placeholder="Enter prompt..."
                                className="text-muted-foreground focus:text-foreground nodrag mb-2 w-full resize-none overflow-y-auto border-none bg-transparent text-xs transition-colors outline-none"
                                style={{ minHeight: "1.5em", maxHeight: 200 }}
                                rows={1}
                            />
                        </div>
                        <div className="text-muted-foreground text-xs">
                            Image{" "}
                            {data.images.length > 0 &&
                                `(${data.images.length})`}
                            {data.executing && (
                                <span className="ml-2 text-orange-400">
                                    Generating...
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {data.images.length > 0 && displayUrl && (
                    <Dialog>
                        <DialogTrigger asChild>
                            <div
                                className="border-border mt-3 cursor-pointer overflow-hidden rounded-md border transition-opacity hover:opacity-90"
                                style={{ maxHeight: dimensions.height - 200 }}
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
                                />
                            </div>
                        </DialogTrigger>
                        <DialogContent className="flex h-auto max-h-[90vh] w-auto max-w-[90vw] items-center justify-center border-none bg-transparent p-0 shadow-none">
                            <Image
                                src={displayUrl}
                                alt={data.name}
                                width={1200}
                                height={800}
                                className="max-h-[90vh] max-w-full rounded-md object-contain"
                                unoptimized={displayUrl.startsWith("data:")}
                            />
                        </DialogContent>
                    </Dialog>
                )}

                <button
                    onClick={handleExecute}
                    disabled={data.executing}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-orange-500/10 px-3 py-2 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="!bg-green-500"
                    id="result-output"
                />
            </div>
        );
    },
);

ImageNode.displayName = "ImageNode";
