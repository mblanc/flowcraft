import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canvasService } from "@/lib/services/canvas.service";
import { streamAgentResponse } from "@/lib/canvas-agent";
import logger from "@/app/logger";
import type { ChatAttachment } from "@/lib/canvas-types";

export const maxDuration = 60;

interface ChatRequestBody {
    message: string;
    attachments?: ChatAttachment[];
    mode: "auto" | "image" | "video";
    model?: string;
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
        canvas = await canvasService.getCanvas(
            canvasId,
            session.user.id,
            session.user.email ?? undefined,
        );
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

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const agentStream = streamAgentResponse({
                    message: body.message,
                    attachments: body.attachments,
                    mode: body.mode,
                    model: body.model,
                    history: canvas.messages,
                    canvasNodes: canvas.nodes,
                });

                for await (const event of agentStream) {
                    let ssePayload: string;
                    switch (event.type) {
                        case "text":
                            ssePayload = formatSSE("text", {
                                delta: event.delta,
                            });
                            break;
                        case "media":
                            ssePayload = formatSSE("media", event.media);
                            break;
                        case "actions":
                            ssePayload = formatSSE("actions", {
                                actions: event.actions,
                            });
                            break;
                        case "done":
                            ssePayload = formatSSE("done", {});
                            break;
                    }
                    controller.enqueue(encoder.encode(ssePayload));
                }
            } catch (error) {
                logger.error("[ChatAPI] Stream error:", error);
                controller.enqueue(
                    encoder.encode(
                        formatSSE("error", {
                            message:
                                error instanceof Error
                                    ? error.message
                                    : "Stream failed",
                        }),
                    ),
                );
                controller.enqueue(
                    encoder.encode(formatSSE("done", {})),
                );
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
