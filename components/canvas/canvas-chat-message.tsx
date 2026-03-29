"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Bot, Image, Video } from "lucide-react";
import type { ChatMessage } from "@/lib/canvas-types";
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

function CanvasChatMessageComponent({ message }: { message: ChatMessage }) {
    const isUser = message.role === "user";
    const isSystem = message.role === "system";

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
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
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
                    ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&_ol]:my-1 [&_p]:my-1 [&_pre]:my-2 [&_ul]:my-1">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {message.content}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>

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

                <span className="text-muted-foreground px-1 text-[10px]">
                    {formatTime(message.createdAt)}
                </span>
            </div>
        </div>
    );
}

export const CanvasChatMessage = memo(CanvasChatMessageComponent);
