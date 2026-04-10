"use client";

import { useEffect, useRef } from "react";
import { Bot, MessageSquare } from "lucide-react";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { CanvasChatMessage } from "./canvas-chat-message";

export function CanvasChatMessages() {
    const messages = useCanvasStore((s) => s.messages);
    const isChatLoading = useCanvasStore((s) => s.isChatLoading);
    const bottomRef = useRef<HTMLDivElement>(null);

    const lastMessageContent = messages[messages.length - 1]?.content;

    // ID of the assistant message currently being streamed/planned
    const liveAssistantId = isChatLoading
        ? [...messages].reverse().find((m) => m.role === "assistant")?.id
        : undefined;

    const liveAssistantMsg = liveAssistantId
        ? messages.find((m) => m.id === liveAssistantId)
        : undefined;

    // Show a standalone Phase B indicator: text is done but plan not yet received.
    // Kept outside the memo'd CanvasChatMessage so it always reflects store state.
    const showAnalyzing =
        isChatLoading && !!liveAssistantMsg?.content && !liveAssistantMsg?.plan;

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    useEffect(() => {
        if (isChatLoading) {
            bottomRef.current?.scrollIntoView({ behavior: "instant" });
        }
    }, [isChatLoading, lastMessageContent, showAnalyzing]);

    if (messages.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
                <div className="bg-muted flex size-12 items-center justify-center rounded-full">
                    <MessageSquare className="text-muted-foreground size-6" />
                </div>
                <div className="text-center">
                    <p className="text-foreground text-sm font-medium">
                        Start a conversation
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                        Describe the image or video you want to create, and the
                        AI will generate it on the canvas.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-1 py-2">
                {messages.map((message) => (
                    <CanvasChatMessage
                        key={message.id}
                        message={message}
                        isLiveAssistant={message.id === liveAssistantId}
                    />
                ))}

                {showAnalyzing && (
                    <div className="flex items-center gap-2.5 px-4 py-2">
                        <div className="bg-muted text-muted-foreground relative flex size-7 shrink-0 items-center justify-center rounded-full">
                            <Bot className="size-3.5" />
                            <span className="bg-primary absolute -right-0.5 -bottom-0.5 size-2 animate-pulse rounded-full" />
                        </div>
                        <div className="bg-muted flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm">
                            <span className="bg-primary size-1.5 animate-pulse rounded-full" />
                            <span className="text-muted-foreground text-xs">
                                Analyzing…
                            </span>
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>
        </div>
    );
}
