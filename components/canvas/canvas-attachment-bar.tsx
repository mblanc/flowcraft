"use client";

import { memo } from "react";
import { X, Image, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatAttachment } from "@/lib/canvas-types";

const TYPE_ICON = {
    "canvas-image": Image,
    "canvas-video": Video,
} as const;

interface CanvasAttachmentBarProps {
    attachments: ChatAttachment[];
    onRemove: (nodeId: string) => void;
    className?: string;
}

function CanvasAttachmentBarComponent({
    attachments,
    onRemove,
    className,
}: CanvasAttachmentBarProps) {
    if (attachments.length === 0) return null;

    return (
        <div className={cn("flex flex-wrap gap-1.5 px-3 pt-3 pb-1", className)}>
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
