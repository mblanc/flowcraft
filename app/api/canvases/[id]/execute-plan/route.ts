import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canvasService } from "@/lib/services/canvas.service";
import { styleService } from "@/lib/services/style.service";
import { STYLE_TEMPLATES } from "@/lib/style-templates";
import { executePlan } from "@/lib/canvas-generation";
import logger from "@/app/logger";
import type { AgentPlan } from "@/lib/canvas-types";

export const maxDuration = 300;

interface ExecutePlanRequestBody {
    plan: AgentPlan;
    messageId: string;
}

function formatSSE(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function buildNodeUriMap(canvas: {
    nodes: { id: string; data: Record<string, unknown> }[];
}): Map<string, string> {
    const map = new Map<string, string>();
    for (const node of canvas.nodes) {
        const uri = node.data.sourceUrl as string | undefined;
        if (uri?.startsWith("gs://")) {
            map.set(node.id, uri);
        }
    }
    return map;
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

    let body: ExecutePlanRequestBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 },
        );
    }

    if (!body.plan?.steps || !Array.isArray(body.plan.steps)) {
        return NextResponse.json(
            { error: "plan.steps is required" },
            { status: 400 },
        );
    }

    if (!body.messageId || typeof body.messageId !== "string") {
        return NextResponse.json(
            { error: "messageId is required" },
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
        logger.error("[ExecutePlanAPI] Error fetching canvas:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }

    // Resolve active style content for generation injection
    let activeStyleContent: string | undefined;
    if (canvas.activeStyleId) {
        const template = STYLE_TEMPLATES.find(
            (t) => t.id === canvas.activeStyleId,
        );
        if (template) {
            activeStyleContent = template.content;
        } else {
            try {
                const style = await styleService.getStyle(
                    canvas.activeStyleId,
                    session.user.id,
                );
                activeStyleContent = style.content;
            } catch {
                logger.warn(
                    `[ExecutePlanAPI] Could not fetch active style: ${canvas.activeStyleId}`,
                );
            }
        }
    }

    const nodeUriMap = buildNodeUriMap(canvas);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const encode = (payload: string) => encoder.encode(payload);

            try {
                for await (const stepEvent of executePlan(
                    body.plan,
                    nodeUriMap,
                    session.user.id!,
                    canvasId,
                    canvas.name,
                    activeStyleContent,
                )) {
                    switch (stepEvent.type) {
                        case "step_start":
                            controller.enqueue(
                                encode(
                                    formatSSE("step_start", {
                                        stepId: stepEvent.stepId,
                                    }),
                                ),
                            );
                            break;
                        case "step_done":
                            controller.enqueue(
                                encode(
                                    formatSSE("step_done", {
                                        stepId: stepEvent.stepId,
                                        node: stepEvent.node,
                                    }),
                                ),
                            );
                            break;
                        case "step_error":
                            controller.enqueue(
                                encode(
                                    formatSSE("step_error", {
                                        stepId: stepEvent.stepId,
                                        message: stepEvent.message,
                                    }),
                                ),
                            );
                            break;
                    }
                }

                controller.enqueue(encode(formatSSE("done", {})));
            } catch (error) {
                logger.error("[ExecutePlanAPI] Stream error:", error);
                controller.enqueue(
                    encode(
                        formatSSE("error", {
                            message:
                                error instanceof Error
                                    ? error.message
                                    : "Execution failed",
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
