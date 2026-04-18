"use client";

import type React from "react";

import { memo, useState, useCallback } from "react";
import Image from "next/image";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { UpscaleData } from "@/lib/types";
import { ZoomIn } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { NodeTitle } from "@/components/nodes/node-title";
import { useFlowExecution } from "@/hooks/use-flow-execution";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { MediaViewer } from "@/components/nodes/media-viewer";
import { BatchMediaGallery } from "@/components/nodes/batch-media-gallery";
import { useNodeResize } from "@/hooks/use-node-resize";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { NodeResizeHandle } from "@/components/nodes/node-resize-handle";
import { NodeActionBar } from "@/components/nodes/node-action-bar";
import { cn } from "@/lib/utils";

export const UpscaleNode = memo(
    ({ data, selected, id }: NodeProps<Node<UpscaleData>>) => {
        const selectNode = useFlowStore((state) => state.selectNode);
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const deleteNode = useFlowStore((state) => state.deleteNode);
        const { executeNode, runFromNode } = useFlowExecution();
        const [isImageOpen, setIsImageOpen] = useState(false);
        const [isHovered, setIsHovered] = useState(false);
        const [mediaAspectRatio, setMediaAspectRatio] = useState<
            number | undefined
        >(undefined);

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

        const { displayUrl: rawDisplayUrl } = useSignedUrl(data.image);
        const displayUrl = rawDisplayUrl || "/placeholder.svg";

        const handleDelete = useCallback(
            () => deleteNode(id),
            [deleteNode, id],
        );

        const handleDownload = useCallback(() => {
            if (!rawDisplayUrl) return;
            const a = document.createElement("a");
            a.href = rawDisplayUrl;
            a.download = `${data.name || "upscaled"}.png`;
            a.click();
        }, [rawDisplayUrl, data.name]);

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

        return (
            <div
                className="relative"
                style={{ width: dimensions.width, height: dimensions.height }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onFocusCapture={() => selectNode(id)}
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
                        data.image ? () => setIsImageOpen(true) : undefined
                    }
                    onDownload={rawDisplayUrl ? handleDownload : undefined}
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
                                "--beam-color": "#ef4444",
                            } as React.CSSProperties
                        }
                    />
                )}

                {/* Batch badge */}
                {data.batchTotal && data.batchTotal > 0 && !data.executing && (
                    <span className="absolute top-2 right-2 z-10 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
                        {data.batchTotal}x
                    </span>
                )}

                {/* Handle label */}
                <div
                    className="text-muted-foreground absolute right-full mr-3 text-[10px] font-medium whitespace-nowrap"
                    style={{ top: "50%", transform: "translateY(-50%)" }}
                >
                    Image
                </div>

                {/* Media box */}
                <div
                    className={cn(
                        "bg-card relative h-full w-full overflow-hidden rounded-lg border transition-[border-color,border-width] duration-150",
                        selected
                            ? "border-primary border-2"
                            : "border-border border",
                    )}
                >
                    {/* Content */}
                    {data.images && data.images.length > 1 ? (
                        <BatchMediaGallery
                            items={data.images}
                            type="image"
                            maxHeight={dimensions.height}
                            nodeWidth={dimensions.width}
                        />
                    ) : data.image && displayUrl ? (
                        <Image
                            src={displayUrl}
                            alt={data.name}
                            width={dimensions.width}
                            height={dimensions.height}
                            className="h-full w-full cursor-pointer object-contain"
                            onLoad={handleImageLoad}
                            onClick={() => setIsImageOpen(true)}
                            unoptimized={displayUrl.startsWith("data:")}
                            onContextMenu={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <ZoomIn className="text-muted-foreground/20 h-10 w-10" />
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
                    <Select
                        value={data.upscaleFactor}
                        onValueChange={(value) =>
                            updateNodeData(id, {
                                upscaleFactor: value as "x2" | "x3" | "x4",
                            })
                        }
                    >
                        <SelectTrigger
                            size="sm"
                            className="h-6 w-fit rounded-md px-2 text-[10px]"
                        >
                            <SelectValue placeholder="Scale" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="x2">2x</SelectItem>
                            <SelectItem value="x3">3x</SelectItem>
                            <SelectItem value="x4">4x</SelectItem>
                        </SelectContent>
                    </Select>
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
                    id="image-input"
                    className="bg-green-500"
                    style={{ top: "50%" }}
                />
                <Handle
                    type="source"
                    position={Position.Right}
                    className="bg-red-500"
                    id="result-output"
                />

                <NodeResizeHandle onResizeStart={handleResizeStart} />

                {data.image && displayUrl && (
                    <MediaViewer
                        isOpen={isImageOpen}
                        onOpenChange={setIsImageOpen}
                        url={displayUrl}
                        alt={data.name}
                    />
                )}
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

UpscaleNode.displayName = "UpscaleNode";
