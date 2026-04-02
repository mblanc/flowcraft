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
} from "@/lib/canvas-types";
import type { MediaToGenerate } from "@/lib/canvas-agent";

type CanvasMode = "auto" | "image" | "video";

const MODES: { id: CanvasMode; label: string; icon: typeof Sparkles }[] = [
    { id: "auto", label: "Auto", icon: Sparkles },
    { id: "image", label: "Image", icon: Image },
    { id: "video", label: "Video", icon: Video },
];

const REASONING_MODELS = [
    { id: MODELS.TEXT.GEMINI_3_FLASH_PREVIEW, label: "Gemini 3 Flash" },
    { id: MODELS.TEXT.GEMINI_3_1_PRO_PREVIEW, label: "Gemini 3.1 Pro" },
    { id: MODELS.TEXT.GEMINI_2_5_FLASH, label: "Gemini 2.5 Flash" },
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
    const updateNodeData = useCanvasStore((s) => s.updateNodeData);
    const getNextLabel = useCanvasStore((s) => s.getNextLabel);
    const getNextNodeId = useCanvasStore((s) => s.getNextNodeId);
    const addGeneratingNodeId = useCanvasStore((s) => s.addGeneratingNodeId);
    const removeGeneratingNodeId = useCanvasStore(
        (s) => s.removeGeneratingNodeId,
    );
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

    const generateMedia = useCallback(
        async (media: MediaToGenerate, assistantMsgId: string) => {
            const nodeType =
                media.type === "image" ? "canvas-image" : "canvas-video";
            const nodeId = getNextNodeId(nodeType);
            const label = getNextLabel(nodeType);
            const center = getViewportCenter();

            if (media.type === "image") {
                const data: CanvasImageData = {
                    type: "canvas-image",
                    label,
                    sourceUrl: "",
                    mimeType: "image/png",
                    prompt: media.prompt,
                    width: 300,
                    height: 300,
                    aspectRatio: media.config.aspectRatio,
                    model: media.config.model,
                    status: "generating",
                };
                addNode({
                    id: nodeId,
                    type: "canvas-image",
                    position: { x: center.x - 150, y: center.y - 150 },
                    data,
                    width: 300,
                    height: 300,
                });
            } else {
                const data: CanvasVideoData = {
                    type: "canvas-video",
                    label,
                    sourceUrl: "",
                    mimeType: "video/mp4",
                    prompt: media.prompt,
                    aspectRatio: media.config.aspectRatio,
                    model: media.config.model,
                    status: "generating",
                    progress: 0,
                };
                addNode({
                    id: nodeId,
                    type: "canvas-video",
                    position: { x: center.x - 180, y: center.y - 140 },
                    data,
                    width: 360,
                    height: 280,
                });
            }

            addGeneratingNodeId(nodeId);

            const generatedRef: GeneratedMediaRef = {
                nodeId,
                type: nodeType,
            };
            updateMessage(assistantMsgId, {
                generatedMedia: [generatedRef],
            });

            try {
                if (media.type === "image") {
                    const referenceImages =
                        media.referenceNodeIds
                            ?.map((nid) => {
                                const n = useCanvasStore
                                    .getState()
                                    .nodes.find((node) => node.id === nid);
                                if (
                                    n &&
                                    "sourceUrl" in n.data &&
                                    n.data.sourceUrl
                                ) {
                                    return {
                                        url: n.data.sourceUrl as string,
                                        type:
                                            ("mimeType" in n.data
                                                ? (n.data.mimeType as string)
                                                : null) || "image/png",
                                    };
                                }
                                return null;
                            })
                            .filter(Boolean) ?? [];

                    const res = await fetch("/api/generate-image", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            prompt: media.prompt,
                            images: referenceImages,
                            aspectRatio: media.config.aspectRatio || "16:9",
                            model: media.config.model,
                            resolution: media.config.resolution,
                        }),
                    });

                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(
                            err.error ||
                                `Image generation failed (${res.status})`,
                        );
                    }

                    const { imageUrl } = await res.json();
                    updateNodeData(nodeId, {
                        sourceUrl: imageUrl,
                        status: "ready",
                    });
                } else {
                    const referenceImages =
                        media.referenceNodeIds
                            ?.map((nid) => {
                                const n = useCanvasStore
                                    .getState()
                                    .nodes.find((node) => node.id === nid);
                                if (
                                    n &&
                                    n.type === "canvas-image" &&
                                    "sourceUrl" in n.data &&
                                    n.data.sourceUrl
                                ) {
                                    return {
                                        url: n.data.sourceUrl as string,
                                        type:
                                            ("mimeType" in n.data
                                                ? (n.data.mimeType as string)
                                                : null) || "image/png",
                                    };
                                }
                                return null;
                            })
                            .filter(Boolean) ?? [];

                    const res = await fetch("/api/generate-video", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            prompt: media.prompt,
                            aspectRatio: media.config.aspectRatio || "16:9",
                            duration: media.config.duration || 4,
                            model: media.config.model,
                            resolution: media.config.resolution,
                            images: referenceImages,
                        }),
                    });

                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(
                            err.error ||
                                `Video generation failed (${res.status})`,
                        );
                    }

                    const { videoUrl } = await res.json();
                    updateNodeData(nodeId, {
                        sourceUrl: videoUrl,
                        status: "ready",
                        progress: 100,
                    });
                }

                toast.success(
                    `${media.type === "image" ? "Image" : "Video"} generated successfully`,
                );
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : "Generation failed";
                updateNodeData(nodeId, {
                    status: "error",
                    error: message,
                });
                toast.error(message);
            } finally {
                removeGeneratingNodeId(nodeId);
            }
        },
        [
            addNode,
            updateNodeData,
            updateMessage,
            getNextNodeId,
            getNextLabel,
            getViewportCenter,
            addGeneratingNodeId,
            removeGeneratingNodeId,
        ],
    );

    const handleSend = useCallback(
        async (overrideMessage?: string) => {
            const text = overrideMessage ?? input.trim();
            if (!text || isChatLoading || !canvasId) return;

            const isActionPrompt = !!overrideMessage;
            const cleanedText = text;
            const attachmentsToSend = isActionPrompt ? [] : [...allAttachments];

            if (!isActionPrompt) {
                for (const nodeId of mentionedNodeIds) {
                    const node = nodes.find((n) => n.id === nodeId);
                    if (
                        node &&
                        node.type === "canvas-text" &&
                        !attachmentsToSend.some((a) => a.nodeId === nodeId)
                    ) {
                        // Text nodes stay as @Label in the message for the LLM
                    }
                }
            }

            const userMessage: ChatMessage = {
                id: uuidv4(),
                role: "user",
                content: cleanedText,
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
                        message: cleanedText,
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
                let pendingMedia: MediaToGenerate | null = null;

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

                                case "media":
                                    pendingMedia = payload as MediaToGenerate;
                                    break;

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

                if (pendingMedia) {
                    generateMedia(pendingMedia, assistantMsgId);
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
            mentionedNodeIds,
            nodes,
            addMessage,
            updateMessage,
            setIsChatLoading,
            generateMedia,
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

    const selectedMode = MODES.find((m) => m.id === mode)!;
    const ModeIcon = selectedMode.icon;

    return (
        <div className="border-border border-t p-3">
            <div className="bg-muted/50 rounded-lg border">
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
                                                <ModeIcon className="size-3.5" />
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
