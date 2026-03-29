"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { type NodeProps } from "@xyflow/react";
import { Type } from "lucide-react";
import type { CanvasTextData } from "@/lib/canvas-types";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { NodeResizeHandle } from "@/components/nodes/node-resize-handle";
import { useCanvasNodeResize } from "@/hooks/use-canvas-node-resize";
import { CanvasNodeContextMenu } from "@/components/canvas/canvas-node-context-menu";

export const CanvasTextNode = memo(
    ({ data, selected, id }: NodeProps) => {
        const d = data as unknown as CanvasTextData;
        const updateNodeData = useCanvasStore((s) => s.updateNodeData);

        const [isEditing, setIsEditing] = useState(false);
        const [draft, setDraft] = useState(d.content);
        const textareaRef = useRef<HTMLTextAreaElement>(null);

        const [isRenaming, setIsRenaming] = useState(false);
        const [renameDraft, setRenameDraft] = useState(d.label);
        const renameInputRef = useRef<HTMLInputElement>(null);

        const { dimensions, handleResizeStart } = useCanvasNodeResize(
            id,
            d.width,
            d.height,
            {
                defaultWidth: 250,
                defaultHeight: 180,
                minWidth: 120,
                minHeight: 80,
            },
        );

        const [prevContent, setPrevContent] = useState(d.content);
        if (d.content !== prevContent) {
            setPrevContent(d.content);
            if (!isEditing) setDraft(d.content);
        }

        useEffect(() => {
            if (isEditing && textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.selectionStart =
                    textareaRef.current.value.length;
            }
        }, [isEditing]);

        useEffect(() => {
            if (isRenaming) renameInputRef.current?.select();
        }, [isRenaming]);

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
                    className={`node-container ${selected ? "selected" : ""}`}
                    style={{ width: dimensions.width }}
                >
                    <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                            <Type className="h-4 w-4 text-blue-400" />
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
                        className="border-border overflow-hidden rounded-md border"
                        style={{ height: dimensions.height - 80 }}
                    >
                        {isEditing ? (
                            <textarea
                                ref={textareaRef}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onBlur={commitContent}
                                onKeyDown={(e) => {
                                    if (e.key === "Escape") {
                                        setDraft(d.content);
                                        setIsEditing(false);
                                    }
                                    e.stopPropagation();
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="nodrag nopan nowheel text-foreground h-full w-full resize-none bg-transparent p-3 text-sm outline-none"
                                style={{
                                    fontSize: d.fontSize
                                        ? `${d.fontSize}px`
                                        : undefined,
                                }}
                            />
                        ) : (
                            <div
                                className="text-foreground h-full cursor-text overflow-auto p-3 text-sm whitespace-pre-wrap"
                                style={{
                                    fontSize: d.fontSize
                                        ? `${d.fontSize}px`
                                        : undefined,
                                }}
                                onDoubleClick={() => setIsEditing(true)}
                            >
                                {d.content || (
                                    <span className="text-muted-foreground italic">
                                        Double-click to edit...
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

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
