"use client";

import React, {
    useRef,
    useEffect,
    useCallback,
    useState,
    KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { NODE_MENTION_REGEX } from "@/lib/mention-utils";

export interface MentionNode {
    id: string;
    name: string;
}

interface MentionEditorProps {
    value: string | undefined;
    onChange: (value: string) => void;
    onBlur?: () => void;
    availableNodes: MentionNode[];
    placeholder?: string;
    className?: string;
}

const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Converts stored `@[nodeId]` string → display HTML with mention chips. */
function valueToHtml(value: string | undefined, nodes: MentionNode[]): string {
    if (!value) return "";
    const nodeMap = new Map(nodes.map((n) => [n.id, n.name]));
    let result = "";
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    NODE_MENTION_REGEX.lastIndex = 0;
    while ((match = NODE_MENTION_REGEX.exec(value)) !== null) {
        const before = value.slice(lastIndex, match.index);
        result += escapeHtml(before).replace(/\n/g, "<br>");

        const nodeId = match[1];
        const name = nodeMap.get(nodeId) ?? nodeId;
        result += `<span class="mention-chip" data-node-id="${nodeId}" contenteditable="false">@${escapeHtml(name)}</span>`;
        lastIndex = match.index + match[0].length;
    }

    result += escapeHtml(value.slice(lastIndex)).replace(/\n/g, "<br>");
    return result;
}

/** Serializes HTML contenteditable content back to the `@[nodeId]` string format. */
function htmlToValue(el: HTMLElement): string {
    let result = "";
    for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
            result += child.textContent ?? "";
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            const htmlEl = child as HTMLElement;
            const nodeId = htmlEl.dataset.nodeId;
            if (nodeId) {
                result += `@[${nodeId}]`;
            } else if (htmlEl.tagName === "BR") {
                result += "\n";
            } else if (
                htmlEl.tagName === "DIV" ||
                htmlEl.tagName === "P" ||
                htmlEl.tagName === "SPAN"
            ) {
                result += htmlToValue(htmlEl);
            }
        }
    }
    return result;
}

export function MentionEditor({
    value,
    onChange,
    onBlur,
    availableNodes,
    placeholder,
    className,
}: MentionEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const lastValueRef = useRef(value);
    const isInitializedRef = useRef(false);
    const isComposingRef = useRef(false);

    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    // Viewport-fixed coordinates used by the portal dropdown
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
    const [selectedIndex, setSelectedIndex] = useState(0);
    const triggerRangeRef = useRef<{
        node: Node;
        offset: number;
    } | null>(null);

    // Initial render — set innerHTML once
    useEffect(() => {
        const el = editorRef.current;
        if (!el || isInitializedRef.current) return;
        isInitializedRef.current = true;
        el.innerHTML = valueToHtml(value, availableNodes);
        lastValueRef.current = value;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync external value changes (e.g. undo, store reset) without disturbing focus
    useEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        if (value === lastValueRef.current) return;
        lastValueRef.current = value;
        el.innerHTML = valueToHtml(value, availableNodes);
    }, [value, availableNodes]);

    const filteredNodes = availableNodes.filter((n) =>
        mentionQuery === null
            ? false
            : n.name.toLowerCase().includes(mentionQuery.toLowerCase()),
    );

    useEffect(() => {
        setSelectedIndex(0);
    }, [mentionQuery]);

    const closeMention = useCallback(() => {
        setMentionQuery(null);
        triggerRangeRef.current = null;
    }, []);

    const insertMention = useCallback(
        (node: MentionNode) => {
            const el = editorRef.current;
            if (!el) return;

            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;

            // Delete the `@query` text typed so far
            if (triggerRangeRef.current) {
                const { node: triggerNode, offset: triggerOffset } =
                    triggerRangeRef.current;
                const curRange = sel.getRangeAt(0);
                const deleteRange = document.createRange();
                deleteRange.setStart(triggerNode, triggerOffset);
                deleteRange.setEnd(
                    curRange.startContainer,
                    curRange.startOffset,
                );
                deleteRange.deleteContents();
            }

            // Build and insert the mention chip
            const span = document.createElement("span");
            span.className = "mention-chip";
            span.dataset.nodeId = node.id;
            span.contentEditable = "false";
            span.textContent = `@${node.name}`;

            // Insert a trailing non-breaking space for cursor placement
            const spacer = document.createTextNode("\u00A0");
            const insertRange = sel.getRangeAt(0);
            insertRange.collapse(true);
            insertRange.insertNode(spacer);
            insertRange.insertNode(span);

            // Move cursor after the spacer
            const newRange = document.createRange();
            newRange.setStartAfter(spacer);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);

            const newValue = htmlToValue(el);
            lastValueRef.current = newValue;
            onChange(newValue);
            closeMention();
        },
        [onChange, closeMention],
    );

    const handleInput = useCallback(() => {
        const el = editorRef.current;
        if (!el || isComposingRef.current) return;

        const newValue = htmlToValue(el);
        lastValueRef.current = newValue;
        onChange(newValue);

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) {
            closeMention();
            return;
        }

        const range = sel.getRangeAt(0);
        const { startContainer, startOffset } = range;

        if (startContainer.nodeType !== Node.TEXT_NODE) {
            closeMention();
            return;
        }

        const textBefore = (startContainer.textContent ?? "").slice(
            0,
            startOffset,
        );
        const atIdx = textBefore.lastIndexOf("@");
        if (atIdx === -1) {
            closeMention();
            return;
        }

        const query = textBefore.slice(atIdx + 1);
        if (query.includes(" ") || query.includes("\n")) {
            closeMention();
            return;
        }

        triggerRangeRef.current = { node: startContainer, offset: atIdx };
        setMentionQuery(query);

        // Viewport coordinates for the portal (unaffected by overflow clipping)
        const rect = range.getBoundingClientRect();
        setDropdownPos({
            top: rect.bottom + 4,
            left: Math.max(0, rect.left),
        });
    }, [onChange, closeMention]);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLDivElement>) => {
            if (mentionQuery === null) return;
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((i) =>
                    Math.min(i + 1, filteredNodes.length - 1),
                );
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" || e.key === "Tab") {
                if (filteredNodes.length > 0) {
                    e.preventDefault();
                    insertMention(filteredNodes[selectedIndex]);
                }
            } else if (e.key === "Escape") {
                closeMention();
            }
        },
        [
            mentionQuery,
            filteredNodes,
            selectedIndex,
            insertMention,
            closeMention,
        ],
    );

    const handleBlur = useCallback(() => {
        // Delay so a click on the dropdown fires before close
        setTimeout(() => {
            closeMention();
            onBlur?.();
        }, 150);
    }, [closeMention, onBlur]);

    const isEmpty = !value || value.trim() === "";

    return (
        // className controls sizing (h-full, flex-1, min-h-*, etc.) on the
        // outer wrapper so that overflow-y-auto on the inner div is bounded.
        // nowheel + onWheel ensure scroll stays inside the editor, not the canvas.
        <div
            className={cn("nowheel relative w-full", className)}
            onWheel={(e) => e.stopPropagation()}
        >
            {isEmpty && placeholder && (
                <div className="text-muted-foreground pointer-events-none absolute top-0 left-0 text-xs select-none">
                    {placeholder}
                </div>
            )}
            <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onCompositionStart={() => (isComposingRef.current = true)}
                onCompositionEnd={() => {
                    isComposingRef.current = false;
                    handleInput();
                }}
                className="mention-editor h-full w-full overflow-y-auto break-words whitespace-pre-wrap outline-none"
                role="textbox"
                aria-multiline="true"
            />
            {mentionQuery !== null &&
                filteredNodes.length > 0 &&
                createPortal(
                    <div
                        className="bg-popover border-border fixed z-[9999] max-h-48 w-52 overflow-y-auto rounded-md border shadow-md"
                        style={{
                            top: dropdownPos.top,
                            left: dropdownPos.left,
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        {filteredNodes.map((node, i) => (
                            <button
                                key={node.id}
                                className={cn(
                                    "hover:bg-accent w-full px-3 py-1.5 text-left text-xs transition-colors",
                                    i === selectedIndex && "bg-accent",
                                )}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    insertMention(node);
                                }}
                            >
                                {node.name}
                            </button>
                        ))}
                    </div>,
                    document.body,
                )}
        </div>
    );
}
