"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { type NodeProps } from "@xyflow/react";
import { ImageIcon, Loader2, AlertCircle } from "lucide-react";
import type { CanvasImageData } from "@/lib/canvas-types";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { NodeResizeHandle } from "@/components/nodes/node-resize-handle";
import { useCanvasNodeResize } from "@/hooks/use-canvas-node-resize";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { MediaViewer } from "@/components/nodes/media-viewer";
import { CanvasNodeContextMenu } from "@/components/canvas/canvas-node-context-menu";

export const CanvasImageNode = memo(
    ({ data, selected, id }: NodeProps) => {
        const d = data as unknown as CanvasImageData;
        const updateNodeData = useCanvasStore((s) => s.updateNodeData);
        const [isViewerOpen, setIsViewerOpen] = useState(false);
        const [isRenaming, setIsRenaming] = useState(false);
        const [renameDraft, setRenameDraft] = useState(d.label);
        const renameInputRef = useRef<HTMLInputElement>(null);

        const { dimensions, handleResizeStart } = useCanvasNodeResize(
            id,
            d.width,
            d.height,
            {
                defaultWidth: 300,
                defaultHeight: 300,
                minWidth: 150,
                minHeight: 120,
            },
        );

        const { displayUrl } = useSignedUrl(
            d.status === "ready" ? d.sourceUrl : undefined,
        );

        const isGenerating = d.status === "generating";
        const isError = d.status === "error";

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
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-orange-500/10">
                            <ImageIcon className="h-4 w-4 text-orange-400" />
                        </div>
                        {isRenaming ? (
                            <input
                                ref={renameInputRef}
                                value={renameDraft}
                                onChange={(e) => setRenameDraft(e.target.value)}
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
                            <div className="bg-muted/50 flex h-full items-center justify-center">
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
                                    <span className="text-muted-foreground text-xs">
                                        Generating...
                                    </span>
                                </div>
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
                            <Image
                                src={displayUrl}
                                alt={d.label}
                                width={dimensions.width - 32}
                                height={dimensions.height - 80}
                                className="h-full w-full cursor-pointer object-contain transition-opacity hover:opacity-90"
                                onClick={() => setIsViewerOpen(true)}
                                unoptimized
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

                    {displayUrl && (
                        <MediaViewer
                            isOpen={isViewerOpen}
                            onOpenChange={setIsViewerOpen}
                            url={displayUrl}
                            alt={d.label}
                        />
                    )}
                </div>
            </CanvasNodeContextMenu>
        );
    },
    (prev, next) =>
        prev.id === next.id &&
        prev.selected === next.selected &&
        prev.data === next.data,
);

CanvasImageNode.displayName = "CanvasImageNode";
