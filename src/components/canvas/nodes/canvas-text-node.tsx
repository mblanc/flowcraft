"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { type NodeProps } from "@xyflow/react";
import { Type, Info, Trash2, X, Maximize2, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CanvasTextData } from "@/lib/canvas/types";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { NodeResizeHandle } from "@/components/nodes/node-resize-handle";
import { useMediaNodeResize } from "@/hooks/use-media-node-resize";
import { CanvasNodeContextMenu } from "@/components/canvas/canvas-node-context-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { NodeTitle } from "@/components/nodes/node-title";

const CanvasTextEditor = dynamic(
    () =>
        import("./canvas-text-editor").then((m) => ({
            default: m.CanvasTextEditor,
        })),
    { ssr: false },
);

export const CanvasTextNode = memo(
    ({ data, selected, id }: NodeProps) => {
        const d = data as unknown as CanvasTextData;
        const updateNodeData = useCanvasStore((s) => s.updateNodeData);
        const updateNode = useCanvasStore((s) => s.updateNode);
        const removeNode = useCanvasStore((s) => s.removeNode);

        const [isEditing, setIsEditing] = useState(false);
        const [draft, setDraft] = useState(d.content);

        const [isModalOpen, setIsModalOpen] = useState(false);
        const [isInfoOpen, setIsInfoOpen] = useState(false);
        const [isRenaming, setIsRenaming] = useState(false);
        const [renameDraft, setRenameDraft] = useState(d.label);
        const renameInputRef = useRef<HTMLInputElement>(null);

        const { dimensions, handleResizeStart } = useMediaNodeResize(
            id,
            d.width,
            d.height,
            {
                defaultWidth: 250,
                defaultHeight: 180,
                minWidth: 120,
                minHeight: 80,
            },
            updateNode,
        );

        const [prevContent, setPrevContent] = useState(d.content);
        if (d.content !== prevContent) {
            setPrevContent(d.content);
            if (!isEditing) setDraft(d.content);
        }

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

        const handleDownload = useCallback(() => {
            if (!d.content) return;
            const blob = new Blob([d.content], { type: "text/plain" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${d.label || "text"}.txt`;
            a.click();
            setTimeout(() => {
                URL.revokeObjectURL(a.href);
            }, 100);
        }, [d.content, d.label]);

        const commitContent = useCallback(() => {
            if (draft !== d.content) {
                updateNodeData(id, { content: draft });
            }
            setIsEditing(false);
        }, [draft, d.content, id, updateNodeData]);

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
                                    setIsModalOpen(true);
                                }}
                                title="Expand"
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
                                <Download className="h-4 w-4" />
                            </Button>
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
                            <Type className="text-muted-foreground h-3 w-3" />
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

                    <div className="bg-card border-border/50 relative h-full w-full overflow-hidden rounded-[24px] border shadow-sm">
                        {isEditing ? (
                            <div
                                className="nodrag nopan nowheel canvas-text-editor-wrapper h-full w-full overflow-auto"
                                onBlur={(e) => {
                                    if (
                                        !e.currentTarget.contains(
                                            e.relatedTarget as Node,
                                        )
                                    ) {
                                        commitContent();
                                    }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                    if (e.key === "Escape") {
                                        setDraft(d.content);
                                        setIsEditing(false);
                                    }
                                    e.stopPropagation();
                                }}
                            >
                                <CanvasTextEditor
                                    markdown={draft}
                                    onChange={setDraft}
                                />
                            </div>
                        ) : (
                            <div
                                className="canvas-text-editor-wrapper text-foreground h-full cursor-text overflow-auto p-5 text-sm"
                                onDoubleClick={() => setIsEditing(true)}
                            >
                                {d.content ? (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {d.content}
                                    </ReactMarkdown>
                                ) : (
                                    <span className="text-muted-foreground italic">
                                        Double-click to edit...
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

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

                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="bg-secondary/80 text-secondary-foreground rounded-full border px-2 py-1 font-medium">
                                    Text
                                </span>
                                {d.format && (
                                    <span className="bg-secondary/80 text-secondary-foreground rounded-full border px-2 py-1 font-medium capitalize">
                                        {d.format}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    <Dialog
                        open={isModalOpen}
                        onOpenChange={(open) => {
                            setIsModalOpen(open);
                            if (!open) {
                                if (draft !== d.content) {
                                    updateNodeData(id, { content: draft });
                                }
                            }
                        }}
                    >
                        <DialogContent className="flex h-[90vh] max-w-[90vw] flex-col overflow-hidden p-0">
                            <DialogHeader className="border-b p-4">
                                <DialogTitle className="flex items-center gap-2">
                                    <Type className="text-muted-foreground h-5 w-5" />
                                    <NodeTitle
                                        name={d.label}
                                        onRename={(n) =>
                                            updateNodeData(id, { label: n })
                                        }
                                    />
                                </DialogTitle>
                            </DialogHeader>
                            <div
                                className="nodrag nopan nowheel canvas-text-editor-wrapper flex-1 overflow-auto p-6"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                    e.stopPropagation();
                                }}
                            >
                                <CanvasTextEditor
                                    markdown={draft}
                                    onChange={setDraft}
                                />
                            </div>
                        </DialogContent>
                    </Dialog>

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

CanvasTextNode.displayName = "CanvasTextNode";
