import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canvasService } from "@/lib/services/canvas.service";
import { styleService } from "@/lib/services/style.service";
import { rulesetService } from "@/lib/services/ruleset.service";
import { STYLE_TEMPLATES } from "@/lib/styles/style-templates";
import { CanvasAgentRunner } from "@/lib/canvas/agent/agent-runner";
import {
    IMAGE_MODELS,
    VIDEO_MODELS,
    IMAGE_ASPECT_RATIOS,
    VIDEO_ASPECT_RATIOS,
} from "@/lib/canvas/agent/tools";
import type { ChatAttachment, RulesetRef } from "@/lib/canvas/types";
import { MODELS, IMAGE_SIZES, VIDEO_RESOLUTIONS } from "@/lib/constants";
import logger from "@/app/logger";

const ALLOWED_TEXT_MODELS = new Set(Object.values(MODELS.TEXT));
const ALLOWED_IMAGE_MODELS = new Set<string>(IMAGE_MODELS);
const ALLOWED_VIDEO_MODELS = new Set<string>(VIDEO_MODELS);
const ALLOWED_IMAGE_ASPECT_RATIOS = new Set<string>(IMAGE_ASPECT_RATIOS);
const ALLOWED_VIDEO_ASPECT_RATIOS = new Set<string>(VIDEO_ASPECT_RATIOS);
const ALLOWED_IMAGE_SIZES = new Set<string>(IMAGE_SIZES);
const ALLOWED_VIDEO_RESOLUTIONS = new Set<string>(VIDEO_RESOLUTIONS);

const agentRunner = new CanvasAgentRunner();

export const maxDuration = 300;

interface MediaDefaults {
    model?: string;
    aspectRatio?: string;
    imageSize?: string;
}

interface VideoDefaultsBody extends MediaDefaults {
    resolution?: string;
    duration?: number;
    generateAudio?: boolean;
}

interface ChatRequestBody {
    message: string;
    attachments?: ChatAttachment[];
    mode: "auto" | "image" | "video";
    model?: string;
    sessionId?: string;
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

    if (body.message.length > 32768) {
        return NextResponse.json(
            { error: "message exceeds maximum allowed length" },
            { status: 400 },
        );
    }

    if (!["auto", "image", "video"].includes(body.mode)) {
        return NextResponse.json(
            { error: "mode must be auto, image, or video" },
            { status: 400 },
        );
    }

    if (
        body.model !== undefined &&
        !ALLOWED_TEXT_MODELS.has(body.model as never)
    ) {
        return NextResponse.json({ error: "Invalid model" }, { status: 400 });
    }

    const img = body.imageDefaults;
    if (img) {
        if (img.model !== undefined && !ALLOWED_IMAGE_MODELS.has(img.model))
            return NextResponse.json(
                { error: "Invalid imageDefaults.model" },
                { status: 400 },
            );
        if (
            img.aspectRatio !== undefined &&
            !ALLOWED_IMAGE_ASPECT_RATIOS.has(img.aspectRatio)
        )
            return NextResponse.json(
                { error: "Invalid imageDefaults.aspectRatio" },
                { status: 400 },
            );
        if (
            img.imageSize !== undefined &&
            !ALLOWED_IMAGE_SIZES.has(img.imageSize)
        )
            return NextResponse.json(
                { error: "Invalid imageDefaults.imageSize" },
                { status: 400 },
            );
    }

    const vid = body.videoDefaults;
    if (vid) {
        if (vid.model !== undefined && !ALLOWED_VIDEO_MODELS.has(vid.model))
            return NextResponse.json(
                { error: "Invalid videoDefaults.model" },
                { status: 400 },
            );
        if (
            vid.aspectRatio !== undefined &&
            !ALLOWED_VIDEO_ASPECT_RATIOS.has(vid.aspectRatio)
        )
            return NextResponse.json(
                { error: "Invalid videoDefaults.aspectRatio" },
                { status: 400 },
            );
        if (
            vid.resolution !== undefined &&
            !ALLOWED_VIDEO_RESOLUTIONS.has(vid.resolution)
        )
            return NextResponse.json(
                { error: "Invalid videoDefaults.resolution" },
                { status: 400 },
            );
    }

    let canvas;
    try {
        const getCanvasFn =
            typeof canvasService.getCanvasForEdit === "function"
                ? canvasService.getCanvasForEdit.bind(canvasService)
                : canvasService.getCanvas.bind(canvasService);
        canvas = await getCanvasFn(
            canvasId,
            session.user.id,
            session.user.email ?? undefined,
        );
    } catch (error) {
        if (error instanceof Error) {
            if (
                error.name === "CanvasNotFoundError" ||
                error.message.startsWith("Canvas not found")
            ) {
                return NextResponse.json(
                    { error: "Canvas not found" },
                    { status: 404 },
                );
            }
            if (
                error.name === "CanvasForbiddenError" ||
                error.message === "Unauthorized" ||
                error.message === "Forbidden"
            ) {
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

    // Resolve active ruleset for preventive injection
    let activeRuleset: RulesetRef | null = null;
    if (canvas.activeRulesetId) {
        try {
            const ruleset = await rulesetService.getRuleset(
                canvas.activeRulesetId,
                session.user.id,
                session.user.email ?? undefined,
            );
            activeRuleset = {
                name: ruleset.name,
                rules: ruleset.rules,
            };
        } catch {
            logger.warn(
                `[ChatAPI] Could not fetch active ruleset: ${canvas.activeRulesetId}`,
            );
        }
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
            const safeEnqueue = (chunk: Uint8Array) => {
                if (req.signal.aborted) return;
                try {
                    controller.enqueue(chunk);
                } catch {
                    // Stream closed by client disconnect
                }
            };

            try {
                const agentStream = agentRunner.stream({
                    message: body.message,
                    attachments: body.attachments,
                    mode: body.mode,
                    model: body.model,
                    sessionId: body.sessionId,
                    history: canvas.messages,
                    canvasNodes: canvas.nodes,
                    imageDefaults: body.imageDefaults,
                    videoDefaults: body.videoDefaults,
                    activeStyle,
                    activeRuleset,
                    canvasId,
                    userId: session.user.id,
                    userName: session.user.name ?? undefined,
                    disabledSkills: canvas.disabledSkills,
                });

                for await (const event of agentStream) {
                    if (req.signal.aborted) break;
                    switch (event.type) {
                        case "text":
                            safeEnqueue(
                                encode(
                                    formatSSE("text", { delta: event.delta }),
                                ),
                            );
                            break;

                        case "thought":
                            safeEnqueue(
                                encode(
                                    formatSSE("thought", {
                                        delta: event.delta,
                                    }),
                                ),
                            );
                            break;

                        case "agent_action":
                            safeEnqueue(
                                encode(
                                    formatSSE("agent_action", {
                                        label: event.label,
                                    }),
                                ),
                            );
                            break;

                        case "plan":
                            // Send the plan to the client for approval — execution
                            // is triggered separately via /execute-plan when user confirms.
                            safeEnqueue(
                                encode(
                                    formatSSE("plan", {
                                        steps: event.plan.steps,
                                    }),
                                ),
                            );
                            break;

                        case "actions":
                            safeEnqueue(
                                encode(
                                    formatSSE("actions", {
                                        actions: event.actions,
                                    }),
                                ),
                            );
                            break;

                        case "text_nodes":
                            safeEnqueue(
                                encode(
                                    formatSSE("text_nodes", {
                                        nodes: event.nodes,
                                    }),
                                ),
                            );
                            break;

                        case "question":
                            safeEnqueue(
                                encode(formatSSE("question", event.question)),
                            );
                            break;

                        case "error":
                            safeEnqueue(
                                encode(
                                    formatSSE("error", {
                                        message: event.message,
                                    }),
                                ),
                            );
                            break;

                        case "done":
                            safeEnqueue(encode(formatSSE("done", {})));
                            break;

                        default:
                            logger.warn(
                                `[ChatAPI] Unknown event type: ${(event as { type: string }).type}`,
                            );
                    }
                }
            } catch (error) {
                logger.error("[ChatAPI] Stream error:", error);
                safeEnqueue(
                    encode(
                        formatSSE("error", {
                            message:
                                error instanceof Error
                                    ? error.message
                                    : "Stream failed",
                        }),
                    ),
                );
                safeEnqueue(encode(formatSSE("done", {})));
            } finally {
                try {
                    controller.close();
                } catch {
                    // Already closed
                }
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
