"use client";

import { useState, useRef, useCallback } from "react";
import { Plus, Minus, MessageSquare, Settings, Sparkles } from "lucide-react";
import { CanvasChatMessages } from "./canvas-chat-messages";
import { CanvasChatInput } from "./canvas-chat-input";
import { SkillsLibrary } from "./skills-library";
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
import type { AgentPlan } from "@/lib/canvas/types";

interface CanvasChatPanelProps {
    getViewportCenter: () => { x: number; y: number };
    centerOnNodes: (x: number, y: number) => void;
}

export function CanvasChatPanel({
    getViewportCenter,
    centerOnNodes,
}: CanvasChatPanelProps) {
    const [isOpen, setIsOpen] = useState(true);
    const [activeTab, setActiveTab] = useState<"chat" | "skills">("chat");
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
        <div className="border-border bg-card/80 absolute top-4 right-4 bottom-4 z-50 flex w-[380px] flex-col overflow-hidden rounded-lg border shadow-md backdrop-blur-md">
            {/* Header */}
            <div className="border-border/40 flex h-12 shrink-0 items-center justify-between border-b px-4">
                <h2 className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
                    <Sparkles className="text-primary h-4 w-4" />
                    Director Assistant
                </h2>
                <div className="flex items-center gap-1">
                    {activeTab === "chat" && (
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-foreground size-7"
                                    title="Clear chat history"
                                >
                                    <Plus className="size-4" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>
                                        Clear chat history?
                                    </DialogTitle>
                                    <DialogDescription>
                                        This will permanently clear the chat
                                        history for this canvas.
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
                    )}
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

            {/* Segment Tabs */}
            <div className="bg-muted/20 border-border/30 grid shrink-0 grid-cols-2 border-b p-1">
                <button
                    onClick={() => setActiveTab("chat")}
                    className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all ${
                        activeTab === "chat"
                            ? "bg-background text-foreground border-border/20 border shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <MessageSquare className="size-3.5" /> Chat
                </button>
                <button
                    onClick={() => setActiveTab("skills")}
                    className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all ${
                        activeTab === "skills"
                            ? "bg-background text-foreground border-border/20 border shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <Settings className="size-3.5" /> Skills
                </button>
            </div>

            {/* Body */}
            {activeTab === "chat" ? (
                <>
                    {/* Messages */}
                    <div className="flex min-h-0 flex-1 flex-col">
                        <CanvasChatMessages onExecutePlan={handleExecutePlan} />
                    </div>

                    {/* Input */}
                    <div className="border-border/40 shrink-0 rounded-b-lg border-t">
                        <CanvasChatInput
                            getViewportCenter={getViewportCenter}
                            centerOnNodes={centerOnNodes}
                            executePlanStreamRef={executePlanStreamRef}
                        />
                    </div>
                </>
            ) : (
                <div className="flex-1 overflow-hidden">
                    <SkillsLibrary />
                </div>
            )}
        </div>
    );
}
