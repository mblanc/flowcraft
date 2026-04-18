"use client";

import { useState, useRef, useCallback } from "react";
import { Plus, Minus, MessageSquare } from "lucide-react";
import { CanvasChatMessages } from "./canvas-chat-messages";
import { CanvasChatInput } from "./canvas-chat-input";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
    DialogClose,
} from "@/components/ui/dialog";
import type { AgentPlan } from "@/lib/canvas-types";

interface CanvasChatPanelProps {
    getViewportCenter: () => { x: number; y: number };
}

export function CanvasChatPanel({ getViewportCenter }: CanvasChatPanelProps) {
    const [isOpen, setIsOpen] = useState(true);
    const clearMessages = useCanvasStore((s) => s.clearMessages);

    // Ref set by CanvasChatInput so plan approval widget can trigger execution
    const executePlanStreamRef = useRef<
        ((messageId: string, plan: AgentPlan) => Promise<void>) | null
    >(null);

    const handleExecutePlan = useCallback(
        (messageId: string, plan: AgentPlan) => {
            executePlanStreamRef.current?.(messageId, plan);
        },
        [],
    );

    const handleClearChat = () => {
        clearMessages();
    };

    if (!isOpen) {
        return (
            <div className="absolute right-4 bottom-4 z-50">
                <Button
                    size="icon"
                    onClick={() => setIsOpen(true)}
                    className="bg-card text-foreground border-border hover:bg-accent size-10 rounded-md border shadow-sm"
                >
                    <MessageSquare className="size-5" />
                </Button>
            </div>
        );
    }

    return (
        <div className="border-border bg-card absolute top-4 right-4 bottom-4 z-50 flex w-[380px] flex-col rounded-lg border shadow-md">
            {/* Header */}
            <div className="flex h-12 shrink-0 items-center justify-between rounded-t-lg px-4">
                <h2 className="text-foreground text-sm font-semibold">Chat</h2>
                <div className="flex items-center gap-1">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground size-7"
                            >
                                <Plus className="size-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Clear chat history?</DialogTitle>
                                <DialogDescription>
                                    This will permanently clear the chat history
                                    for this canvas.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="ghost">Cancel</Button>
                                </DialogClose>
                                <DialogClose asChild>
                                    <Button
                                        variant="destructive"
                                        onClick={handleClearChat}
                                    >
                                        Clear
                                    </Button>
                                </DialogClose>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsOpen(false)}
                        className="text-muted-foreground hover:text-foreground size-7"
                    >
                        <Minus className="size-4" />
                    </Button>
                </div>
            </div>

            {/* Messages */}
            <CanvasChatMessages onExecutePlan={handleExecutePlan} />

            {/* Input */}
            <div className="rounded-b-lg">
                <CanvasChatInput
                    getViewportCenter={getViewportCenter}
                    executePlanStreamRef={executePlanStreamRef}
                />
            </div>
        </div>
    );
}
