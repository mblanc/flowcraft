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
import { NodeTitle } from "@/components/node-title";
import { useFlowExecution } from "@/hooks/use-flow-execution";
import { MentionEditor } from "@/components/mention-editor";
import { useConnectedSourceNodes } from "@/hooks/use-connected-source-nodes";
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
import { BatchMediaGallery } from "@/components/batch-media-gallery";
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
        const nodeRef = useRef<HTMLDivElement>(null);
        const [localPrompt, setLocalPrompt] = useState(data.prompt);
        const [prevDataPrompt, setPrevDataPrompt] = useState(data.prompt);

        const connectedNodes = useConnectedSourceNodes(id);
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

        const handlePromptChange = (value: string) => {
            setLocalPrompt(value);
            updateNodeData(id, { prompt: value });
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
                className={`bg-card relative rounded-lg border-2 p-4 shadow-lg transition-[border-color,shadow,background-color] ${
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

                {data.batchTotal && data.batchTotal > 0 && !data.executing && (
                    <span className="absolute top-2 right-2 z-10 rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                        {data.batchTotal}x
                    </span>
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
                                    className="flex h-8 items-center justify-center gap-1 rounded-md px-1 text-orange-400 transition-colors hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
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
                        <MentionEditor
                            value={localPrompt}
                            onChange={handlePromptChange}
                            availableNodes={connectedNodes}
                            placeholder="Enter prompt..."
                            className="nowheel nopan nodrag text-muted-foreground mb-2 w-full text-xs"
                        />
                        {data.error && (
                            <div className="text-destructive mt-2 text-xs font-medium">
                                Error: {data.error}
                            </div>
                        )}
                    </div>
                </div>

                {data.images.length > 1 ? (
                    <BatchMediaGallery
                        items={data.images}
                        type="image"
                        maxHeight={dimensions.height - 200}
                        nodeWidth={dimensions.width}
                    />
                ) : data.images.length === 1 && displayUrl ? (
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
                ) : null}

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
    (prevProps, nextProps) => {
        return (
            prevProps.id === nextProps.id &&
            prevProps.selected === nextProps.selected &&
            prevProps.data === nextProps.data
        );
    },
);

ImageNode.displayName = "ImageNode";
