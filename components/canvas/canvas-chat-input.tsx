"use client";

import { useState, useCallback, useRef, type KeyboardEvent } from "react";
import { SendHorizonal, Sparkles, Image, Video } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
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
import type { ChatMessage } from "@/lib/canvas-types";

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

export function CanvasChatInput() {
    const [input, setInput] = useState("");
    const [mode, setMode] = useState<CanvasMode>("auto");
    const [model, setModel] = useState<string>(DEFAULT_MODEL);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const addMessage = useCanvasStore((s) => s.addMessage);
    const isChatLoading = useCanvasStore((s) => s.isChatLoading);

    const handleSend = useCallback(() => {
        const text = input.trim();
        if (!text || isChatLoading) return;

        const message: ChatMessage = {
            id: uuidv4(),
            role: "user",
            content: text,
            model,
            createdAt: new Date().toISOString(),
        };

        addMessage(message);
        setInput("");

        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }
    }, [input, isChatLoading, model, addMessage]);

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
                        <SendHorizonal className="size-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
