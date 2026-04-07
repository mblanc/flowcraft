"use client";

import {
    useState,
    useCallback,
    useRef,
    useMemo,
    useEffect,
    type KeyboardEvent,
} from "react";
import { SendHorizonal, Sparkles, Image, Video, Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { MODELS } from "@/lib/constants";
import { CanvasAttachmentBar } from "./canvas-attachment-bar";
import {
    CanvasMentionDropdown,
    type MentionItem,
} from "./canvas-mention-dropdown";
import type {
    ChatMessage,
    ChatAttachment,
    CanvasImageData,
    CanvasVideoData,
    GeneratedMediaRef,
    NodePayload,
    GenerationStep,
} from "@/lib/canvas-types";

type CanvasMode = "auto" | "image" | "video";

const MODES: { id: CanvasMode; label: string; icon: typeof Sparkles }[] = [
    { id: "auto", label: "Auto", icon: Sparkles },
    { id: "image", label: "Image", icon: Image },
    { id: "video", label: "Video", icon: Video },
];

const REASONING_MODELS = [
    { id: MODELS.TEXT.GEMINI_3_FLASH_PREVIEW, label: "Gemini 3 Flash" },
    { id: MODELS.TEXT.GEMINI_3_1_PRO_PREVIEW, label: "Gemini 3.1 Pro" },
    { id: MODELS.TEXT.GEMINI_3_1_FLASH_LITE_PREVIEW, label: "Gemini 3.1 Flash Lite" },
];

const DEFAULT_MODEL = MODELS.TEXT.GEMINI_3_FLASH_PREVIEW;

interface SSEEvent {
    event: string;
    data: string;
}

function parseSSEEvents(
    chunk: string,
    buffer: string,
): { events: SSEEvent[]; remaining: string } {
    const raw = buffer + chunk;
    const events: SSEEvent[] = [];
    const blocks = raw.split("\n\n");

    const remaining = blocks.pop() ?? "";

    for (const block of blocks) {
        if (!block.trim()) continue;
        let event = "";
        let data = "";
        for (const line of block.split("\n")) {
            if (line.startsWith("event: ")) event = line.slice(7);
            else if (line.startsWith("data: ")) data = line.slice(6);
        }
        if (event && data) {
            events.push({ event, data });
        }
    }

    return { events, remaining };
}

interface CanvasChatInputProps {
    getViewportCenter: () => { x: number; y: number };
}

export function CanvasChatInput({ getViewportCenter }: CanvasChatInputProps) {
    const [input, setInput] = useState("");
    const [mode, setMode] = useState<CanvasMode>("auto");
    const [model, setModel] = useState<string>(DEFAULT_MODEL);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    // @mention state
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 });
    const [mentionedNodeIds, setMentionedNodeIds] = useState<Set<string>>(
        new Set(),
    );
    const mentionTriggerPos = useRef<number | null>(null);

    // Dismissed selection-based attachment node IDs
    const [dismissedNodeIds, setDismissedNodeIds] = useState<Set<string>>(
        new Set(),
    );

    const canvasId = useCanvasStore((s) => s.canvasId);
    const nodes = useCanvasStore((s) => s.nodes);
    const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
    const addMessage = useCanvasStore((s) => s.addMessage);
    const updateMessage = useCanvasStore((s) => s.updateMessage);
    const isChatLoading = useCanvasStore((s) => s.isChatLoading);
    const setIsChatLoading = useCanvasStore((s) => s.setIsChatLoading);
    const addNode = useCanvasStore((s) => s.addNode);
    const getNextLabel = useCanvasStore((s) => s.getNextLabel);
    const setPlanStepStatus = useCanvasStore((s) => s.setPlanStepStatus);
    const pendingActionPrompt = useCanvasStore((s) => s.pendingActionPrompt);
    const setPendingActionPrompt = useCanvasStore(
        (s) => s.setPendingActionPrompt,
    );

    // Build mention items from all canvas nodes
    const mentionItems: MentionItem[] = useMemo(
        () =>
            nodes.map((n) => ({
                id: n.id,
                label: n.data.label,
                type: n.type,
            })),
        [nodes],
    );

    const filteredMentionItems = useMemo(
        () =>
            mentionQuery !== null
                ? mentionItems.filter((item) =>
                      item.label
                          .toLowerCase()
                          .includes(mentionQuery.toLowerCase()),
                  )
                : [],
        [mentionItems, mentionQuery],
    );

    // Selection-based attachments (media nodes only, minus dismissed)
    const selectionAttachments: ChatAttachment[] = useMemo(() => {
        return selectedNodeIds
            .filter((id) => !dismissedNodeIds.has(id))
            .map((id) => {
                const node = nodes.find((n) => n.id === id);
                if (
                    !node ||
                    (node.type !== "canvas-image" &&
                        node.type !== "canvas-video")
                )
                    return null;
                return {
                    nodeId: node.id,
                    label: node.data.label,
                    type: node.type,
                } as ChatAttachment;
            })
            .filter(Boolean) as ChatAttachment[];
    }, [selectedNodeIds, nodes, dismissedNodeIds]);

    // Mention-based attachments (media nodes only)
    const mentionAttachments: ChatAttachment[] = useMemo(() => {
        return Array.from(mentionedNodeIds)
            .filter((id) => !selectionAttachments.some((a) => a.nodeId === id))
            .map((id) => {
                const node = nodes.find((n) => n.id === id);
                if (
                    !node ||
                    (node.type !== "canvas-image" &&
                        node.type !== "canvas-video")
                )
                    return null;
                return {
                    nodeId: node.id,
                    label: node.data.label,
                    type: node.type,
                } as ChatAttachment;
            })
            .filter(Boolean) as ChatAttachment[];
    }, [mentionedNodeIds, nodes, selectionAttachments]);

    const allAttachments = useMemo(
        () => [...selectionAttachments, ...mentionAttachments],
        [selectionAttachments, mentionAttachments],
    );

    // Reset dismissed list when canvas selection changes
    useEffect(() => {
        setDismissedNodeIds(new Set());
    }, [selectedNodeIds]);

    const handleRemoveAttachment = useCallback(
        (nodeId: string) => {
            if (mentionedNodeIds.has(nodeId)) {
                setMentionedNodeIds((prev) => {
                    const next = new Set(prev);
                    next.delete(nodeId);
                    return next;
                });
                // Also remove the @Label text from input
                const node = nodes.find((n) => n.id === nodeId);
                if (node) {
                    setInput((prev) =>
                        prev.replace(
                            new RegExp(`@${escapeRegex(node.data.label)}\\s?`),
                            "",
                        ),
                    );
                }
            } else {
                setDismissedNodeIds((prev) => new Set(prev).add(nodeId));
            }
        },
        [mentionedNodeIds, nodes],
    );

    // @mention detection in textarea
    const detectMention = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;

        const cursorPos = el.selectionStart;
        const textBeforeCursor = el.value.slice(0, cursorPos);

        const atIndex = textBeforeCursor.lastIndexOf("@");
        if (atIndex === -1) {
            setMentionQuery(null);
            mentionTriggerPos.current = null;
            return;
        }

        const query = textBeforeCursor.slice(atIndex + 1);
        if (query.includes(" ") || query.includes("\n")) {
            setMentionQuery(null);
            mentionTriggerPos.current = null;
            return;
        }

        mentionTriggerPos.current = atIndex;
        setMentionQuery(query);
        setMentionIndex(0);

        // Position the dropdown above the textarea (since it's at the bottom of the screen)
        const rect = el.getBoundingClientRect();
        setMentionPos({
            top: rect.top - 4,
            left: rect.left + 12,
        });
    }, []);

    const closeMention = useCallback(() => {
        setMentionQuery(null);
        mentionTriggerPos.current = null;
    }, []);

    const handleMentionSelect = useCallback(
        (item: MentionItem) => {
            const el = textareaRef.current;
            if (!el || mentionTriggerPos.current === null) return;

            const before = input.slice(0, mentionTriggerPos.current);
            const after = input.slice(el.selectionStart);
            const newValue = `${before}@${item.label} ${after}`;

            setInput(newValue);
            setMentionedNodeIds((prev) => new Set(prev).add(item.id));
            closeMention();

            // Restore cursor position after the inserted mention
            const cursorPos = before.length + 1 + item.label.length + 1;
            requestAnimationFrame(() => {
                el.focus();
                el.selectionStart = cursorPos;
                el.selectionEnd = cursorPos;
            });
        },
        [input, closeMention],
    );

    /** Create a placeholder node for a generation step, collision-aware.
     *  Returns { rect, nodeId } — nodeId is a fresh uuid, NOT step.id,
     *  so multiple runs never produce duplicate canvas node IDs. */
    const addPlaceholderNode = useCallback(
        (
            step: GenerationStep,
            occupiedRects: PlaceholderRect[],
        ): { rect: PlaceholderRect; nodeId: string } => {
            const { width, height } = parseAspectRatioDimensions(
                step.aspectRatio,
            );

            // Find the reference node to position near
            const refNodeId =
                step.referenceNodeIds?.[0] ?? step.firstFrameNodeId;
            const refNode = refNodeId
                ? nodes.find((n) => n.id === refNodeId)
                : null;
            const refRect: PlaceholderRect | null = refNode
                ? {
                      x: refNode.position.x,
                      y: refNode.position.y,
                      w:
                          (refNode.data as { width?: number }).width ??
                          refNode.width ??
                          300,
                      h:
                          (refNode.data as { height?: number }).height ??
                          refNode.height ??
                          300,
                  }
                : null;

            const center = getViewportCenter();
            const position = findEmptyPosition(
                width,
                height,
                refRect,
                occupiedRects,
                center,
            );

            const nodeId = uuidv4();
            const nodeType = step.type === "image" ? "canvas-image" : "canvas-video";
            const label = step.label ?? getNextLabel(nodeType);

            if (step.type === "image") {
                const data: CanvasImageData = {
                    type: "canvas-image",
                    label,
                    sourceUrl: "",
                    mimeType: "image/png",
                    prompt: step.prompt,
                    width,
                    height,
                    aspectRatio: step.aspectRatio,
                    model: step.model,
                    status: "generating",
                    referenceNodeIds: step.referenceNodeIds,
                };
                addNode({ id: nodeId, type: "canvas-image", position, data, width, height });
            } else {
                const data: CanvasVideoData = {
                    type: "canvas-video",
                    label,
                    sourceUrl: "",
                    mimeType: "video/mp4",
                    prompt: step.prompt,
                    width,
                    height,
                    aspectRatio: step.aspectRatio,
                    model: step.model,
                    status: "generating",
                    progress: 0,
                    referenceNodeIds: step.referenceNodeIds,
                };
                addNode({ id: nodeId, type: "canvas-video", position, data, width, height });
            }

            return { rect: { x: position.x, y: position.y, w: width, h: height }, nodeId };
        },
        [getViewportCenter, addNode, getNextLabel, nodes],
    );

    const handleSend = useCallback(
        async (overrideMessage?: string) => {
            const text = overrideMessage ?? input.trim();
            if (!text || isChatLoading || !canvasId) return;

            const isActionPrompt = !!overrideMessage;
            const attachmentsToSend = isActionPrompt ? [] : [...allAttachments];

            const userMessage: ChatMessage = {
                id: uuidv4(),
                role: "user",
                content: text,
                attachments:
                    attachmentsToSend.length > 0
                        ? attachmentsToSend
                        : undefined,
                model,
                createdAt: new Date().toISOString(),
            };

            addMessage(userMessage);
            if (!isActionPrompt) {
                setInput("");
                setMentionedNodeIds(new Set());
                setDismissedNodeIds(new Set());
                if (textareaRef.current) {
                    textareaRef.current.style.height = "auto";
                }
            }
            setIsChatLoading(true);

            const assistantMsgId = uuidv4();
            const assistantMessage: ChatMessage = {
                id: assistantMsgId,
                role: "assistant",
                content: "",
                model,
                createdAt: new Date().toISOString(),
            };
            addMessage(assistantMessage);

            const abortController = new AbortController();
            abortRef.current = abortController;

            try {
                const res = await fetch(`/api/canvases/${canvasId}/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: text,
                        attachments:
                            attachmentsToSend.length > 0
                                ? attachmentsToSend
                                : undefined,
                        mode,
                        model,
                    }),
                    signal: abortController.signal,
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(
                        err.error || `Chat request failed (${res.status})`,
                    );
                }

                const reader = res.body?.getReader();
                if (!reader) throw new Error("No response stream");

                const decoder = new TextDecoder();
                let buffer = "";
                let accumulatedText = "";
                // Maps stepId → canvas nodeId for this generation run
                const stepNodeMap = new Map<string, string>();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const { events, remaining } = parseSSEEvents(chunk, buffer);
                    buffer = remaining;

                    for (const sse of events) {
                        try {
                            const payload = JSON.parse(sse.data);

                            switch (sse.event) {
                                case "text":
                                    accumulatedText += payload.delta;
                                    updateMessage(assistantMsgId, {
                                        content: accumulatedText,
                                    });
                                    break;

                                case "plan": {
                                    const steps = payload.steps as GenerationStep[];
                                    updateMessage(assistantMsgId, {
                                        plan: { steps },
                                    });
                                    // Seed occupied rects with all current canvas nodes
                                    const occupiedRects: PlaceholderRect[] =
                                        useCanvasStore
                                            .getState()
                                            .nodes.map((n) => ({
                                                x: n.position.x,
                                                y: n.position.y,
                                                w:
                                                    (n.data as { width?: number }).width ??
                                                    n.width ??
                                                    300,
                                                h:
                                                    (n.data as { height?: number }).height ??
                                                    n.height ??
                                                    300,
                                            }));
                                    steps.forEach((s) => {
                                        setPlanStepStatus(
                                            assistantMsgId,
                                            s.id,
                                            "pending",
                                        );
                                        const { rect, nodeId } = addPlaceholderNode(
                                            s,
                                            occupiedRects,
                                        );
                                        stepNodeMap.set(s.id, nodeId);
                                        occupiedRects.push(rect);
                                    });
                                    break;
                                }

                                case "step_start":
                                    setPlanStepStatus(
                                        assistantMsgId,
                                        payload.stepId,
                                        "generating",
                                    );
                                    break;

                                case "step_done": {
                                    const node = payload.node as NodePayload;
                                    setPlanStepStatus(
                                        assistantMsgId,
                                        payload.stepId,
                                        "done",
                                    );
                                    const nodeId = stepNodeMap.get(payload.stepId);
                                    if (nodeId) {
                                        useCanvasStore.getState().updateNodeData(
                                            nodeId,
                                            {
                                                sourceUrl: node.sourceUrl,
                                                label: node.label,
                                                mimeType: node.mimeType,
                                                status: "ready",
                                                ...(node.type === "canvas-video"
                                                    ? { progress: 100 }
                                                    : {}),
                                            },
                                        );
                                        const currentMsg = useCanvasStore
                                            .getState()
                                            .messages.find(
                                                (m) => m.id === assistantMsgId,
                                            );
                                        const existingRefs: GeneratedMediaRef[] =
                                            currentMsg?.generatedMedia ?? [];
                                        updateMessage(assistantMsgId, {
                                            generatedMedia: [
                                                ...existingRefs,
                                                { nodeId, type: node.type },
                                            ],
                                        });
                                    }
                                    break;
                                }

                                case "step_error": {
                                    const nodeId = stepNodeMap.get(payload.stepId);
                                    setPlanStepStatus(
                                        assistantMsgId,
                                        payload.stepId,
                                        "error",
                                    );
                                    if (nodeId) {
                                        useCanvasStore.getState().updateNodeData(
                                            nodeId,
                                            { status: "error", error: payload.message },
                                        );
                                    }
                                    toast.error(`Generation failed: ${payload.message}`);
                                    break;
                                }

                                case "actions":
                                    if (payload.actions) {
                                        updateMessage(assistantMsgId, {
                                            actions: payload.actions,
                                        });
                                    }
                                    break;

                                case "error":
                                    throw new Error(
                                        payload.message || "Stream error",
                                    );

                                case "done":
                                    break;
                            }
                        } catch (parseErr) {
                            if (
                                parseErr instanceof Error &&
                                parseErr.message !== "Stream error"
                            ) {
                                console.warn("SSE parse error:", parseErr);
                            } else {
                                throw parseErr;
                            }
                        }
                    }
                }
            } catch (error) {
                if (
                    error instanceof DOMException &&
                    error.name === "AbortError"
                ) {
                    return;
                }
                const message =
                    error instanceof Error
                        ? error.message
                        : "Failed to get response";
                updateMessage(assistantMsgId, {
                    content: assistantMessage.content || `Error: ${message}`,
                });
                toast.error(message);
            } finally {
                setIsChatLoading(false);
                abortRef.current = null;
            }
        },
        [
            input,
            isChatLoading,
            canvasId,
            model,
            mode,
            allAttachments,
            addMessage,
            updateMessage,
            setIsChatLoading,
            setPlanStepStatus,
            addPlaceholderNode,
        ],
    );

    // Auto-send when a suggested action button is clicked
    useEffect(() => {
        if (pendingActionPrompt && !isChatLoading) {
            setPendingActionPrompt(null);
            handleSend(pendingActionPrompt);
        }
    }, [
        pendingActionPrompt,
        isChatLoading,
        setPendingActionPrompt,
        handleSend,
    ]);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLTextAreaElement>) => {
            // Handle mention dropdown navigation
            if (mentionQuery !== null && filteredMentionItems.length > 0) {
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setMentionIndex((i) =>
                        Math.min(i + 1, filteredMentionItems.length - 1),
                    );
                    return;
                }
                if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setMentionIndex((i) => Math.max(i - 1, 0));
                    return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    handleMentionSelect(filteredMentionItems[mentionIndex]);
                    return;
                }
                if (e.key === "Escape") {
                    e.preventDefault();
                    closeMention();
                    return;
                }
            }

            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [
            handleSend,
            mentionQuery,
            filteredMentionItems,
            mentionIndex,
            handleMentionSelect,
            closeMention,
        ],
    );

    const handleTextareaChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setInput(e.target.value);
            const el = e.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 150)}px`;

            detectMention();
        },
        [detectMention],
    );

    const handleTextareaClick = useCallback(() => {
        detectMention();
    }, [detectMention]);

    return (
        <div className="border-border rounded-b-2xl border-t p-3">
            <div className="bg-muted/50 rounded-xl border">
                <CanvasAttachmentBar
                    attachments={allAttachments}
                    onRemove={handleRemoveAttachment}
                />

                <div className="relative">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={handleTextareaChange}
                        onKeyDown={handleKeyDown}
                        onClick={handleTextareaClick}
                        placeholder={
                            allAttachments.length > 0
                                ? "Describe what to do with the selected items..."
                                : "Describe what you want to create... (@ to mention)"
                        }
                        disabled={isChatLoading}
                        rows={1}
                        className="placeholder:text-muted-foreground w-full resize-none bg-transparent px-3 pt-3 pb-2 text-sm outline-none disabled:opacity-50"
                    />

                    {mentionQuery !== null &&
                        filteredMentionItems.length > 0 && (
                            <CanvasMentionDropdown
                                items={filteredMentionItems}
                                query={mentionQuery}
                                selectedIndex={mentionIndex}
                                position={mentionPos}
                                onSelect={handleMentionSelect}
                                onHover={setMentionIndex}
                            />
                        )}
                </div>

                <div className="flex items-center justify-between gap-2 px-2 pb-2">
                    <div className="flex items-center gap-1.5">
                        <TooltipProvider delayDuration={300}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div>
                                        <Select
                                            value={mode}
                                            onValueChange={(v) =>
                                                setMode(v as CanvasMode)
                                            }
                                        >
                                            <SelectTrigger
                                                size="sm"
                                                className="h-7 gap-1.5 border-none bg-transparent px-2 text-xs shadow-none"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {MODES.map((m) => {
                                                    const Icon = m.icon;
                                                    return (
                                                        <SelectItem
                                                            key={m.id}
                                                            value={m.id}
                                                        >
                                                            <Icon className="size-3.5" />
                                                            {m.label}
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    Generation mode
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <div className="bg-border h-4 w-px" />

                        <TooltipProvider delayDuration={300}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div>
                                        <Select
                                            value={model}
                                            onValueChange={setModel}
                                        >
                                            <SelectTrigger
                                                size="sm"
                                                className="h-7 max-w-[140px] border-none bg-transparent px-2 text-xs shadow-none"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {REASONING_MODELS.map((m) => (
                                                    <SelectItem
                                                        key={m.id}
                                                        value={m.id}
                                                    >
                                                        {m.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    Reasoning model
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    <Button
                        size="icon-sm"
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isChatLoading}
                        className="shrink-0 rounded-lg"
                    >
                        {isChatLoading ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <SendHorizonal className="size-4" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Placeholder positioning utilities ───────────────────────────────────────

interface PlaceholderRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

const GAP = 20;
const BASE_AREA = 90_000; // ~300×300 px²

function parseAspectRatioDimensions(aspectRatio?: string): {
    width: number;
    height: number;
} {
    if (!aspectRatio) return { width: 300, height: 300 };
    const [wStr, hStr] = aspectRatio.split(":");
    const wRatio = parseFloat(wStr);
    const hRatio = parseFloat(hStr);
    if (!wRatio || !hRatio) return { width: 300, height: 300 };
    const width = Math.round(Math.sqrt(BASE_AREA * (wRatio / hRatio)));
    const height = Math.round(BASE_AREA / width);
    return { width, height };
}

function rectsOverlap(a: PlaceholderRect, b: PlaceholderRect): boolean {
    return !(
        a.x + a.w + GAP <= b.x ||
        b.x + b.w + GAP <= a.x ||
        a.y + a.h + GAP <= b.y ||
        b.y + b.h + GAP <= a.y
    );
}

function isPositionFree(
    candidate: PlaceholderRect,
    occupied: PlaceholderRect[],
): boolean {
    return !occupied.some((r) => rectsOverlap(candidate, r));
}

/**
 * Find an empty canvas position for a new placeholder node.
 * Tries positions around the reference rect first (right, below, left, above),
 * then spirals outward in a grid from the anchor point.
 */
function findEmptyPosition(
    w: number,
    h: number,
    ref: PlaceholderRect | null,
    occupied: PlaceholderRect[],
    viewportCenter: { x: number; y: number },
): { x: number; y: number } {
    const anchor = ref
        ? { x: ref.x + ref.w / 2, y: ref.y + ref.h / 2 }
        : viewportCenter;

    // Priority candidates around the reference rect
    if (ref) {
        const candidates = [
            // Right
            { x: ref.x + ref.w + GAP, y: ref.y + (ref.h - h) / 2 },
            // Below
            { x: ref.x + (ref.w - w) / 2, y: ref.y + ref.h + GAP },
            // Left
            { x: ref.x - w - GAP, y: ref.y + (ref.h - h) / 2 },
            // Above
            { x: ref.x + (ref.w - w) / 2, y: ref.y - h - GAP },
        ];
        for (const pos of candidates) {
            const rect = { x: pos.x, y: pos.y, w, h };
            if (isPositionFree(rect, occupied)) return pos;
        }
    }

    // Spiral outward in a grid from the anchor
    const step = Math.max(w, h) + GAP;
    for (let ring = 0; ring <= 20; ring++) {
        if (ring === 0) {
            const pos = { x: anchor.x - w / 2, y: anchor.y - h / 2 };
            if (isPositionFree({ x: pos.x, y: pos.y, w, h }, occupied))
                return pos;
            continue;
        }
        // Walk the perimeter of the ring
        for (let dx = -ring; dx <= ring; dx++) {
            for (let dy = -ring; dy <= ring; dy++) {
                if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
                const pos = {
                    x: anchor.x - w / 2 + dx * step,
                    y: anchor.y - h / 2 + dy * step,
                };
                if (isPositionFree({ x: pos.x, y: pos.y, w, h }, occupied))
                    return pos;
            }
        }
    }

    // Absolute fallback (should never reach here)
    return { x: anchor.x - w / 2, y: anchor.y - h / 2 };
}
