"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { type NodeProps } from "@xyflow/react";
import {
    ImageIcon,
    Loader2,
    AlertCircle,
    Clock,
    Maximize2,
    Download as DownloadIcon,
    Info,
    Trash2,
    X,
    RefreshCw,
    Copy,
    Check,
    ShieldCheck,
    ShieldAlert,
    ShieldX,
} from "lucide-react";
import type { CanvasImageData, ValidationResult } from "@/lib/canvas/types";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { NodeResizeHandle } from "@/components/nodes/node-resize-handle";
import { useMediaNodeResize } from "@/hooks/use-media-node-resize";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { useRegenerateNode } from "@/hooks/use-regenerate-node";
import { MediaViewer } from "@/components/nodes/media-viewer";
import { CanvasNodeContextMenu } from "@/components/canvas/canvas-node-context-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ReferenceImageThumbnail({ nodeId }: { nodeId: string }) {
    const node = useCanvasStore((s) => s.nodes.find((n) => n.id === nodeId));
    const url =
        node && "sourceUrl" in node.data
            ? (node.data.sourceUrl as string)
            : undefined;
    const { displayUrl } = useSignedUrl(url);

    if (!displayUrl)
        return (
            <div className="bg-muted flex h-12 w-12 shrink-0 items-center justify-center rounded-md border">
                <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            </div>
        );

    return (
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border">
            <Image
                src={displayUrl}
                alt="reference"
                fill
                className="object-cover"
                unoptimized
            />
        </div>
    );
}

const VALIDATION_STATUS = {
    "hard-fail": {
        Icon: ShieldX,
        colorClass:
            "text-red-500 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
    },
    "soft-fail": {
        Icon: ShieldAlert,
        colorClass:
            "text-yellow-500 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800",
    },
    pass: {
        Icon: ShieldCheck,
        colorClass:
            "text-green-500 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
    },
} as const;

function ValidationBadge({ results }: { results: ValidationResult[] }) {
    const [showPopover, setShowPopover] = useState(false);

    const statusKey = results.some(
        (r) => r.status === "fail" && r.severity === "hard",
    )
        ? "hard-fail"
        : results.some((r) => r.status === "fail" && r.severity === "soft")
          ? "soft-fail"
          : "pass";
    const { Icon, colorClass } = VALIDATION_STATUS[statusKey];

    return (
        <div className="pointer-events-auto absolute right-2 bottom-2 z-20">
            <button
                type="button"
                className={cn(
                    "flex items-center justify-center rounded-full border p-1 shadow-sm transition-transform hover:scale-110",
                    colorClass,
                )}
                onClick={(e) => {
                    e.stopPropagation();
                    setShowPopover((v) => !v);
                }}
                title="Validation results"
            >
                <Icon className="h-3.5 w-3.5" />
            </button>

            {showPopover && (
                <div
                    className="bg-background/95 absolute right-0 bottom-8 z-50 w-64 rounded-xl border p-3 shadow-xl backdrop-blur-md"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold">
                            Validation
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowPopover(false)}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                    <div className="space-y-1.5">
                        {results.map((r) => (
                            <div
                                key={r.ruleId}
                                className="rounded-md border px-2 py-1.5"
                            >
                                <div className="flex items-center gap-1.5">
                                    {r.status === "pass" ? (
                                        <Check className="h-3 w-3 text-green-500" />
                                    ) : (
                                        <AlertCircle
                                            className={cn(
                                                "h-3 w-3",
                                                r.severity === "hard"
                                                    ? "text-red-500"
                                                    : "text-yellow-500",
                                            )}
                                        />
                                    )}
                                    <span className="truncate text-[11px] font-medium">
                                        {r.ruleDescription}
                                    </span>
                                </div>
                                <p className="text-muted-foreground mt-0.5 text-[10px] leading-relaxed">
                                    {r.reason}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export const CanvasNode = memo(
    ({ data, selected, id }: NodeProps) => {
        const d = data as unknown as CanvasImageData;
        const updateNodeData = useCanvasStore((s) => s.updateNodeData);
        const updateNode = useCanvasStore((s) => s.updateNode);
        const removeNode = useCanvasStore((s) => s.removeNode);
        const [isViewerOpen, setIsViewerOpen] = useState(false);
        const [isInfoOpen, setIsInfoOpen] = useState(false);
        const [isRenaming, setIsRenaming] = useState(false);
        const [isCopied, setIsCopied] = useState(false);
        const [renameDraft, setRenameDraft] = useState(d.label);
        const renameInputRef = useRef<HTMLInputElement>(null);

        const { dimensions, handleResizeStart } = useMediaNodeResize(
            id,
            d.width,
            d.height,
            {
                defaultWidth: 300,
                defaultHeight: 300,
                minWidth: 150,
                minHeight: 120,
                lockAspectRatio: true,
            },
            updateNode,
        );

        const handleImageLoad = useCallback(
            (e: React.SyntheticEvent<HTMLImageElement>) => {
                const { naturalWidth, naturalHeight } = e.currentTarget;
                if (naturalWidth && naturalHeight) {
                    const inherentRatio = naturalWidth / naturalHeight;
                    const currentRatio = d.width / d.height;
                    if (Math.abs(inherentRatio - currentRatio) > 0.05) {
                        const newHeight = Math.round(d.width / inherentRatio);
                        updateNodeData(id, { height: newHeight });
                    }
                }
            },
            [d.width, d.height, id, updateNodeData],
        );

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
            const a = document.createElement("a");
            a.href = displayUrl;
            a.download = `${d.label}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }, [displayUrl, d.label]);

        return (
            <CanvasNodeContextMenu nodeId={id} onStartRename={startRename}>
                <div
                    className={cn(
                        "relative rounded-[24px] transition-all outline-none",
                        selected
                            ? "ring-primary ring-offset-background ring-2 ring-offset-4"
                            : "",
                    )}
                    style={{
                        width: dimensions.width,
                        height: dimensions.height,
                    }}
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
                                    setIsViewerOpen(true);
                                }}
                                title="Full Size"
                            >
                                <Maximize2 className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload();
                                }}
                                title="Download"
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
                            <div className="bg-border mx-1 h-4 w-[1px]"></div>
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
                            <ImageIcon className="text-muted-foreground h-3 w-3" />
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

                    {/* Image Layer */}
                    <div className="border-border/50 bg-muted/20 relative h-full w-full overflow-hidden rounded-[24px] border shadow-sm">
                        {isPending && (
                            <div className="flex h-full items-center justify-center bg-white/50">
                                <div className="flex flex-col items-center gap-2">
                                    <Clock className="text-muted-foreground/50 h-8 w-8" />
                                    <span className="text-muted-foreground/50 text-xs font-medium">
                                        Queued
                                    </span>
                                </div>
                            </div>
                        )}

                        {isGenerating && (
                            <div className="flex h-full items-center justify-center bg-white">
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
                                    <span className="text-muted-foreground text-xs font-medium">
                                        Generating...
                                    </span>
                                </div>
                            </div>
                        )}

                        {isError && (
                            <div className="bg-destructive/5 flex h-full items-center justify-center">
                                <div className="flex flex-col items-center gap-2 px-4 text-center">
                                    <AlertCircle className="text-destructive h-8 w-8" />
                                    <span className="text-destructive text-xs font-medium">
                                        {d.error || "Generation failed"}
                                    </span>
                                </div>
                            </div>
                        )}

                        {d.status === "ready" && displayUrl && (
                            <Image
                                src={displayUrl}
                                alt={d.label}
                                fill
                                className="h-full w-full object-contain"
                                unoptimized
                                onContextMenu={(e) => e.stopPropagation()}
                                draggable={false}
                                onLoad={handleImageLoad}
                            />
                        )}

                        {d.status === "ready" && !displayUrl && (
                            <div className="bg-muted/30 flex h-full items-center justify-center">
                                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Validation Badge */}
                    {d.validationResults && d.validationResults.length > 0 && (
                        <ValidationBadge results={d.validationResults} />
                    )}

                    {/* Info Capsule Layer */}
                    {selected && isInfoOpen && (
                        <div
                            className="bg-background/95 pointer-events-auto absolute top-0 right-0 z-40 flex w-[320px] translate-x-[108%] flex-col gap-4 rounded-2xl border p-5 shadow-xl backdrop-blur-xl"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex min-w-0 flex-col">
                                    <span className="truncate text-sm font-semibold">
                                        {d.label}
                                    </span>
                                </div>
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
                                    <div className="nowheel text-foreground/90 custom-scrollbar max-h-[160px] overflow-y-auto border-l-[3px] border-orange-500/50 pl-3 text-sm leading-relaxed whitespace-pre-wrap">
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
                                    Image
                                </span>
                                {d.model && (
                                    <span className="bg-secondary/50 text-secondary-foreground rounded-full border px-2 py-1">
                                        {d.model}
                                    </span>
                                )}
                                {d.aspectRatio && (
                                    <span className="bg-secondary/50 text-secondary-foreground rounded-full border px-2 py-1">
                                        {d.aspectRatio}
                                    </span>
                                )}
                                <span className="bg-secondary/50 text-secondary-foreground rounded-full border px-2 py-1">
                                    {Math.round(d.width)}&times;
                                    {Math.round(d.height)}
                                </span>
                            </div>
                            {d.styleName && (
                                <div className="flex flex-col gap-1.5 border-t pt-4">
                                    <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                                        Style
                                    </span>
                                    <span className="text-foreground text-xs font-medium">
                                        {d.styleName}
                                    </span>
                                </div>
                            )}

                            {d.referenceNodeIds &&
                                d.referenceNodeIds.length > 0 && (
                                    <div className="mt-2 flex flex-col gap-2.5 border-t pt-4">
                                        <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                                            Input
                                        </span>
                                        <div className="flex flex-wrap gap-2">
                                            {d.referenceNodeIds.map((refId) => (
                                                <ReferenceImageThumbnail
                                                    key={refId}
                                                    nodeId={refId}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                        </div>
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

CanvasNode.displayName = "CanvasNode";
