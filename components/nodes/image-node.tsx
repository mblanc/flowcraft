"use client";

import type React from "react";

import { memo, useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { ImageData } from "@/lib/types";
import { ImageIcon, Globe, Search } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { NodeTitle } from "@/components/nodes/node-title";
import { useFlowExecution } from "@/hooks/use-flow-execution";
import { MentionEditor } from "@/components/nodes/mention-editor";
import { useConnectedSourceNodes } from "@/hooks/use-connected-source-nodes";
import { MODELS, IMAGE_MODEL_CONFIGS } from "@/lib/constants";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MediaViewer } from "@/components/nodes/media-viewer";
import { BatchMediaGallery } from "@/components/nodes/batch-media-gallery";
import { useNodeResize } from "@/hooks/use-node-resize";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { useSyncedState } from "@/hooks/use-synced-state";
import { NodeResizeHandle } from "@/components/nodes/node-resize-handle";
import { NodeActionBar } from "@/components/nodes/node-action-bar";
import { cn } from "@/lib/utils";

export const ImageNode = memo(
    ({ data, selected, id }: NodeProps<Node<ImageData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const selectNode = useFlowStore((state) => state.selectNode);
        const deleteNode = useFlowStore((state) => state.deleteNode);
        const { executeNode, runFromNode } = useFlowExecution();
        const [localPrompt, setLocalPrompt] = useSyncedState(data.prompt);
        const [isHovered, setIsHovered] = useState(false);
        const nodeRef = useRef<HTMLDivElement>(null);
        const [mediaAspectRatio, setMediaAspectRatio] = useState<
            number | undefined
        >(undefined);

        const connectedNodes = useConnectedSourceNodes(id);
        const [isImageOpen, setIsImageOpen] = useState(false);
        const { dimensions, handleResizeStart } = useNodeResize(
            id,
            data.width,
            data.height,
            {
                defaultWidth: 300,
                defaultHeight: 300,
                minWidth: 200,
                minHeight: 200,
                lockedAspectRatio: mediaAspectRatio,
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

        const imageSource =
            data.images && data.images.length > 0 ? data.images[0] : undefined;
        const { displayUrl: rawDisplayUrl } = useSignedUrl(imageSource);
        const displayUrl = rawDisplayUrl || "/placeholder.svg";

        const handleExecute = useCallback(() => {
            executeNode(id);
        }, [executeNode, id]);

        const handleRunFromHere = useCallback(() => {
            runFromNode(id);
        }, [runFromNode, id]);

        const handleOpenSettings = useCallback(() => {
            selectNode(id);
            useFlowStore.getState().setIsConfigSidebarOpen(true);
        }, [selectNode, id]);

        const handleDelete = useCallback(
            () => deleteNode(id),
            [deleteNode, id],
        );

        const handleDownload = useCallback(() => {
            if (!displayUrl || displayUrl === "/placeholder.svg") return;
            const a = document.createElement("a");
            a.href = displayUrl;
            a.download = `${data.name || "image"}.png`;
            a.click();
        }, [displayUrl, data.name]);

        const handleImageLoad = useCallback(
            (e: React.SyntheticEvent<HTMLImageElement>) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                    const ratio = img.naturalWidth / img.naturalHeight;
                    setMediaAspectRatio(ratio);
                    updateNodeData(id, {
                        height: Math.round(dimensions.width / ratio),
                    });
                }
            },
            [dimensions.width, id, updateNodeData],
        );

        const handlePromptChange = (value: string) => {
            setLocalPrompt(value);
            updateNodeData(id, { prompt: value });
        };

        const handleModelChange = (value: string) => {
            const newModel = value as keyof typeof IMAGE_MODEL_CONFIGS;
            const config = IMAGE_MODEL_CONFIGS[newModel];
            const updates: Partial<ImageData> = { model: newModel };

            if (
                !(config.ratios as readonly string[]).includes(data.aspectRatio)
            ) {
                updates.aspectRatio = config
                    .ratios[0] as ImageData["aspectRatio"];
            }
            if (
                !(config.resolutions as readonly string[]).includes(
                    data.resolution,
                )
            ) {
                updates.resolution = config
                    .resolutions[0] as ImageData["resolution"];
            }
            if (!config.grounding.google) updates.groundingGoogleSearch = false;
            if (!config.grounding.image) updates.groundingImageSearch = false;

            updateNodeData(id, updates);
        };

        const currentModelConfig =
            IMAGE_MODEL_CONFIGS[
                data.model as keyof typeof IMAGE_MODEL_CONFIGS
            ] ||
            IMAGE_MODEL_CONFIGS[MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE_PREVIEW];

        return (
            <div
                ref={nodeRef}
                className="relative"
                style={{ width: dimensions.width, height: dimensions.height }}
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
                    onFullscreen={
                        data.images.length > 0
                            ? () => setIsImageOpen(true)
                            : undefined
                    }
                    onDownload={
                        data.images.length > 0 ? handleDownload : undefined
                    }
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
                                "--beam-color": "var(--color-port-image)",
                            } as React.CSSProperties
                        }
                    />
                )}

                {/* Batch badge */}
                {data.batchTotal && data.batchTotal > 0 && !data.executing && (
                    <span className="absolute top-2 right-2 z-10 rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                        {data.batchTotal}x
                    </span>
                )}

                {/* Handle labels */}
                <div
                    className="text-muted-foreground absolute right-full mr-3 text-[10px] font-medium whitespace-nowrap"
                    style={{ top: "33%", transform: "translateY(-50%)" }}
                >
                    Prompt
                </div>
                <div
                    className="text-muted-foreground absolute right-full mr-3 text-[10px] font-medium whitespace-nowrap"
                    style={{ top: "66%", transform: "translateY(-50%)" }}
                >
                    Image(s)
                </div>

                {/* Media box */}
                <div
                    className={cn(
                        "bg-card h-full w-full overflow-hidden rounded-lg border transition-[border-color,border-width] duration-150",
                        selected
                            ? "border-primary border-2"
                            : "border-border border",
                    )}
                >
                    {data.images.length > 1 ? (
                        <BatchMediaGallery
                            items={data.images}
                            type="image"
                            maxHeight={dimensions.height}
                            nodeWidth={dimensions.width}
                        />
                    ) : data.images.length === 1 && displayUrl ? (
                        <Image
                            src={displayUrl}
                            alt={data.name}
                            width={dimensions.width}
                            height={dimensions.height}
                            className="h-full w-full object-contain"
                            unoptimized={displayUrl.startsWith("data:")}
                            onLoad={handleImageLoad}
                            onContextMenu={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <ImageIcon className="text-muted-foreground/20 h-10 w-10" />
                        </div>
                    )}
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
                    <div className="mb-2 flex flex-wrap gap-1.5">
                        <Select
                            value={data.model}
                            onValueChange={handleModelChange}
                        >
                            <SelectTrigger
                                size="sm"
                                className="h-6 w-fit rounded-md px-2 text-[10px]"
                            >
                                <SelectValue placeholder="Model" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem
                                    value={MODELS.IMAGE.GEMINI_2_5_FLASH_IMAGE}
                                >
                                    Nano Banana
                                </SelectItem>
                                <SelectItem
                                    value={
                                        MODELS.IMAGE.GEMINI_3_PRO_IMAGE_PREVIEW
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
                                className="h-6 w-fit rounded-md px-2 text-[10px]"
                            >
                                <SelectValue placeholder="Ratio" />
                            </SelectTrigger>
                            <SelectContent>
                                {currentModelConfig.ratios.map((ratio) => (
                                    <SelectItem key={ratio} value={ratio}>
                                        {ratio}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                                className="h-6 w-fit rounded-md px-2 text-[10px]"
                            >
                                <SelectValue placeholder="Res" />
                            </SelectTrigger>
                            <SelectContent>
                                {currentModelConfig.resolutions.map((res) => (
                                    <SelectItem key={res} value={res}>
                                        {res}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div
                            className={cn(
                                "flex h-6 items-center gap-1 rounded-md px-1.5 transition-colors",
                                data.groundingGoogleSearch
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground opacity-60",
                            )}
                        >
                            <Globe className="h-3 w-3" />
                            <Switch
                                disabled={!currentModelConfig.grounding.google}
                                className="scale-75"
                                checked={data.groundingGoogleSearch}
                                onCheckedChange={(checked) =>
                                    updateNodeData(id, {
                                        groundingGoogleSearch: checked,
                                    })
                                }
                            />
                        </div>
                        <div
                            className={cn(
                                "flex h-6 items-center gap-1 rounded-md px-1.5 transition-colors",
                                data.groundingImageSearch
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground opacity-60",
                            )}
                        >
                            <Search className="h-3 w-3" />
                            <Switch
                                disabled={!currentModelConfig.grounding.image}
                                className="scale-75"
                                checked={data.groundingImageSearch}
                                onCheckedChange={(checked) =>
                                    updateNodeData(id, {
                                        groundingImageSearch: checked,
                                    })
                                }
                            />
                        </div>
                    </div>
                    <MentionEditor
                        value={localPrompt}
                        onChange={handlePromptChange}
                        availableNodes={connectedNodes}
                        placeholder="Prompt…"
                        className="nowheel nopan nodrag text-muted-foreground w-full text-[10px]"
                    />
                    {data.error && (
                        <p className="text-destructive mt-1 text-[10px]">
                            {data.error}
                        </p>
                    )}
                </div>

                {/* Handles */}
                <Handle
                    type="target"
                    position={Position.Left}
                    id="prompt-input"
                    className="bg-pink-500"
                    style={{ top: "33%" }}
                />
                <Handle
                    type="target"
                    position={Position.Left}
                    id="image-input"
                    className="bg-green-500"
                    style={{ top: "66%" }}
                />
                <Handle
                    type="source"
                    position={Position.Right}
                    className="bg-port-image"
                    id="result-output"
                />

                <NodeResizeHandle onResizeStart={handleResizeStart} />

                <MediaViewer
                    isOpen={isImageOpen}
                    onOpenChange={setIsImageOpen}
                    url={displayUrl}
                    alt={data.name}
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
