"use client";

import { memo, useState, useCallback } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { MusicData } from "@/lib/types";
import { Music } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { NodeTitle } from "@/components/nodes/node-title";
import { NodeActionBar } from "@/components/nodes/node-action-bar";
import { NodeParamsBar } from "@/components/nodes/node-params-bar";
import { useFlowExecution } from "@/hooks/use-flow-execution";
import { useSyncedState } from "@/hooks/use-synced-state";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { MODELS } from "@/lib/constants";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const NODE_WIDTH = 272;

export const FlowNode = memo(
    ({ data, selected, id }: NodeProps<Node<MusicData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const deleteNode = useFlowStore((state) => state.deleteNode);
        const { executeNode, runFromNode } = useFlowExecution();
        const [localPrompt, setLocalPrompt] = useSyncedState(data.prompt);
        const [isHovered, setIsHovered] = useState(false);

        const { displayUrl } = useSignedUrl(data.audioUrl);

        const handleDownload = useCallback(() => {
            if (!displayUrl) return;
            const a = document.createElement("a");
            a.href = displayUrl;
            a.download = `${data.name || "music"}.wav`;
            a.click();
        }, [displayUrl, data.name]);

        return (
            <div
                className="relative"
                style={{ width: NODE_WIDTH }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Floating title */}
                <div className="pointer-events-auto absolute -top-7 left-2 z-20 flex items-center gap-1.5">
                    <Music className="text-muted-foreground h-3.5 w-3.5" />
                    <NodeTitle
                        name={data.name}
                        onRename={(name) => updateNodeData(id, { name })}
                        className="text-foreground text-xs"
                    />
                </div>

                {/* Action bar */}
                <NodeActionBar
                    isVisible={selected || isHovered || data.executing}
                    onGenerate={() => executeNode(id)}
                    onRunFromHere={() => runFromNode(id)}
                    onDownload={displayUrl ? handleDownload : undefined}
                    onDelete={() => deleteNode(id)}
                    isExecuting={data.executing}
                    batchProgress={data.batchProgress}
                    batchTotal={data.batchTotal}
                />

                {/* Media box */}
                <div
                    className={cn(
                        "bg-card overflow-hidden rounded-lg border transition-[border-color,border-width] duration-150",
                        selected
                            ? "border-primary border-2"
                            : "border-border border",
                    )}
                >
                    {displayUrl ? (
                        <div className="flex flex-col gap-2 p-3">
                            <audio
                                controls
                                src={displayUrl}
                                className="nodrag w-full rounded"
                            />
                            {data.error && (
                                <p className="text-destructive text-xs">
                                    {data.error}
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="flex h-24 items-center justify-center">
                            <Music
                                className={cn(
                                    "h-10 w-10",
                                    data.executing
                                        ? "text-primary animate-pulse"
                                        : "text-muted-foreground/20",
                                )}
                            />
                        </div>
                    )}
                </div>

                {/* Params bar — model, duration, prompt */}
                <NodeParamsBar
                    isVisible={selected || isHovered}
                    nodeWidth={NODE_WIDTH}
                >
                    <div className="mb-2 flex flex-wrap gap-1.5">
                        <Select
                            value={data.model ?? MODELS.MUSIC.LYRIA_3_CLIP}
                            onValueChange={(model) =>
                                updateNodeData(id, { model })
                            }
                        >
                            <SelectTrigger
                                size="sm"
                                className="h-6 w-fit rounded-md px-2 text-[10px]"
                            >
                                <SelectValue placeholder="Model" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={MODELS.MUSIC.LYRIA_3_CLIP}>
                                    Lyria 3 Clip
                                </SelectItem>
                                <SelectItem value={MODELS.MUSIC.LYRIA_3_PRO}>
                                    Lyria 3 Pro
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Textarea
                        value={localPrompt}
                        onChange={(e) => setLocalPrompt(e.target.value)}
                        onBlur={() =>
                            updateNodeData(id, { prompt: localPrompt })
                        }
                        placeholder="Describe the music…"
                        className="nowheel nopan nodrag text-foreground min-h-[80px] w-full resize-none text-[10px]"
                    />
                    {data.error && (
                        <p className="text-destructive mt-1 text-[10px]">
                            {data.error}
                        </p>
                    )}
                </NodeParamsBar>

                {/* Handles */}
                <Handle
                    type="target"
                    position={Position.Left}
                    id="prompt-input"
                    style={{ top: "50%" }}
                />
                <Handle
                    type="source"
                    position={Position.Right}
                    id=""
                    style={{ top: "50%" }}
                />
            </div>
        );
    },
);

FlowNode.displayName = "MusicFlowNode";
