"use client";

import type React from "react";

import { memo, useState, useCallback } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { VideoData } from "@/lib/types";
import {
    Video,
    Play,
    ChevronDown,
    FastForward,
    Loader2,
    Settings,
    Volume2,
    VolumeX,
} from "lucide-react";
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { BatchMediaGallery } from "@/components/nodes/batch-media-gallery";
import { useNodeResize } from "@/hooks/use-node-resize";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { useSyncedState } from "@/hooks/use-synced-state";
import { NodeResizeHandle } from "@/components/nodes/node-resize-handle";

export const VideoNode = memo(
    ({ data, selected, id }: NodeProps<Node<VideoData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const selectNode = useFlowStore((state) => state.selectNode);
        const { executeNode, runFromNode } = useFlowExecution();
        const [localPrompt, setLocalPrompt] = useSyncedState(data.prompt);

        const connectedTextNodes = useConnectedSourceNodes(id, "prompt-input");
        const [isRunMenuOpen, setIsRunMenuOpen] = useState(false);
        const { dimensions, handleResizeStart } = useNodeResize(
            id,
            data.width,
            data.height,
            {
                defaultWidth: 400,
                defaultHeight: 600,
                minWidth: 220,
                minHeight: 300,
            },
        );

        const { displayUrl: videoPlaybackUrl } = useSignedUrl(data.videoUrl);

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

        return (
            <div
                className={`node-container ${selected ? "selected" : ""}`}
                style={{ width: dimensions.width }}
            >
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
                {data.batchTotal && data.batchTotal > 0 && !data.executing && (
                    <span className="absolute top-2 right-2 z-10 rounded-full bg-pink-500/20 px-2 py-0.5 text-[10px] font-bold text-pink-400">
                        {data.batchTotal}x
                    </span>
                )}

                {/* Prompt Input Handle */}
                <Handle
                    type="target"
                    position={Position.Left}
                    id="prompt-input"
                    className="bg-pink-500"
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
                    className="bg-blue-500"
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
                    className="bg-purple-500"
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
                    className="bg-green-500"
                    style={{ top: 125, left: -6 }}
                />
                <div className="absolute top-[108px] right-full mr-5 text-xs font-semibold whitespace-nowrap text-green-500">
                    Image(s)
                </div>

                <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-pink-500/10">
                        <Video className="h-5 w-5 text-pink-400" />
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
                                            className="flex h-8 w-8 items-center justify-center rounded-full text-pink-400 transition-colors hover:bg-pink-500/20"
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
                                    className="flex h-8 w-8 items-center justify-center rounded-md text-pink-400 transition-colors hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-50"
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
                                        className={`flex h-8 w-8 items-center justify-center rounded-md text-pink-400 transition-colors hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${isRunMenuOpen ? "bg-pink-500/20" : ""}`}
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
                                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-pink-400 transition-colors hover:bg-pink-500/10 disabled:cursor-not-allowed disabled:opacity-50"
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
                            availableNodes={connectedTextNodes}
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

                {data.videoUrls && data.videoUrls.length > 1 ? (
                    <BatchMediaGallery
                        items={data.videoUrls}
                        type="video"
                        maxHeight={dimensions.height - 200}
                        nodeWidth={dimensions.width}
                    />
                ) : data.videoUrl ? (
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
                ) : null}

                <div className="border-border/50 mt-3 flex flex-wrap gap-2 border-t pt-3">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="w-fit">
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
                                            className="h-7 w-fit rounded-full px-3 text-[10px]"
                                        >
                                            <SelectValue placeholder="Model" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem
                                                value={
                                                    MODELS.VIDEO.VEO_3_1_LITE
                                                }
                                            >
                                                Veo 3.1 Lite
                                            </SelectItem>
                                            <SelectItem
                                                value={
                                                    MODELS.VIDEO.VEO_3_1_FAST
                                                }
                                            >
                                                Veo 3.1 Fast
                                            </SelectItem>
                                            <SelectItem
                                                value={MODELS.VIDEO.VEO_3_1_PRO}
                                            >
                                                Veo 3.1 Pro
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
                                                    value as VideoData["aspectRatio"],
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
                                            <SelectItem value="16:9">
                                                16:9
                                            </SelectItem>
                                            <SelectItem value="9:16">
                                                9:16
                                            </SelectItem>
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
                                                    value as VideoData["resolution"],
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
                                            <SelectItem value="720p">
                                                720p
                                            </SelectItem>
                                            <SelectItem value="1080p">
                                                1080p
                                            </SelectItem>
                                            <SelectItem value="4k">
                                                4k
                                            </SelectItem>
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
                                <div className="w-fit">
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
                                            className="h-7 w-fit rounded-full px-3 text-[10px]"
                                        >
                                            <SelectValue placeholder="Duration" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="4">
                                                4s
                                            </SelectItem>
                                            <SelectItem value="6">
                                                6s
                                            </SelectItem>
                                            <SelectItem value="8">
                                                8s
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Duration</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div
                                    className={`flex h-7 items-center gap-1.5 rounded-full px-1.5 py-1 transition-colors ${data.generateAudio ? "bg-pink-500/10 text-pink-400" : "bg-muted/30 text-muted-foreground opacity-50"}`}
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
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Generate Audio</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                <NodeResizeHandle onResizeStart={handleResizeStart} />

                <Handle
                    type="source"
                    position={Position.Right}
                    className="bg-port-video"
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

VideoNode.displayName = "VideoNode";
