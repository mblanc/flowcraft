"use client";

import { memo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    User,
    Bot,
    Image,
    Video,
    Zap,
    Check,
    Loader2,
    Clock,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
    ChatMessage,
    GenerationStep,
    StepStatus,
} from "@/lib/canvas-types";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { cn } from "@/lib/utils";

function formatTime(isoString: string): string {
    try {
        return new Date(isoString).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "";
    }
}

const MEDIA_TYPE_ICON = {
    "canvas-image": Image,
    "canvas-video": Video,
} as const;

function StepStatusIcon({ status }: { status: StepStatus | undefined }) {
    switch (status) {
        case "done":
            return <Check className="size-3 text-green-500" />;
        case "generating":
            return <Loader2 className="size-3 animate-spin text-blue-500" />;
        case "error":
            return <X className="size-3 text-red-500" />;
        default:
            return <Clock className="text-muted-foreground size-3" />;
    }
}

function PlanCard({
    steps,
    messageId,
}: {
    steps: GenerationStep[];
    messageId: string;
}) {
    const stepStatuses =
        useCanvasStore((s) => s.planStepStatuses[messageId]) ?? {};

    const doneCount = steps.filter((s) => stepStatuses[s.id] === "done").length;

    return (
        <div className="bg-muted/60 mt-1.5 rounded-lg border p-2.5 text-xs">
            <p className="text-muted-foreground mb-2 font-medium">
                {doneCount === steps.length && steps.length > 0
                    ? `${steps.length} generation${steps.length > 1 ? "s" : ""} complete`
                    : `${steps.length} generation${steps.length > 1 ? "s" : ""} planned`}
            </p>
            <ul className="space-y-1.5">
                {steps.map((step) => {
                    const status = stepStatuses[step.id] as
                        | StepStatus
                        | undefined;
                    return (
                        <li key={step.id} className="flex items-center gap-2">
                            <StepStatusIcon status={status} />
                            <span
                                className={cn(
                                    "truncate",
                                    status === "done" && "text-foreground",
                                    status === "generating" &&
                                        "text-blue-600 dark:text-blue-400",
                                    status === "error" &&
                                        "text-red-500 line-through",
                                    !status && "text-muted-foreground",
                                )}
                            >
                                {step.label ??
                                    (step.type === "image" ? "Image" : "Video")}
                            </span>
                            {status === "generating" && (
                                <span className="text-muted-foreground shrink-0">
                                    generating…
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function TypingDots() {
    return (
        <div className="flex items-center gap-1 py-0.5">
            {[0, 150, 300].map((delay) => (
                <span
                    key={delay}
                    className="bg-muted-foreground/50 size-1.5 animate-bounce rounded-full"
                    style={{
                        animationDelay: `${delay}ms`,
                        animationDuration: "900ms",
                    }}
                />
            ))}
        </div>
    );
}

function CanvasChatMessageComponent({
    message,
    isLiveAssistant = false,
}: {
    message: ChatMessage;
    isLiveAssistant?: boolean;
}) {
    const isUser = message.role === "user";
    const isSystem = message.role === "system";
    const isChatLoading = useCanvasStore((s) => s.isChatLoading);
    const setPendingActionPrompt = useCanvasStore(
        (s) => s.setPendingActionPrompt,
    );

    const handleActionClick = useCallback(
        (prompt: string) => {
            if (isChatLoading) return;
            setPendingActionPrompt(prompt);
        },
        [isChatLoading, setPendingActionPrompt],
    );

    if (isSystem) {
        return (
            <div className="flex justify-center px-4 py-2">
                <span className="text-muted-foreground text-xs italic">
                    {message.content}
                </span>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "flex gap-2.5 px-4 py-3",
                isUser && "flex-row-reverse",
            )}
        >
            <div
                className={cn(
                    "relative flex size-7 shrink-0 items-center justify-center rounded-full",
                    isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                )}
            >
                {isUser ? (
                    <User className="size-3.5" />
                ) : (
                    <Bot className="size-3.5" />
                )}
                {isLiveAssistant && (
                    <span className="bg-primary absolute -right-0.5 -bottom-0.5 size-2 animate-pulse rounded-full" />
                )}
            </div>

            <div
                className={cn(
                    "flex max-w-[85%] min-w-0 flex-col gap-1",
                    isUser && "items-end",
                )}
            >
                {message.attachments && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {message.attachments.map((att) => {
                            const Icon = MEDIA_TYPE_ICON[att.type];
                            return (
                                <span
                                    key={att.nodeId}
                                    className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                                >
                                    <Icon className="size-3" />
                                    {att.label}
                                </span>
                            );
                        })}
                    </div>
                )}

                <div
                    className={cn(
                        "rounded-xl px-3 py-2 text-sm",
                        isUser
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground",
                    )}
                >
                    {isUser ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : message.content === "" && isLiveAssistant ? (
                        <TypingDots />
                    ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&_ol]:my-1 [&_p]:my-1 [&_pre]:my-2 [&_ul]:my-1">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {message.content}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>

                {!isUser && message.plan && message.plan.steps.length > 0 && (
                    <PlanCard
                        steps={message.plan.steps}
                        messageId={message.id}
                    />
                )}

                {message.generatedMedia &&
                    message.generatedMedia.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {message.generatedMedia.map((media) => {
                                const Icon = MEDIA_TYPE_ICON[media.type];
                                return (
                                    <span
                                        key={media.nodeId}
                                        className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                                    >
                                        <Icon className="size-3" />
                                        Generated
                                    </span>
                                );
                            })}
                        </div>
                    )}

                {!isUser && message.actions && message.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {message.actions.map((action) => (
                            <Button
                                key={action.id}
                                variant="outline"
                                size="sm"
                                disabled={isChatLoading}
                                onClick={() => handleActionClick(action.prompt)}
                                className="h-7 gap-1.5 rounded-full px-3 text-xs"
                            >
                                <Zap className="size-3" />
                                {action.label}
                            </Button>
                        ))}
                    </div>
                )}

                <span className="text-muted-foreground px-1 text-[10px]">
                    {formatTime(message.createdAt)}
                </span>
            </div>
        </div>
    );
}

export const CanvasChatMessage = memo(
    CanvasChatMessageComponent,
) as typeof CanvasChatMessageComponent;
