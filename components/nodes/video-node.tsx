"use client";

import type React from "react";

import { memo, useState, useCallback, useEffect, useRef } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { VideoData } from "@/lib/types";
import { Video, Volume2, VolumeX } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { NodeTitle } from "@/components/nodes/node-title";
import { useFlowExecution } from "@/hooks/use-flow-execution";
import { MentionEditor } from "@/components/nodes/mention-editor";
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
import { BatchMediaGallery } from "@/components/nodes/batch-media-gallery";
import { useNodeResize } from "@/hooks/use-node-resize";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { useSyncedState } from "@/hooks/use-synced-state";
import { NodeResizeHandle } from "@/components/nodes/node-resize-handle";
import { NodeActionBar } from "@/components/nodes/node-action-bar";
import { cn } from "@/lib/utils";

export const VideoNode = memo(
    ({ data, selected, id }: NodeProps<Node<VideoData>>) => {
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

        const connectedTextNodes = useConnectedSourceNodes(id, "prompt-input");
        const { dimensions, handleResizeStart } = useNodeResize(
            id,
            data.width,
            data.height,
            {
                defaultWidth: 320,
                defaultHeight: 180,
                minWidth: 200,
                minHeight: 100,
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

        const { displayUrl: videoPlaybackUrl } = useSignedUrl(data.videoUrl);

        const handleDelete = useCallback(
            () => deleteNode(id),
            [deleteNode, id],
        );

        const handleDownload = useCallback(() => {
            if (!videoPlaybackUrl) return;
            const a = document.createElement("a");
            a.href = videoPlaybackUrl;
            a.download = `${data.name || "video"}.mp4`;
            a.click();
        }, [videoPlaybackUrl, data.name]);

        const handleVideoMetadata = useCallback(
            (e: React.SyntheticEvent<HTMLVideoElement>) => {
                const video = e.currentTarget;
                if (video.videoWidth && video.videoHeight) {
                    const ratio = video.videoWidth / video.videoHeight;
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

        const handlePromptChange = (value: string) => {
            setLocalPrompt(value);
            updateNodeData(id, { prompt: value });
        };

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
                    onDownload={data.videoUrl ? handleDownload : undefined}
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
                                "--beam-color": "var(--color-port-video)",
                            } as React.CSSProperties
                        }
                    />
                )}

                {/* Batch badge */}
                {data.batchTotal && data.batchTotal > 0 && !data.executing && (
                    <span className="absolute top-2 right-2 z-10 rounded-full bg-pink-500/20 px-2 py-0.5 text-[10px] font-bold text-pink-400">
                        {data.batchTotal}x
                    </span>
                )}

                {/* Handle labels */}
                <div
                    className="text-muted-foreground absolute right-full mr-3 text-[10px] font-medium whitespace-nowrap"
                    style={{ top: "20%", transform: "translateY(-50%)" }}
                >
                    Prompt
                </div>
                <div
                    className="text-muted-foreground absolute right-full mr-3 text-[10px] font-medium whitespace-nowrap"
                    style={{ top: "40%", transform: "translateY(-50%)" }}
                >
                    First frame
                </div>
                <div
                    className="text-muted-foreground absolute right-full mr-3 text-[10px] font-medium whitespace-nowrap"
                    style={{ top: "60%", transform: "translateY(-50%)" }}
                >
                    Last frame
                </div>
                <div
                    className="text-muted-foreground absolute right-full mr-3 text-[10px] font-medium whitespace-nowrap"
                    style={{ top: "80%", transform: "translateY(-50%)" }}
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
                    {data.videoUrls && data.videoUrls.length > 1 ? (
                        <BatchMediaGallery
                            items={data.videoUrls}
                            type="video"
                            maxHeight={dimensions.height}
                            nodeWidth={dimensions.width}
                        />
                    ) : data.videoUrl ? (
                        <video
                            src={videoPlaybackUrl}
                            controls
                            className="h-full w-full object-contain"
                            onLoadedMetadata={handleVideoMetadata}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <Video className="text-muted-foreground/20 h-10 w-10" />
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
                            onValueChange={(value) =>
                                updateNodeData(id, {
                                    model: value as VideoData["model"],
                                })
                            }
                        >
                            <SelectTrigger
                                size="sm"
                                className="h-6 w-fit rounded-md px-2 text-[10px]"
                            >
                                <SelectValue placeholder="Model" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={MODELS.VIDEO.VEO_3_1_LITE}>
                                    Veo 3.1 Lite
                                </SelectItem>
                                <SelectItem value={MODELS.VIDEO.VEO_3_1_FAST}>
                                    Veo 3.1 Fast
                                </SelectItem>
                                <SelectItem value={MODELS.VIDEO.VEO_3_1_PRO}>
                                    Veo 3.1 Pro
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={data.aspectRatio}
                            onValueChange={(value) =>
                                updateNodeData(id, {
                                    aspectRatio:
                                        value as VideoData["aspectRatio"],
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
                                <SelectItem value="16:9">16:9</SelectItem>
                                <SelectItem value="9:16">9:16</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={String(data.duration)}
                            onValueChange={(value) =>
                                updateNodeData(id, {
                                    duration: Number(
                                        value,
                                    ) as VideoData["duration"],
                                })
                            }
                        >
                            <SelectTrigger
                                size="sm"
                                className="h-6 w-fit rounded-md px-2 text-[10px]"
                            >
                                <SelectValue placeholder="Duration" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="4">4s</SelectItem>
                                <SelectItem value="6">6s</SelectItem>
                                <SelectItem value="8">8s</SelectItem>
                            </SelectContent>
                        </Select>
                        <div
                            className={cn(
                                "flex h-6 items-center gap-1 rounded-md px-1.5 transition-colors",
                                data.generateAudio
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground opacity-60",
                            )}
                        >
                            {data.generateAudio ? (
                                <Volume2 className="h-3 w-3" />
                            ) : (
                                <VolumeX className="h-3 w-3" />
                            )}
                            <Switch
                                className="scale-75"
                                checked={data.generateAudio}
                                onCheckedChange={(checked) =>
                                    updateNodeData(id, {
                                        generateAudio: checked,
                                    })
                                }
                            />
                        </div>
                    </div>
                    <MentionEditor
                        value={localPrompt}
                        onChange={handlePromptChange}
                        availableNodes={connectedTextNodes}
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
                    style={{ top: "20%" }}
                />
                <Handle
                    type="target"
                    position={Position.Left}
                    id="first-frame-input"
                    className="bg-blue-500"
                    style={{ top: "40%" }}
                />
                <Handle
                    type="target"
                    position={Position.Left}
                    id="last-frame-input"
                    className="bg-purple-500"
                    style={{ top: "60%" }}
                />
                <Handle
                    type="target"
                    position={Position.Left}
                    id="image-input"
                    className="bg-green-500"
                    style={{ top: "80%" }}
                />
                <Handle
                    type="source"
                    position={Position.Right}
                    className="bg-port-video"
                    id="result-output"
                />

                <NodeResizeHandle onResizeStart={handleResizeStart} />
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

VideoNode.displayName = "VideoNode";
