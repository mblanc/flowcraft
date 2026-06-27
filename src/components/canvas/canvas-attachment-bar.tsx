"use client";

import { memo } from "react";
import { X, Image, Video, Text, Music } from "lucide-react";
import { StyleThumbnail } from "./style-thumbnail";
import { cn } from "@/lib/utils";
import type { ChatAttachment } from "@/lib/canvas/types";

const TYPE_ICON = {
    "canvas-image": Image,
    "canvas-video": Video,
    "canvas-text": Text,
    "canvas-audio": Music,
} as const;

interface CanvasAttachmentBarProps {
    attachments: ChatAttachment[];
    onRemove: (nodeId: string) => void;
    activeStyle?: { id: string; name: string; imageUrl?: string | null } | null;
    onClearStyle?: () => void;
    className?: string;
}

function CanvasAttachmentBarComponent({
    attachments,
    onRemove,
    activeStyle,
    onClearStyle,
    className,
}: CanvasAttachmentBarProps) {
    if (attachments.length === 0 && !activeStyle) return null;

    return (
        <div className={cn("flex flex-wrap gap-1.5 px-3 pt-3 pb-1", className)}>
            {activeStyle && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 py-0.5 pr-1 pl-1.5 text-xs text-violet-600 dark:text-violet-400">
                    <StyleThumbnail
                        imageUrl={activeStyle.imageUrl}
                        className="border-violet-500/20"
                    />
                    <span className="ml-0.5 max-w-[120px] truncate">
                        {activeStyle.name}
                    </span>
                    {onClearStyle && (
                        <button
                            type="button"
                            onClick={onClearStyle}
                            aria-label="Remove style"
                            className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-violet-500/20"
                        >
                            <X className="size-3" />
                        </button>
                    )}
                </span>
            )}
            {attachments.map((att) => {
                const Icon = TYPE_ICON[att.type];
                return (
                    <span
                        key={att.nodeId}
                        className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-xs"
                    >
                        <Icon className="size-3 shrink-0" />
                        <span className="max-w-[100px] truncate">
                            {att.label}
                        </span>
                        <button
                            type="button"
                            onClick={() => onRemove(att.nodeId)}
                            className="hover:bg-primary/20 ml-0.5 rounded-full p-0.5 transition-colors"
                        >
                            <X className="size-3" />
                        </button>
                    </span>
                );
            })}
        </div>
    );
}

export const CanvasAttachmentBar = memo(CanvasAttachmentBarComponent);
