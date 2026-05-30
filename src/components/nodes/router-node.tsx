"use client";

import { memo, useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { GitMerge } from "lucide-react";
import type { RouterData } from "@/lib/types";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { useFlowExecution } from "@/hooks/use-flow-execution";
import { NodeTitle } from "@/components/nodes/node-title";
import { NodeActionBar } from "@/components/nodes/node-action-bar";
import { cn } from "@/lib/utils";

export const RouterNode = memo(
    ({ data, selected, id }: NodeProps<Node<RouterData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const deleteNode = useFlowStore((state) => state.deleteNode);
        const { runFromNode } = useFlowExecution();
        const [isHovered, setIsHovered] = useState(false);

        return (
            <div
                className={cn(
                    "bg-card relative flex items-center gap-2 rounded-lg border px-3 py-2 shadow-sm",
                    "w-40",
                    selected
                        ? "border-primary ring-primary ring-1"
                        : "border-border",
                )}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <NodeActionBar
                    onRunFromHere={() => runFromNode(id)}
                    onDelete={() => deleteNode(id)}
                    isVisible={isHovered || selected}
                />

                <Handle
                    type="target"
                    position={Position.Left}
                    id="input"
                    className="!bg-gray-400"
                />

                <GitMerge className="size-4 shrink-0 text-gray-400" />

                <NodeTitle
                    name={data.name}
                    onRename={(name) => updateNodeData(id, { name })}
                    className="text-foreground flex-1"
                />

                <Handle
                    type="source"
                    position={Position.Right}
                    id="output"
                    className="!bg-gray-400"
                />
            </div>
        );
    },
);

RouterNode.displayName = "RouterNode";
