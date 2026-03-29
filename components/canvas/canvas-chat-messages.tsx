"use client";

import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { CanvasChatMessage } from "./canvas-chat-message";

export function CanvasChatMessages() {
    const messages = useCanvasStore((s) => s.messages);
    const isChatLoading = useCanvasStore((s) => s.isChatLoading);
    const bottomRef = useRef<HTMLDivElement>(null);

    const lastMessageContent = messages[messages.length - 1]?.content;

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    useEffect(() => {
        if (isChatLoading) {
            bottomRef.current?.scrollIntoView({ behavior: "instant" });
        }
    }, [isChatLoading, lastMessageContent]);

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
                    <CanvasChatMessage key={message.id} message={message} />
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
