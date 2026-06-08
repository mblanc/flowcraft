"use client";

import { memo, useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { MusicData } from "@/lib/types";
import { Music } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { NodeTitle } from "@/components/nodes/node-title";
import { NodeActionBar } from "@/components/nodes/node-action-bar";
import { useFlowExecution } from "@/hooks/use-flow-execution";
import { useSyncedState } from "@/hooks/use-synced-state";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const FlowNode = memo(
    ({ data, selected, id }: NodeProps<Node<MusicData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const deleteNode = useFlowStore((state) => state.deleteNode);
        const { executeNode, runFromNode } = useFlowExecution();
        const [localPrompt, setLocalPrompt] = useSyncedState(data.prompt);
        const [isHovered, setIsHovered] = useState(false);

        return (
            <div
                className={cn(
                    "bg-background relative flex w-72 flex-col gap-2 rounded-xl border p-3 shadow-sm transition-shadow",
                    selected
                        ? "border-primary shadow-md"
                        : "border-border hover:shadow-md",
                )}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className="pointer-events-auto absolute -top-7 left-2 z-20 flex items-center gap-1.5">
                    <Music className="text-muted-foreground h-3.5 w-3.5" />
                    <NodeTitle
                        name={data.name}
                        onRename={(name) => updateNodeData(id, { name })}
                        className="text-foreground text-xs"
                    />
                </div>

                <NodeActionBar
                    isVisible={selected || isHovered || data.executing}
                    onGenerate={() => executeNode(id)}
                    onRunFromHere={() => runFromNode(id)}
                    onDelete={() => deleteNode(id)}
                    isExecuting={data.executing}
                    batchProgress={data.batchProgress}
                    batchTotal={data.batchTotal}
                />

                <Handle
                    type="target"
                    position={Position.Left}
                    id="prompt-input"
                    style={{ top: "50%" }}
                />

                <Textarea
                    className="nodrag min-h-[72px] resize-none text-sm"
                    placeholder="Describe the music to generate…"
                    value={localPrompt}
                    onChange={(e) => setLocalPrompt(e.target.value)}
                    onBlur={() => updateNodeData(id, { prompt: localPrompt })}
                />

                {data.error && (
                    <p className="text-destructive text-xs">{data.error}</p>
                )}

                {data.audioUrl && (
                    <audio
                        controls
                        src={data.audioUrl}
                        className="nodrag w-full rounded"
                    />
                )}

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
