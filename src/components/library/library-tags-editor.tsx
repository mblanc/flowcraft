"use client";

import { useState, useRef, useCallback } from "react";
import { X, Plus } from "lucide-react";

interface LibraryTagsEditorProps {
    assetId: string;
    initialTags: string[];
    onTagsChange?: (tags: string[]) => void;
}

export function LibraryTagsEditor({
    assetId,
    initialTags,
    onTagsChange,
}: LibraryTagsEditorProps) {
    const [tags, setTags] = useState<string[]>(initialTags);
    const [inputValue, setInputValue] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const saveTags = useCallback(
        async (newTags: string[]) => {
            setIsSaving(true);
            try {
                await fetch(`/api/library/${assetId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tags: newTags }),
                });
                onTagsChange?.(newTags);
            } finally {
                setIsSaving(false);
            }
        },
        [assetId, onTagsChange],
    );

    const addTag = useCallback(
        (value: string) => {
            const tag = value.trim().toLowerCase();
            if (!tag || tags.includes(tag)) {
                setInputValue("");
                return;
            }
            const newTags = [...tags, tag];
            setTags(newTags);
            setInputValue("");
            saveTags(newTags);
        },
        [tags, saveTags],
    );

    const removeTag = useCallback(
        (tag: string) => {
            const newTags = tags.filter((t) => t !== tag);
            setTags(newTags);
            saveTags(newTags);
        },
        [tags, saveTags],
    );

    return (
        <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Tags{" "}
                {isSaving && <span className="normal-case">(saving…)</span>}
            </p>
            <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                    <span
                        key={tag}
                        className="border-border bg-muted text-foreground flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs"
                    >
                        {tag}
                        <button
                            onClick={() => removeTag(tag)}
                            className="text-muted-foreground hover:text-foreground ml-0.5"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                <div className="flex items-center gap-1">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                                e.preventDefault();
                                addTag(inputValue);
                            }
                        }}
                        placeholder="Add tag…"
                        className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-24 rounded-full border px-2.5 py-0.5 text-xs focus:ring-1 focus:outline-none"
                    />
                    <button
                        onClick={() => addTag(inputValue)}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
