"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface NodeTitleProps {
    name: string;
    onRename: (name: string) => void;
    className?: string;
}

/**
 * Inline-editable node title.
 * - Single click on the text switches to an <input> with autofocus.
 * - Enter or blur commits the change.
 * - Escape reverts to the original name.
 * - Prevents ReactFlow canvas drag while editing.
 */
export function NodeTitle({ name, onRename, className }: NodeTitleProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(name);
    const inputRef = useRef<HTMLInputElement>(null);

    const [prevName, setPrevName] = useState(name);
    if (name !== prevName) {
        setPrevName(name);
        if (!editing) setDraft(name);
    }

    const startEditing = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            setDraft(name);
            setEditing(true);
        },
        [name],
    );

    const commit = useCallback(() => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== name) {
            onRename(trimmed);
        }
        setEditing(false);
    }, [draft, name, onRename]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
                e.preventDefault();
                commit();
            } else if (e.key === "Escape") {
                setDraft(name);
                setEditing(false);
            }
            // Prevent ReactFlow from consuming key events
            e.stopPropagation();
        },
        [commit, name],
    );

    useEffect(() => {
        if (editing) {
            inputRef.current?.select();
        }
    }, [editing]);

    if (editing) {
        return (
            <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className={cn(
                    "nodrag nopan w-full truncate border-none bg-transparent text-sm font-semibold ring-0 outline-none",
                    "border-b border-current",
                    className,
                )}
                autoFocus
            />
        );
    }

    return (
        <span
            title="Click to rename"
            onClick={startEditing}
            className={cn(
                "cursor-text truncate text-sm font-semibold select-none",
                className,
            )}
        >
            {name}
        </span>
    );
}
