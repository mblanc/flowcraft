import { getFunctionCalls } from "@google/adk";
import type { Event } from "@google/adk";
import logger from "@/app/logger";
import { mapPlanNodesToSteps, mapSimpleSteps } from "./step-mapper";
import type {
    AgentEvent,
    AgentPlan,
    CanvasNode,
    ChatAction,
    ChatAttachment,
    GenerationStep,
    MediaDefaults,
    PlanNode,
    QuestionOption,
    QuestionPayload,
    TextNodePayload,
    VideoDefaults,
} from "../types";

export async function* extractAgentEvents(
    adkEvents: AsyncIterable<Event>,
    canvasNodes: CanvasNode[],
    attachments: ChatAttachment[],
    imageDefaults?: MediaDefaults,
    videoDefaults?: VideoDefaults,
): AsyncGenerator<AgentEvent> {
    const canvasNodeIds = canvasNodes.map((n) => n.id);
    const allSteps: GenerationStep[] = [];
    let actionsEmitted = false;

    for await (const event of adkEvents) {
        logger.debug(
            `[CanvasADK] event author=${event.author} partial=${event.partial} errorCode=${(event as unknown as { errorCode?: string }).errorCode} errorMessage=${(event as unknown as { errorMessage?: string }).errorMessage} parts=${JSON.stringify(
                event.content?.parts?.map((p) => ({
                    text: p.text?.slice(0, 80),
                    fc: p.functionCall?.name,
                    fcArgs: p.functionCall?.args
                        ? JSON.stringify(p.functionCall.args).slice(0, 200)
                        : undefined,
                    fr: p.functionResponse?.name,
                })),
            )}`,
        );

        const adkError = event as unknown as {
            errorCode?: string;
            errorMessage?: string;
        };
        if (adkError.errorCode || adkError.errorMessage) {
            logger.error(
                `[CanvasADK] model error ${adkError.errorCode}: ${adkError.errorMessage}`,
            );
            yield {
                type: "error",
                message:
                    adkError.errorMessage ??
                    adkError.errorCode ??
                    "Unknown model error",
            };
            continue;
        }

        // Emit text and thoughts from complete (non-partial) model events.
        // With SSE streaming, ADK leaks function call serializations as partial text
        // events before the real fc event fires — skipping partials prevents garbage output.
        if (event.author !== "user" && event.content?.parts && !event.partial) {
            const hasFunctionCalls = getFunctionCalls(event).length > 0;

            const thoughtText = event.content.parts
                .filter((p) => p.thought && p.text)
                .map((p) => p.text)
                .join("");
            if (thoughtText) yield { type: "thought", delta: thoughtText };

            const plainText = event.content.parts
                .filter((p) => !p.thought && p.text)
                .map((p) => p.text)
                .join("");

            if (plainText && !hasFunctionCalls) {
                yield { type: "text", delta: plainText };
            }
        }

        const calls = getFunctionCalls(event);
        for (const call of calls) {
            if (call.name === "list_skills") {
                yield { type: "agent_action", label: "Browsing skills" };
            } else if (call.name === "load_skill") {
                const skillName = (call.args as { name?: string })?.name ?? "";
                yield {
                    type: "agent_action",
                    label: `Loading ${skillName} skill`,
                };
            } else if (
                call.name === "plan_image_generation" ||
                call.name === "plan_video_generation"
            ) {
                const inferredType =
                    call.name === "plan_video_generation" ? "video" : "image";
                const raw = (call.args as { steps?: unknown[] })?.steps ?? [];
                const steps = mapSimpleSteps(
                    raw as GenerationStep[],
                    inferredType,
                    canvasNodeIds,
                    attachments,
                    imageDefaults,
                    videoDefaults,
                );
                allSteps.push(...steps);
            } else if (call.name === "plan_production") {
                yield { type: "agent_action", label: "Planning production" };
                const raw = call.args as {
                    nodes?: PlanNode[];
                    edges?: Array<{ from: string; to: string; role: string }>;
                };
                const steps = mapPlanNodesToSteps(
                    raw.nodes ?? [],
                    raw.edges ?? [],
                    canvasNodes,
                    attachments,
                    imageDefaults,
                    videoDefaults,
                );
                allSteps.push(...steps);
            } else if (call.name === "plan_text_nodes") {
                yield { type: "agent_action", label: "Writing scenario" };
                const raw =
                    (call.args as { nodes?: TextNodePayload[] })?.nodes ?? [];
                if (raw.length > 0) {
                    yield { type: "text_nodes", nodes: raw };
                }
            } else if (call.name === "ask_user") {
                const raw = call.args as {
                    id?: string;
                    question?: string;
                    options?: QuestionOption[];
                };
                const payload: QuestionPayload = {
                    id: raw.id ?? "",
                    question: raw.question ?? "",
                    options: raw.options ?? [],
                };
                yield { type: "question", question: payload };
            } else if (call.name === "suggest_actions" && !actionsEmitted) {
                const raw =
                    (
                        call.args as {
                            actions?: Array<{ label: string; prompt: string }>;
                        }
                    )?.actions ?? [];
                const actions: ChatAction[] = raw.slice(0, 3).map((a, i) => ({
                    id: String(i + 1),
                    label: a.label,
                    prompt: a.prompt,
                }));
                if (actions.length > 0) {
                    yield { type: "actions", actions };
                    actionsEmitted = true;
                }
            }
        }
    }

    // plan is intentionally emitted last — inline events (text_nodes, agent_action)
    // are guaranteed to precede it. The textNodesBeforeProduction eval criterion depends on this.
    if (allSteps.length > 0) {
        const plan: AgentPlan = { steps: allSteps };
        yield { type: "plan", plan };
    }

    yield { type: "done" };
}
