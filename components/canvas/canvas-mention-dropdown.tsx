"use client";

import { memo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Image, Video, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CanvasNode } from "@/lib/canvas-types";

const NODE_TYPE_ICON = {
    "canvas-image": Image,
    "canvas-video": Video,
    "canvas-text": Type,
} as const;

export interface MentionItem {
    id: string;
    label: string;
    type: CanvasNode["type"];
}

interface CanvasMentionDropdownProps {
    items: MentionItem[];
    query: string;
    selectedIndex: number;
    position: { top: number; left: number };
    onSelect: (item: MentionItem) => void;
    onHover: (index: number) => void;
}

function CanvasMentionDropdownComponent({
    items,
    query,
    selectedIndex,
    position,
    onSelect,
    onHover,
}: CanvasMentionDropdownProps) {
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const active = listRef.current?.querySelector("[data-active=true]");
        active?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    const filtered = items.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()),
    );

    if (filtered.length === 0) return null;

    return createPortal(
        <div
            ref={listRef}
            className="bg-popover border-border fixed z-[9999] max-h-52 w-56 overflow-y-auto rounded-lg border shadow-lg"
            style={{ top: position.top, left: position.left }}
            onMouseDown={(e) => e.preventDefault()}
        >
            <div className="text-muted-foreground px-3 py-1.5 text-[10px] font-medium tracking-wider uppercase">
                Canvas items
            </div>
            {filtered.map((item, i) => {
                const Icon = NODE_TYPE_ICON[item.type];
                return (
                    <button
                        key={item.id}
                        data-active={i === selectedIndex}
                        className={cn(
                            "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                            i === selectedIndex
                                ? "bg-accent text-accent-foreground"
                                : "hover:bg-accent/50",
                        )}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            onSelect(item);
                        }}
                        onMouseEnter={() => onHover(i)}
                    >
                        <Icon className="text-muted-foreground size-3.5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                        <span className="text-muted-foreground ml-auto text-[10px]">
                            {item.type.replace("canvas-", "")}
                        </span>
                    </button>
                );
            })}
        </div>,
        document.body,
    );
}

export const CanvasMentionDropdown = memo(CanvasMentionDropdownComponent);
