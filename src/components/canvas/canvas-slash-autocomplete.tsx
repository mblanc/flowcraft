"use client";

import { memo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface CanvasSlashAutocompleteProps {
    items: string[];
    query: string;
    selectedIndex: number;
    position: { top: number; left: number };
    onSelect: (skillName: string) => void;
    onHover: (index: number) => void;
}

function CanvasSlashAutocompleteComponent({
    items,
    query,
    selectedIndex,
    position,
    onSelect,
    onHover,
}: CanvasSlashAutocompleteProps) {
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const active = listRef.current?.querySelector("[data-active=true]");
        active?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    const filtered = items.filter((name) =>
        name.toLowerCase().includes(query.toLowerCase()),
    );

    if (filtered.length === 0) return null;

    // Adjust position to account for height so it renders above the textarea
    // Height of dropdown is roughly max-h-52 (208px). To avoid overlaying the textarea,
    // we can position it top - height.
    const dropdownHeight = Math.min(filtered.length * 32 + 32, 208);
    const adjustedTop = position.top - dropdownHeight;

    return createPortal(
        <div
            ref={listRef}
            className="bg-popover border-border fixed z-[9999] max-h-52 w-64 overflow-y-auto rounded-lg border shadow-lg"
            style={{ top: adjustedTop, left: position.left }}
            onMouseDown={(e) => e.preventDefault()}
        >
            <div className="text-muted-foreground px-3 py-1.5 text-[10px] font-medium tracking-wider uppercase">
                Active Skills
            </div>
            {filtered.map((name, i) => (
                <button
                    key={name}
                    data-active={i === selectedIndex}
                    className={cn(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                        i === selectedIndex
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/50",
                    )}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        onSelect(name);
                    }}
                    onMouseEnter={() => onHover(i)}
                >
                    <Sparkles className="text-primary size-3.5 shrink-0" />
                    <span className="truncate font-medium">/{name}</span>
                    <span className="text-muted-foreground ml-auto text-[10px]">
                        skill
                    </span>
                </button>
            ))}
        </div>,
        document.body,
    );
}

export const CanvasSlashAutocomplete = memo(CanvasSlashAutocompleteComponent);
