import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canvasService } from "@/lib/services/canvas.service";
import { styleService } from "@/lib/services/style.service";
import { STYLE_TEMPLATES } from "@/lib/style-templates";
import { streamAgentResponse } from "@/lib/canvas-agent";
import logger from "@/app/logger";
import type { ChatAttachment } from "@/lib/canvas-types";

export const maxDuration = 300;

interface MediaDefaults {
    model?: string;
    aspectRatio?: string;
    resolution?: string;
}

interface VideoDefaultsBody extends MediaDefaults {
    duration?: number;
    generateAudio?: boolean;
}

interface ChatRequestBody {
    message: string;
    attachments?: ChatAttachment[];
    mode: "auto" | "image" | "video";
    model?: string;
    imageDefaults?: MediaDefaults;
    videoDefaults?: VideoDefaultsBody;
}

function formatSSE(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: canvasId } = await params;

    let body: ChatRequestBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 },
        );
    }

    if (!body.message || typeof body.message !== "string") {
        return NextResponse.json(
            { error: "message is required" },
            { status: 400 },
        );
    }

    if (!["auto", "image", "video"].includes(body.mode)) {
        return NextResponse.json(
            { error: "mode must be auto, image, or video" },
            { status: 400 },
        );
    }

    let canvas;
    try {
        canvas = await canvasService.getCanvas(canvasId, session.user.id);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === "Canvas not found") {
                return NextResponse.json(
                    { error: "Canvas not found" },
                    { status: 404 },
                );
            }
            if (error.message === "Unauthorized") {
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 403 },
                );
            }
        }
        logger.error("[ChatAPI] Error fetching canvas:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }

    // Resolve active style content
    let activeStyle: { name: string; content: string } | null = null;
    if (canvas.activeStyleId) {
        const template = STYLE_TEMPLATES.find(
            (t) => t.id === canvas.activeStyleId,
        );
        if (template) {
            activeStyle = { name: template.name, content: template.content };
        } else {
            try {
                const style = await styleService.getStyle(
                    canvas.activeStyleId,
                    session.user.id,
                );
                activeStyle = { name: style.name, content: style.content };
            } catch {
                logger.warn(
                    `[ChatAPI] Could not fetch active style: ${canvas.activeStyleId}`,
                );
            }
        }
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const encode = (payload: string) => encoder.encode(payload);

            try {
                const agentStream = streamAgentResponse({
                    message: body.message,
                    attachments: body.attachments,
                    mode: body.mode,
                    model: body.model,
                    history: canvas.messages,
                    canvasNodes: canvas.nodes,
                    imageDefaults: body.imageDefaults,
                    videoDefaults: body.videoDefaults,
                    activeStyle,
                });

                for await (const event of agentStream) {
                    switch (event.type) {
                        case "text":
                            controller.enqueue(
                                encode(
                                    formatSSE("text", { delta: event.delta }),
                                ),
                            );
                            break;

                        case "plan":
                            // Send the plan to the client for approval — execution
                            // is triggered separately via /execute-plan when user confirms.
                            controller.enqueue(
                                encode(
                                    formatSSE("plan", {
                                        steps: event.plan.steps,
                                    }),
                                ),
                            );
                            break;

                        case "actions":
                            controller.enqueue(
                                encode(
                                    formatSSE("actions", {
                                        actions: event.actions,
                                    }),
                                ),
                            );
                            break;

                        case "done":
                            controller.enqueue(encode(formatSSE("done", {})));
                            break;

                        default:
                            logger.warn(
                                `[ChatAPI] Unknown event type: ${(event as { type: string }).type}`,
                            );
                    }
                }
            } catch (error) {
                logger.error("[ChatAPI] Stream error:", error);
                controller.enqueue(
                    encode(
                        formatSSE("error", {
                            message:
                                error instanceof Error
                                    ? error.message
                                    : "Stream failed",
                        }),
                    ),
                );
                controller.enqueue(encode(formatSSE("done", {})));
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
