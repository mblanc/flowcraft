"use client";

import { memo, useRef, useState, useEffect, useCallback } from "react";
import { type NodeProps } from "@xyflow/react";
import {
    Music,
    Loader2,
    AlertCircle,
    Clock,
    Download as DownloadIcon,
    Info,
    Trash2,
    X,
    RefreshCw,
    Copy,
    Check,
} from "lucide-react";
import type { CanvasAudioData } from "@/lib/canvas/types";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { useRegenerateNode } from "@/hooks/use-regenerate-node";
import { CanvasNodeContextMenu } from "@/components/canvas/canvas-node-context-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const CanvasNode = memo(
    ({ data, selected, id }: NodeProps) => {
        const d = data as unknown as CanvasAudioData;
        const updateNodeData = useCanvasStore((s) => s.updateNodeData);
        const removeNode = useCanvasStore((s) => s.removeNode);

        const [isInfoOpen, setIsInfoOpen] = useState(false);
        const [isRenaming, setIsRenaming] = useState(false);
        const [isCopied, setIsCopied] = useState(false);
        const [renameDraft, setRenameDraft] = useState(d.label);
        const renameInputRef = useRef<HTMLInputElement>(null);

        const { displayUrl } = useSignedUrl(
            d.status === "ready" ? d.sourceUrl : undefined,
        );

        const isPending = d.status === "pending";
        const isGenerating = d.status === "generating";
        const isError = d.status === "error";

        useEffect(() => {
            if (isRenaming) renameInputRef.current?.select();
        }, [isRenaming]);

        useEffect(() => {
            if (!selected) {
                queueMicrotask(() => {
                    setIsInfoOpen(false);
                    setIsRenaming(false);
                });
            }
        }, [selected]);

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

        const { regenerate } = useRegenerateNode(id);

        const handleDownload = useCallback(() => {
            if (!displayUrl) return;
            const ext = d.mimeType?.split("/")[1] ?? "wav";
            const a = document.createElement("a");
            a.href = displayUrl;
            a.download = `${d.label}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }, [displayUrl, d.label, d.mimeType]);

        return (
            <CanvasNodeContextMenu nodeId={id} onStartRename={startRename}>
                <div
                    className={cn(
                        "relative rounded-[24px] transition-all outline-none",
                        selected
                            ? "ring-primary ring-offset-background ring-2 ring-offset-4"
                            : "",
                    )}
                    style={{ width: 320 }}
                >
                    {/* Top Toolbar Capsule */}
                    {selected && (
                        <div className="bg-background/95 pointer-events-auto absolute -top-[80px] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border px-1.5 py-1.5 shadow-md backdrop-blur-md">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload();
                                }}
                                title="Download"
                                disabled={!displayUrl}
                            >
                                <DownloadIcon className="h-4 w-4" />
                            </Button>
                            {d.prompt && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        regenerate();
                                    }}
                                    title="Regenerate"
                                    disabled={isPending || isGenerating}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-8 w-8 rounded-full",
                                    isInfoOpen ? "bg-muted text-primary" : "",
                                )}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsInfoOpen(!isInfoOpen);
                                }}
                                title="Info"
                            >
                                <Info className="h-4 w-4" />
                            </Button>
                            <div className="bg-border mx-1 h-4 w-[1px]" />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 rounded-full"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeNode(id);
                                }}
                                title="Delete"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    {/* Title Layer */}
                    <div className="pointer-events-auto absolute -top-[28px] left-2 z-20 flex max-w-full items-center gap-1.5">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                            <Music className="text-muted-foreground h-3 w-3" />
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
                                className="nodrag nopan text-foreground bg-background/90 w-[120px] truncate rounded border-none px-1 py-0.5 text-xs font-medium shadow-sm ring-0 outline-none"
                                autoFocus
                            />
                        ) : (
                            <span
                                className="text-secondary-foreground cursor-text truncate px-1 py-0.5 text-xs font-semibold select-none"
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

                    {/* Content Layer */}
                    <div className="border-border/50 bg-muted/20 relative w-full overflow-hidden rounded-[24px] border shadow-sm">
                        {isPending && (
                            <div className="flex h-24 flex-col items-center justify-center gap-2 bg-white/50">
                                <Clock className="text-muted-foreground/50 h-8 w-8" />
                                <span className="text-muted-foreground/50 text-xs font-medium">
                                    Queued
                                </span>
                            </div>
                        )}

                        {isGenerating && (
                            <div className="flex h-24 flex-col items-center justify-center gap-2 bg-white">
                                <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
                                <span className="text-muted-foreground text-xs font-medium">
                                    Generating…
                                </span>
                            </div>
                        )}

                        {isError && (
                            <div className="bg-destructive/5 flex h-24 items-center justify-center">
                                <div className="flex flex-col items-center gap-2 px-4 text-center">
                                    <AlertCircle className="text-destructive h-8 w-8" />
                                    <span className="text-destructive text-xs font-medium">
                                        {d.error || "Generation failed"}
                                    </span>
                                </div>
                            </div>
                        )}

                        {d.status === "ready" && displayUrl && (
                            <div className="p-3">
                                <audio
                                    controls
                                    src={displayUrl}
                                    className="nodrag w-full rounded"
                                    onContextMenu={(e) => e.stopPropagation()}
                                />
                            </div>
                        )}

                        {d.status === "ready" && !displayUrl && (
                            <div className="flex h-24 items-center justify-center">
                                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Info Capsule */}
                    {selected && isInfoOpen && (
                        <div
                            className="bg-background/95 pointer-events-auto absolute top-0 right-0 z-40 flex w-[320px] translate-x-[108%] flex-col gap-4 rounded-2xl border p-5 shadow-xl backdrop-blur-xl"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <span className="truncate text-sm font-semibold">
                                    {d.label}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0 rounded-full"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsInfoOpen(false);
                                    }}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>

                            {d.prompt && (
                                <div className="flex flex-col gap-1.5">
                                    <div className="nowheel text-foreground/90 custom-scrollbar max-h-[160px] overflow-y-auto border-l-[3px] border-teal-500/50 pl-3 text-sm leading-relaxed whitespace-pre-wrap">
                                        {d.prompt}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground hover:text-foreground h-7 gap-1.5 self-end rounded-full px-2.5 text-xs"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(
                                                d.prompt!,
                                            );
                                            setIsCopied(true);
                                            setTimeout(
                                                () => setIsCopied(false),
                                                2000,
                                            );
                                        }}
                                    >
                                        {isCopied ? (
                                            <>
                                                <Check className="h-3 w-3" />{" "}
                                                Copied
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="h-3 w-3" />{" "}
                                                Copy prompt
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="bg-secondary/80 text-secondary-foreground rounded-full border px-2 py-1 font-medium">
                                    Audio
                                </span>
                                {d.model && (
                                    <span className="bg-secondary/50 text-secondary-foreground rounded-full border px-2 py-1">
                                        {d.model}
                                    </span>
                                )}
                            </div>
                        </div>
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

CanvasNode.displayName = "MusicCanvasNode";
