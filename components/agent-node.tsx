"use client";

import type React from "react";

import { memo, useRef, useEffect, useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { AgentData } from "@/lib/types";
import { Bot, Play } from "lucide-react";
import { useFlow } from "./flow-provider";

export const AgentNode = memo(
    ({ data, selected, id }: NodeProps<Node<AgentData>>) => {
        const { updateNodeData, executeNode } = useFlow();
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const [localInstructions, setLocalInstructions] = useState(
            data.instructions,
        );
        const [prevDataInstructions, setPrevDataInstructions] = useState(
            data.instructions,
        );

        if (data.instructions !== prevDataInstructions) {
            setPrevDataInstructions(data.instructions);
            setLocalInstructions(data.instructions);
        }

        useEffect(() => {
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
                textareaRef.current.style.height =
                    textareaRef.current.scrollHeight + "px";
            }
        }, [localInstructions]);

        const handleInstructionsChange = (
            e: React.ChangeEvent<HTMLTextAreaElement>,
        ) => {
            setLocalInstructions(e.target.value);
        };

        const handleBlur = () => {
            updateNodeData(id, { instructions: localInstructions });
        };

        const handleExecute = (e: React.MouseEvent) => {
            e.stopPropagation();
            executeNode(id);
        };

        return (
            <div
                className={`bg-card relative max-w-[220px] min-w-[220px] rounded-lg border-2 p-4 shadow-lg transition-all ${
                    selected
                        ? "border-primary shadow-primary/20"
                        : "border-border"
                } ${data.executing ? "animate-pulse-bg" : ""}`}
            >
                <Handle
                    type="target"
                    position={Position.Left}
                    id="prompt-input"
                    className="!bg-blue-500"
                    style={{ top: 35, left: -6 }}
                />
                <div className="absolute top-[18px] right-full mr-5 text-xs font-semibold whitespace-nowrap text-blue-500">
                    Prompt
                </div>

                <Handle
                    type="target"
                    position={Position.Left}
                    id="file-input"
                    className="!bg-cyan-500"
                    style={{ top: 65, left: -6 }}
                />
                <div className="absolute top-[48px] right-full mr-5 text-xs font-semibold whitespace-nowrap text-cyan-500">
                    File(s)
                </div>

                <div className="flex items-start gap-3">
                    <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md">
                        <Bot className="text-primary h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <h3 className="text-foreground mb-1 truncate text-sm font-semibold">
                            {data.name}
                        </h3>
                        <div className="mb-1 flex items-center gap-2">
                            <span className="font-mono text-xs text-blue-400">
                                {data.model}
                            </span>
                        </div>
                        <textarea
                            ref={textareaRef}
                            value={localInstructions}
                            onChange={handleInstructionsChange}
                            onBlur={handleBlur}
                            placeholder="Enter instructions..."
                            className="text-muted-foreground focus:text-foreground nodrag mt-2 w-full resize-none overflow-hidden border-none bg-transparent text-xs transition-colors outline-none"
                            rows={1}
                        />
                        {data.executing && (
                            <div className="text-primary mt-2 text-xs">
                                Generating...
                            </div>
                        )}
                    </div>
                </div>

                {data.output && (
                    <div className="border-border/50 mt-3 border-t pt-3">
                        <div className="text-muted-foreground mb-1 text-xs">
                            Output:
                        </div>
                        <div className="text-foreground bg-muted/30 max-h-[200px] overflow-y-auto rounded-md p-2 text-xs break-words whitespace-pre-wrap">
                            {data.output}
                        </div>
                    </div>
                )}

                <button
                    onClick={handleExecute}
                    disabled={data.executing}
                    className="bg-primary/10 hover:bg-primary/20 text-primary mt-3 flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Play className="h-3 w-3" />
                    Execute Node
                </button>

                <Handle
                    type="source"
                    position={Position.Right}
                    className="!bg-primary"
                />
            </div>
        );
    },
);

AgentNode.displayName = "AgentNode";
