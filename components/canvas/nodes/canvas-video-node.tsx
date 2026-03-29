"use client";

import { memo, useRef, useState, useEffect, useCallback } from "react";
import { type NodeProps } from "@xyflow/react";
import { Video, Loader2, AlertCircle } from "lucide-react";
import type { CanvasVideoData } from "@/lib/canvas-types";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { NodeResizeHandle } from "@/components/nodes/node-resize-handle";
import { useCanvasNodeResize } from "@/hooks/use-canvas-node-resize";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { CanvasNodeContextMenu } from "@/components/canvas/canvas-node-context-menu";

export const CanvasVideoNode = memo(
    ({ data, selected, id }: NodeProps) => {
        const d = data as unknown as CanvasVideoData;
        const updateNodeData = useCanvasStore((s) => s.updateNodeData);
        const videoRef = useRef<HTMLVideoElement>(null);
        const [isRenaming, setIsRenaming] = useState(false);
        const [renameDraft, setRenameDraft] = useState(d.label);
        const renameInputRef = useRef<HTMLInputElement>(null);

        const { dimensions, handleResizeStart } = useCanvasNodeResize(
            id,
            undefined,
            undefined,
            {
                defaultWidth: 360,
                defaultHeight: 280,
                minWidth: 200,
                minHeight: 160,
            },
        );

        const { displayUrl } = useSignedUrl(
            d.status === "ready" ? d.sourceUrl : undefined,
        );

        const isGenerating = d.status === "generating";
        const isError = d.status === "error";
        const progress = d.progress ?? 0;

        useEffect(() => {
            if (isRenaming) renameInputRef.current?.select();
        }, [isRenaming]);

        const commitRename = useCallback(() => {
            const trimmed = renameDraft.trim();
            if (trimmed && trimmed !== d.label) {
                updateNodeData(id, { label: trimmed });
            }
            setIsRenaming(false);
        }, [renameDraft, d.label, id, updateNodeData]);

        const startRename = useCallback(() => {
            setRenameDraft(d.label);
            setIsRenaming(true);
        }, [d.label]);

        return (
            <CanvasNodeContextMenu nodeId={id} onStartRename={startRename}>
                <div
                    className={`node-container ${selected ? "selected" : ""}`}
                    style={{ width: dimensions.width }}
                >
                    <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-purple-500/10">
                            <Video className="h-4 w-4 text-purple-400" />
                        </div>
                        {isRenaming ? (
                            <input
                                ref={renameInputRef}
                                value={renameDraft}
                                onChange={(e) =>
                                    setRenameDraft(e.target.value)
                                }
                                onBlur={commitRename}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") commitRename();
                                    if (e.key === "Escape") {
                                        setRenameDraft(d.label);
                                        setIsRenaming(false);
                                    }
                                    e.stopPropagation();
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="nodrag nopan text-foreground w-full truncate border-none bg-transparent text-sm font-semibold ring-0 outline-none"
                                autoFocus
                            />
                        ) : (
                            <span
                                className="text-foreground cursor-text truncate text-sm font-semibold select-none"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    startRename();
                                }}
                                title="Click to rename"
                            >
                                {d.label}
                            </span>
                        )}
                    </div>

                    <div
                        className="border-border relative overflow-hidden rounded-md border"
                        style={{ height: dimensions.height - 80 }}
                    >
                        {isGenerating && (
                            <div className="bg-muted/50 flex h-full flex-col items-center justify-center gap-2">
                                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                                <span className="text-muted-foreground text-xs">
                                    Generating...
                                </span>
                                {progress > 0 && (
                                    <div className="w-3/4">
                                        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                                            <div
                                                className="h-full rounded-full bg-purple-500 transition-all"
                                                style={{
                                                    width: `${progress}%`,
                                                }}
                                            />
                                        </div>
                                        <span className="text-muted-foreground mt-1 block text-center text-[10px]">
                                            {progress}%
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {isError && (
                            <div className="bg-destructive/5 flex h-full items-center justify-center">
                                <div className="flex flex-col items-center gap-2 px-4 text-center">
                                    <AlertCircle className="text-destructive h-8 w-8" />
                                    <span className="text-destructive text-xs">
                                        {d.error || "Generation failed"}
                                    </span>
                                </div>
                            </div>
                        )}

                        {d.status === "ready" && displayUrl && (
                            <video
                                ref={videoRef}
                                src={displayUrl}
                                className="nodrag h-full w-full object-contain"
                                controls
                                preload="metadata"
                                onContextMenu={(e) => e.stopPropagation()}
                            />
                        )}

                        {d.status === "ready" && !displayUrl && (
                            <div className="bg-muted/30 flex h-full items-center justify-center">
                                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                            </div>
                        )}
                    </div>

                    {d.prompt && (
                        <p className="text-muted-foreground mt-2 line-clamp-2 text-[10px]">
                            {d.prompt}
                        </p>
                    )}

                    <NodeResizeHandle onResizeStart={handleResizeStart} />
                </div>
            </CanvasNodeContextMenu>
        );
    },
    (prev, next) =>
        prev.id === next.id &&
        prev.selected === next.selected &&
        prev.data === next.data,
);

CanvasVideoNode.displayName = "CanvasVideoNode";
