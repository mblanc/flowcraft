"use client";

import type React from "react";
import { memo, useState, useEffect, useRef, useMemo } from "react";
import {
    Handle,
    Position,
    useEdges,
    useNodes,
    type NodeProps,
    type Node,
} from "@xyflow/react";
import type { PromptData } from "@/lib/types";
import { Terminal, PlayCircle } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { useFlowExecution } from "@/hooks/use-flow-execution";
import { Textarea } from "./ui/textarea";

const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 250;
const MIN_HEIGHT = 150;

export const PromptNode = memo(
    ({ data, selected, id }: NodeProps<Node<PromptData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const { executeNode } = useFlowExecution();
        const [localPrompt, setLocalPrompt] = useState(data.prompt);
        const [prevDataPrompt, setPrevDataPrompt] = useState(data.prompt);

        const [dimensions, setDimensions] = useState({
            width: data.width || DEFAULT_WIDTH,
            height: data.height || MIN_HEIGHT,
        });
        const [isResizing, setIsResizing] = useState(false);
        const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

        if (data.prompt !== prevDataPrompt) {
            setPrevDataPrompt(data.prompt);
            setLocalPrompt(data.prompt);
        }

        const handlePromptChange = (
            e: React.ChangeEvent<HTMLTextAreaElement>,
        ) => {
            setLocalPrompt(e.target.value);
        };

        const handleBlur = () => {
            updateNodeData(id, { prompt: localPrompt });
        };

        const edges = useEdges();
        const nodes = useNodes();

        // Get incoming edges for this node
        const incomingEdges = useMemo(
            () =>
                edges.filter(
                    (e) => e.target === id && e.targetHandle !== "plus",
                ),
            [edges, id],
        );

        // Map incoming edges to their source node names for labels
        const connectedNodes = useMemo(() => {
            return incomingEdges.map((edge) => {
                const sourceNode = nodes.find((n) => n.id === edge.source);
                return {
                    edgeId: edge.id,
                    handleId: edge.targetHandle,
                    sourceName: sourceNode?.data?.name || "Unknown",
                };
            });
        }, [incomingEdges, nodes]);

        // Autocomplete state
        const [showAtMenu, setShowAtMenu] = useState(false);
        const [atMenuPos, setAtMenuPos] = useState({ top: 0, left: 0 });
        const [cursorPos, setCursorPos] = useState(0);
        const textareaRef = useRef<HTMLTextAreaElement>(null);

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
                setDimensions({
                    width: Math.max(
                        MIN_WIDTH,
                        resizeStartRef.current.width + deltaX,
                    ),
                    height: Math.max(
                        MIN_HEIGHT,
                        resizeStartRef.current.height + deltaY,
                    ),
                });
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
        }, [isResizing, id, updateNodeData, dimensions]);

        return (
            <div
                className={`bg-card relative rounded-lg border-2 p-4 shadow-lg transition-all ${selected
                        ? "border-primary shadow-primary/20"
                        : "border-border"
                    } ${data.executing ? "animate-pulse" : ""}`}
                style={{
                    width: dimensions.width,
                    minHeight: dimensions.height,
                }}
            >
                {/* Handles for connected edges */}
                {connectedNodes.map((conn, index) => (
                    <div key={conn.edgeId}>
                        <Handle
                            type="target"
                            position={Position.Left}
                            id={conn.handleId || undefined}
                            style={{ top: 70 + index * 30 }}
                            className="border-background !h-3 !w-3 border-2 !bg-blue-500"
                        />
                        <div
                            className="bg-card absolute left-[-12px] rounded border border-blue-500/30 px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap text-blue-500 shadow-sm transition-colors hover:bg-blue-500/5"
                            style={{
                                top: 64 + index * 30,
                                transform: "translateX(-100%)",
                                marginRight: "8px",
                            }}
                        >
                            {`@${conn.sourceName}`}
                        </div>
                    </div>
                ))}

                {/* The "Plus" handle for new connections */}
                <div className="absolute bottom-8 left-0">
                    <Handle
                        type="target"
                        position={Position.Left}
                        id="plus"
                        className="flex !h-4 !w-4 items-center justify-center border-2 border-dashed border-blue-400 !bg-blue-400/30 after:text-[10px] after:text-blue-500 after:content-['+'] hover:!bg-blue-400 hover:after:text-white"
                        style={{ top: "auto", bottom: 0 }}
                    />
                    <div
                        className="text-muted-foreground absolute left-[-12px] text-[8px] font-medium whitespace-nowrap"
                        style={{ bottom: -4, transform: "translateX(-100%)" }}
                    >
                        Drag to connect
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-emerald-500/10">
                        <Terminal className="h-5 w-5 text-emerald-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center justify-between">
                            <h3 className="text-foreground truncate text-sm font-semibold">
                                {data.name}
                            </h3>
                            <button
                                onClick={() => executeNode(id)}
                                disabled={data.executing}
                                className="text-primary hover:text-primary/80 disabled:opacity-50"
                                title="Execute Prompt"
                            >
                                <PlayCircle className="h-4 w-4" />
                            </button>
                        </div>

                        <Textarea
                            ref={textareaRef}
                            value={localPrompt}
                            onChange={(e) => {
                                handlePromptChange(e);
                                const val = e.target.value;
                                const pos = e.target.selectionStart;
                                const lastAt = val.lastIndexOf("@", pos - 1);
                                if (
                                    lastAt !== -1 &&
                                    !/\s/.test(val.slice(lastAt + 1, pos))
                                ) {
                                    setCursorPos(pos);
                                    // Basic positioning, could be improved with a proper library
                                    setAtMenuPos({ top: 40, left: 0 });
                                    setShowAtMenu(true);
                                } else {
                                    setShowAtMenu(false);
                                }
                            }}
                            onBlur={() => {
                                setTimeout(() => setShowAtMenu(false), 200);
                                handleBlur();
                            }}
                            placeholder="Type @ to reference connected nodes..."
                            className="nodrag bg-muted/20 w-full resize-none overflow-y-auto border-none px-2 py-1 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                            style={{ height: dimensions.height - 100 }}
                        />

                        {/* Autocomplete Menu */}
                        {showAtMenu && connectedNodes.length > 0 && (
                            <div
                                className="bg-popover border-border absolute z-50 mt-1 max-h-32 w-48 overflow-y-auto rounded-md border shadow-md"
                                style={{ top: atMenuPos.top, left: 40 }}
                            >
                                {connectedNodes.map((conn) => (
                                    <button
                                        key={conn.edgeId}
                                        className="hover:bg-accent hover:text-accent-foreground flex w-full items-center px-2 py-1.5 text-left text-xs"
                                        onClick={() => {
                                            const val = localPrompt;
                                            const lastAt = val.lastIndexOf(
                                                "@",
                                                cursorPos - 1,
                                            );
                                            const newVal =
                                                val.slice(0, lastAt + 1) +
                                                conn.sourceName +
                                                val.slice(cursorPos);
                                            setLocalPrompt(newVal);
                                            updateNodeData(id, {
                                                prompt: newVal,
                                            });
                                            setShowAtMenu(false);
                                            textareaRef.current?.focus();
                                        }}
                                    >
                                        <div className="mr-2 h-2 w-2 rounded-full bg-blue-500" />
                                        {`@${conn.sourceName}`}
                                    </button>
                                ))}
                            </div>
                        )}

                        {data.executing && (
                            <div className="mt-2 animate-pulse text-[10px] font-medium text-emerald-500">
                                Formatting content list...
                            </div>
                        )}
                        {data.error && (
                            <div className="text-destructive mt-2 text-[10px] font-medium">
                                Error: {data.error}
                            </div>
                        )}
                    </div>
                </div>

                {data.output && Array.isArray(data.output) && (
                    <div className="border-border/50 mt-3 border-t pt-3">
                        <div className="text-muted-foreground mb-1 text-[10px] font-bold tracking-wider uppercase">
                            Output (JSON):
                        </div>
                        <div
                            className="text-foreground bg-muted/30 overflow-y-auto rounded-md p-2 font-mono text-[10px] leading-relaxed"
                            style={{ maxHeight: 100 }}
                        >
                            {JSON.stringify(data.output, null, 2)}
                        </div>
                    </div>
                )}

                <Handle
                    type="source"
                    position={Position.Right}
                    className="!bg-emerald-500"
                />

                {/* Resize handle */}
                <div
                    className="nodrag absolute right-0 bottom-0 h-4 w-4 cursor-se-resize"
                    onMouseDown={handleResizeStart}
                    style={{ touchAction: "none" }}
                >
                    <div className="border-muted-foreground/30 absolute right-1 bottom-1 h-3 w-3 rounded-br border-r-2 border-b-2" />
                </div>
            </div>
        );
    },
);

PromptNode.displayName = "PromptNode";
