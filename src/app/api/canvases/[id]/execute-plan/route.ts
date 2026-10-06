import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canvasService } from "@/lib/services/canvas.service";
import { styleService } from "@/lib/services/style.service";
import { STYLE_TEMPLATES } from "@/lib/styles/style-templates";
import { executePlan } from "@/lib/canvas/generation";
import {
    rulesetService,
    type RulesetDocument,
} from "@/lib/services/ruleset.service";
import logger from "@/app/logger";
import type { AgentPlan, CanvasNode } from "@/lib/canvas/types";
import { isGcsUri } from "@/lib/utils/gcs-uri";

export const maxDuration = 300;

interface ExecutePlanRequestBody {
    plan: AgentPlan;
    messageId: string;
    styleId?: string;
    musicModel?: string;
}

function formatSSE(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function buildNodeUriMap(canvas: { nodes: CanvasNode[] }): Map<string, string> {
    const map = new Map<string, string>();
    for (const node of canvas.nodes) {
        const uri = "sourceUrl" in node.data ? node.data.sourceUrl : undefined;
        if (isGcsUri(uri)) {
            map.set(node.id, uri);
        }
    }
    return map;
}

function buildNodeTypeMap(canvas: {
    nodes: CanvasNode[];
}): Map<string, string> {
    const map = new Map<string, string>();
    for (const node of canvas.nodes) {
        map.set(node.id, node.type);
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

    if (body.plan.steps.length > 20) {
        return NextResponse.json(
            { error: "Plan exceeds maximum of 20 steps" },
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
        logger.error("[ExecutePlanAPI] Error fetching canvas:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }

    // Resolve active ruleset
    let activeRuleset: RulesetDocument | undefined;
    if (canvas.activeRulesetId) {
        try {
            activeRuleset = await rulesetService.getRuleset(
                canvas.activeRulesetId,
                session.user.id,
                session.user.email ?? undefined,
            );
        } catch {
            logger.warn(
                `[ExecutePlanAPI] Could not fetch active ruleset: ${canvas.activeRulesetId}`,
            );
        }
    }

    // Resolve active style — use request-body override (for regeneration) or canvas default
    const resolvedStyleId = body.styleId ?? canvas.activeStyleId;
    let activeStyleContent: string | undefined;
    let activeStyleName: string | undefined;
    if (resolvedStyleId) {
        const template = STYLE_TEMPLATES.find((t) => t.id === resolvedStyleId);
        if (template) {
            activeStyleContent = template.content;
            activeStyleName = template.name;
        } else {
            try {
                const style = await styleService.getStyle(
                    resolvedStyleId,
                    session.user.id,
                );
                activeStyleContent = style.content;
                activeStyleName = style.name;
            } catch {
                logger.warn(
                    `[ExecutePlanAPI] Could not fetch active style: ${resolvedStyleId}`,
                );
            }
        }
    }

    const nodeUriMap = buildNodeUriMap(canvas);
    const nodeTypeMap = buildNodeTypeMap(canvas);
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
                for await (const stepEvent of executePlan(
                    body.plan,
                    nodeUriMap,
                    session.user.id!,
                    canvasId,
                    canvas.name,
                    activeStyleContent,
                    resolvedStyleId ?? undefined,
                    activeStyleName,
                    body.musicModel,
                    nodeTypeMap,
                    canvas.nodes,
                    canvas.activeRulesetId ?? undefined,
                    activeRuleset,
                )) {
                    if (req.signal.aborted) break;
                    switch (stepEvent.type) {
                        case "step_start":
                            safeEnqueue(
                                encode(
                                    formatSSE("step_start", {
                                        stepId: stepEvent.stepId,
                                    }),
                                ),
                            );
                            break;
                        case "step_done":
                            safeEnqueue(
                                encode(
                                    formatSSE("step_done", {
                                        stepId: stepEvent.stepId,
                                        node: stepEvent.node,
                                    }),
                                ),
                            );
                            break;
                        case "step_validated":
                            safeEnqueue(
                                encode(
                                    formatSSE("step_validated", {
                                        stepId: stepEvent.stepId,
                                        validationResults:
                                            stepEvent.validationResults,
                                        node: stepEvent.node,
                                    }),
                                ),
                            );
                            break;
                        case "step_error":
                            safeEnqueue(
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

                safeEnqueue(encode(formatSSE("done", {})));
            } catch (error) {
                logger.error("[ExecutePlanAPI] Stream error:", error);
                safeEnqueue(
                    encode(
                        formatSSE("error", {
                            message:
                                error instanceof Error
                                    ? error.message
                                    : "Execution failed",
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
