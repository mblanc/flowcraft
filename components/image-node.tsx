"use client";

import type React from "react";

import { memo, useRef, useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { ImageData } from "@/lib/types";
import {
    ImageIcon,
    Play,
    ChevronDown,
    FastForward,
    Loader2,
    Globe,
    Search,
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
import { Switch } from "@/components/ui/switch";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import { MediaViewer } from "@/components/media-viewer";
import logger from "@/app/logger";

const IMAGE_MODEL_CONFIGS = {
    [MODELS.IMAGE.GEMINI_2_5_FLASH_IMAGE]: {
        ratios: [
            "1:1",
            "3:2",
            "2:3",
            "3:4",
            "4:3",
            "4:5",
            "5:4",
            "9:16",
            "16:9",
            "21:9",
        ],
        resolutions: ["1K"],
        grounding: { google: true, image: false },
    },
    [MODELS.IMAGE.GEMINI_3_PRO_IMAGE_PREVIEW]: {
        ratios: [
            "1:1",
            "3:2",
            "2:3",
            "3:4",
            "4:3",
            "4:5",
            "5:4",
            "9:16",
            "16:9",
            "21:9",
        ],
        resolutions: ["1K", "2K", "4K"],
        grounding: { google: true, image: false },
    },
    [MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE_PREVIEW]: {
        ratios: [
            "1:1",
            "1:4",
            "1:8",
            "3:2",
            "2:3",
            "3:4",
            "4:1",
            "4:3",
            "4:5",
            "5:4",
            "8:1",
            "9:16",
            "16:9",
            "21:9",
        ],
        resolutions: ["512", "1K", "2K", "4K"],
        grounding: { google: true, image: true },
    },
} as const;

export const ImageNode = memo(
    ({ data, selected, id }: NodeProps<Node<ImageData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const selectNode = useFlowStore((state) => state.selectNode);
        const { executeNode, runFromNode } = useFlowExecution();
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const nodeRef = useRef<HTMLDivElement>(null);
        const [localPrompt, setLocalPrompt] = useState(data.prompt);
        const [prevDataPrompt, setPrevDataPrompt] = useState(data.prompt);
        const [isImageOpen, setIsImageOpen] = useState(false);
        const [isRunMenuOpen, setIsRunMenuOpen] = useState(false);
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

        const handleRunFromHere = useCallback(
            (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                runFromNode(id);
            },
            [runFromNode, id],
        );

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

        const handleModelChange = (value: string) => {
            const newModel = value as keyof typeof IMAGE_MODEL_CONFIGS;
            const config = IMAGE_MODEL_CONFIGS[newModel];
            const updates: Partial<ImageData> = { model: newModel };

            // Reset ratio if not supported
            if (
                !(config.ratios as readonly string[]).includes(data.aspectRatio)
            ) {
                updates.aspectRatio = config
                    .ratios[0] as ImageData["aspectRatio"];
            }

            // Reset resolution if not supported
            if (
                !(config.resolutions as readonly string[]).includes(
                    data.resolution,
                )
            ) {
                updates.resolution = config
                    .resolutions[0] as ImageData["resolution"];
            }

            // Reset grounding if not supported
            if (!config.grounding.google) updates.groundingGoogleSearch = false;
            if (!config.grounding.image) updates.groundingImageSearch = false;

            updateNodeData(id, updates);
        };

        const currentModelConfig =
            IMAGE_MODEL_CONFIGS[
                data.model as keyof typeof IMAGE_MODEL_CONFIGS
            ] ||
            IMAGE_MODEL_CONFIGS[MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE_PREVIEW];

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
                }`}
                style={{ width: dimensions.width }}
            >
                {data.executing && (
                    <div
                        className="border-beam-glow"
                        style={
                            { "--beam-color": "#f97316" } as React.CSSProperties
                        }
                    />
                )}

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

                <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-orange-500/10">
                        <ImageIcon className="h-5 w-5 text-orange-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-foreground mb-1 truncate text-sm font-semibold">
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
                                            className="flex h-8 w-8 items-center justify-center rounded-full text-orange-400 transition-colors hover:bg-orange-500/20"
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
                                    className="flex h-8 w-8 items-center justify-center rounded-md text-orange-400 transition-colors hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
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
                                        className={`flex h-8 w-8 items-center justify-center rounded-md text-orange-400 transition-colors hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${isRunMenuOpen ? "bg-orange-500/20" : ""}`}
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
                                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <FastForward className="h-3 w-3" />
                                                Run from here
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
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
                                className="nowheel nopan text-muted-foreground focus:text-foreground nodrag mb-2 w-full resize-none overflow-y-auto border-none bg-transparent text-xs transition-colors outline-none"
                                style={{ minHeight: "1.5em", maxHeight: 200 }}
                                rows={1}
                            />
                        </div>
                        {data.error && (
                            <div className="text-destructive mt-2 text-xs font-medium">
                                Error: {data.error}
                            </div>
                        )}
                    </div>
                </div>

                {data.images.length > 0 && displayUrl && (
                    <>
                        <div
                            className="border-border mt-3 cursor-pointer overflow-hidden rounded-md border transition-opacity hover:opacity-90"
                            style={{ maxHeight: dimensions.height - 200 }}
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
                                    // Allow native context menu on thumbnail too if requested,
                                    // but usually users want it on the full view.
                                    // If we want it on thumbnail, we should stop propagation here too.
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

                <div className="border-border/50 mt-3 flex flex-wrap gap-2 border-t pt-3">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="w-fit">
                                    <Select
                                        value={data.model}
                                        onValueChange={handleModelChange}
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
                                                    MODELS.IMAGE
                                                        .GEMINI_2_5_FLASH_IMAGE
                                                }
                                            >
                                                Nano Banana
                                            </SelectItem>
                                            <SelectItem
                                                value={
                                                    MODELS.IMAGE
                                                        .GEMINI_3_PRO_IMAGE_PREVIEW
                                                }
                                            >
                                                Nano Banana Pro
                                            </SelectItem>
                                            <SelectItem
                                                value={
                                                    MODELS.IMAGE
                                                        .GEMINI_3_1_FLASH_IMAGE_PREVIEW
                                                }
                                            >
                                                Nano Banana 2
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Model</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="w-fit">
                                    <Select
                                        value={data.aspectRatio}
                                        onValueChange={(value) =>
                                            updateNodeData(id, {
                                                aspectRatio:
                                                    value as ImageData["aspectRatio"],
                                            })
                                        }
                                    >
                                        <SelectTrigger
                                            size="sm"
                                            className="h-7 w-fit rounded-full px-3 text-[10px]"
                                        >
                                            <SelectValue placeholder="Ratio" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {currentModelConfig.ratios.map(
                                                (ratio) => (
                                                    <SelectItem
                                                        key={ratio}
                                                        value={ratio}
                                                    >
                                                        {ratio}
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Aspect Ratio</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="w-fit">
                                    <Select
                                        value={data.resolution}
                                        onValueChange={(value) =>
                                            updateNodeData(id, {
                                                resolution:
                                                    value as ImageData["resolution"],
                                            })
                                        }
                                    >
                                        <SelectTrigger
                                            size="sm"
                                            className="h-7 w-fit rounded-full px-3 text-[10px]"
                                        >
                                            <SelectValue placeholder="Res" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {currentModelConfig.resolutions.map(
                                                (res) => (
                                                    <SelectItem
                                                        key={res}
                                                        value={res}
                                                    >
                                                        {res}
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Resolution</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div
                                    className={`flex h-7 items-center gap-1.5 rounded-full py-1 transition-colors ${data.groundingGoogleSearch ? "bg-blue-500/10 text-blue-400" : "bg-muted/30 text-muted-foreground opacity-50"}`}
                                >
                                    <Globe className="h-3 w-3" />
                                    <Switch
                                        disabled={
                                            !currentModelConfig.grounding.google
                                        }
                                        className="scale-75"
                                        checked={data.groundingGoogleSearch}
                                        onCheckedChange={(checked) =>
                                            updateNodeData(id, {
                                                groundingGoogleSearch: checked,
                                            })
                                        }
                                    />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Google Search Grounding</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div
                                    className={`flex h-7 items-center gap-1.5 rounded-full py-1 transition-colors ${data.groundingImageSearch ? "bg-green-500/10 text-green-400" : "bg-muted/30 text-muted-foreground opacity-50"}`}
                                >
                                    <Search className="h-3 w-3" />
                                    <Switch
                                        disabled={
                                            !currentModelConfig.grounding.image
                                        }
                                        className="scale-75"
                                        checked={data.groundingImageSearch}
                                        onCheckedChange={(checked) =>
                                            updateNodeData(id, {
                                                groundingImageSearch: checked,
                                            })
                                        }
                                    />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Image Search Grounding</p>
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
                    className="!bg-orange-500"
                    id="result-output"
                />
            </div>
        );
    },
);

ImageNode.displayName = "ImageNode";
