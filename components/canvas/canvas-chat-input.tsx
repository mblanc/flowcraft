"use client";

import { useState, useCallback, useRef, type KeyboardEvent } from "react";
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
import type {
    ChatMessage,
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
    { id: MODELS.TEXT.GEMINI_3_PRO_PREVIEW, label: "Gemini 3 Pro" },
    { id: MODELS.TEXT.GEMINI_2_5_FLASH, label: "Gemini 2.5 Flash" },
];

const DEFAULT_MODEL = MODELS.TEXT.GEMINI_3_FLASH_PREVIEW;

interface SSEEvent {
    event: string;
    data: string;
}

function parseSSEEvents(chunk: string, buffer: string): { events: SSEEvent[]; remaining: string } {
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

    const canvasId = useCanvasStore((s) => s.canvasId);
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
                            err.error || `Image generation failed (${res.status})`,
                        );
                    }

                    const { imageUrl } = await res.json();
                    updateNodeData(nodeId, {
                        sourceUrl: imageUrl,
                        status: "ready",
                    });
                } else {
                    const res = await fetch("/api/generate-video", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            prompt: media.prompt,
                            aspectRatio: media.config.aspectRatio || "16:9",
                            duration: media.config.duration || 4,
                            model: media.config.model,
                            resolution: media.config.resolution,
                        }),
                    });

                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(
                            err.error || `Video generation failed (${res.status})`,
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

    const handleSend = useCallback(async () => {
        const text = input.trim();
        if (!text || isChatLoading || !canvasId) return;

        const userMessage: ChatMessage = {
            id: uuidv4(),
            role: "user",
            content: text,
            model,
            createdAt: new Date().toISOString(),
        };

        addMessage(userMessage);
        setInput("");
        setIsChatLoading(true);

        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }

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
                    mode,
                    model,
                }),
                signal: abortController.signal,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Chat request failed (${res.status})`);
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
            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to get response";
            updateMessage(assistantMsgId, {
                content:
                    assistantMessage.content ||
                    `Error: ${message}`,
            });
            toast.error(message);
        } finally {
            setIsChatLoading(false);
            abortRef.current = null;
        }
    }, [
        input,
        isChatLoading,
        canvasId,
        model,
        mode,
        addMessage,
        updateMessage,
        setIsChatLoading,
        generateMedia,
    ]);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend],
    );

    const handleTextareaChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setInput(e.target.value);
            const el = e.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
        },
        [],
    );

    const selectedMode = MODES.find((m) => m.id === mode)!;
    const ModeIcon = selectedMode.icon;

    return (
        <div className="border-border border-t p-3">
            <div className="bg-muted/50 rounded-lg border">
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe what you want to create..."
                    disabled={isChatLoading}
                    rows={1}
                    className="placeholder:text-muted-foreground w-full resize-none bg-transparent px-3 pt-3 pb-2 text-sm outline-none disabled:opacity-50"
                />

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
                        onClick={handleSend}
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
