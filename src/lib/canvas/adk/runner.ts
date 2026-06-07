import {
    Gemini,
    LlmAgent,
    LogLevel,
    Runner,
    StreamingMode,
    getFunctionCalls,
    setLogLevel,
    type BaseSessionService,
} from "@google/adk";

if (process.env.ADK_LOG_LEVEL === "debug") {
    setLogLevel(LogLevel.DEBUG);
}
import { createPartFromText, createPartFromUri } from "@google/genai";
import type { Content } from "@google/genai";
import type { Event } from "@google/adk";
import { applyVideoFallback } from "../agent";
import {
    planImageGenerationTool,
    planVideoGenerationTool,
    suggestActionsTool,
} from "./tools";
import { createSessionService } from "./session";
import { config } from "@/lib/config";
import { MODELS } from "@/lib/constants";
import logger from "@/app/logger";
import type {
    AgentEvent,
    AgentInput,
    MediaDefaults,
    VideoDefaults,
} from "../agent";
import type {
    AgentPlan,
    ChatAction,
    ChatAttachment,
    GenerationStep,
} from "../types";

const APP_NAME = "flowcraft-canvas";

const SYSTEM_PROMPT = `You are a creative media assistant inside a visual canvas workspace. You help users generate and iterate on images and videos.

Your capabilities:
- Generate images from text descriptions
- Generate videos from text descriptions or from existing images (image-to-video)
- Edit and iterate on existing canvas images by using them as reference
- Discuss and refine creative ideas
- Understand natural-language generation config (aspect ratio, resolution, duration)
- Plan multi-step generation workflows (e.g. "generate 4 variants", "make a portrait then animate it")

Guidelines:
- Be concise and helpful. Focus on the creative task at hand.
- When the user asks you to create something visual, respond with a brief acknowledgment of what you'll generate and how many steps the plan involves.
- When the user shares canvas items (via selection or @mention), they will be attached as multimodal content. ALWAYS reference these items by their exact label in your response.
- When iterating on an existing item, acknowledge which item you're working from. The referenced item will be passed as input to the generation model automatically.
- When the user asks to "animate" or "make a video from" an image, call plan_video_generation with firstFrameNodeId set to the image's node ID.
- If the user specifies aspect ratio, resolution, or duration, include those in the generation step.
- Do NOT use markdown image or video syntax. Media is generated separately and placed on the canvas.
- IMPORTANT: Never end your response with a question. State what you will create and proceed.
- IMPORTANT: After every response, call suggest_actions with 2-3 short follow-up ideas.
- IMPORTANT: When you need to generate media, call the appropriate planning tool (plan_image_generation or plan_video_generation). Do NOT describe the generation steps in text.`;

function getModeInstruction(mode: "auto" | "image" | "video"): string {
    switch (mode) {
        case "image":
            return "\n\nIMPORTANT: The user has selected IMAGE mode. You MUST call plan_image_generation.";
        case "video":
            return "\n\nIMPORTANT: The user has selected VIDEO mode. You MUST call plan_video_generation.";
        default:
            return "\n\nAUTO mode: Decide if the request needs media generation. If visual, call the appropriate planning tool.";
    }
}

function buildCanvasContext(nodes: AgentInput["canvasNodes"]): string {
    if (nodes.length === 0) return "";
    const items = nodes.map((n) => {
        const d = n.data;
        let desc = `- ${d.label} (id: ${n.id}, type: ${n.type.replace("canvas-", "")})`;
        if ("prompt" in d && d.prompt) desc += ` — prompt: "${d.prompt}"`;
        if ("status" in d) desc += ` [${d.status}]`;
        return desc;
    });
    return `\n\nCurrent canvas items:\n${items.join("\n")}\nIMPORTANT: Only use node IDs that appear in this list.`;
}

function buildStyleInstruction(
    style: { name: string; content: string } | null | undefined,
): string {
    if (!style) return "";
    return `\n\n## Active Style: ${style.name}\nApply this style to EVERY generation step:\n\n${style.content}`;
}

function buildUserContent(input: AgentInput): Content {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [];

    if (input.attachments && input.attachments.length > 0) {
        const labels: string[] = [];
        for (const att of input.attachments) {
            const node = input.canvasNodes.find((n) => n.id === att.nodeId);
            if (!node) continue;
            if (
                node.type === "canvas-text" &&
                "content" in node.data &&
                node.data.content
            ) {
                labels.push(`[${att.label} (id: ${att.nodeId}, type: text)]`);
                parts.push(
                    createPartFromText(
                        `Content of "${att.label}":\n${(node.data.content as string).trim()}`,
                    ),
                );
            } else if ("sourceUrl" in node.data && node.data.sourceUrl) {
                const src = node.data.sourceUrl as string;
                if (src.startsWith("gs://")) {
                    const mime =
                        ("mimeType" in node.data
                            ? (node.data.mimeType as string)
                            : null) ||
                        (node.type === "canvas-video"
                            ? "video/mp4"
                            : "image/png");
                    labels.push(
                        `[${att.label} (id: ${att.nodeId}, type: ${node.type.replace("canvas-", "")})]`,
                    );
                    parts.push(createPartFromUri(src, mime));
                }
            }
        }
        if (labels.length > 0) {
            parts.unshift(
                createPartFromText(
                    `The user shared these canvas items: ${labels.join(", ")}. Media files follow.`,
                ),
            );
        }
    }

    parts.push(createPartFromText(input.message));
    return { role: "user", parts };
}

function validateStepNodeIds(
    step: GenerationStep,
    canvasNodeIds: string[],
    attachmentNodeIds: string[],
): GenerationStep {
    const isValidId = (id: string) =>
        canvasNodeIds.includes(id) || attachmentNodeIds.includes(id);

    const validated = { ...step };

    if (step.referenceNodeIds && step.referenceNodeIds.length > 0) {
        const valid = step.referenceNodeIds.filter(isValidId);
        if (valid.length < step.referenceNodeIds.length) {
            logger.warn("[CanvasADK] Ignored hallucinated referenceNodeIds");
        }
        validated.referenceNodeIds = valid.length > 0 ? valid : undefined;
    }

    if (step.firstFrameNodeId && !isValidId(step.firstFrameNodeId)) {
        logger.warn(
            `[CanvasADK] Ignored hallucinated firstFrameNodeId: ${step.firstFrameNodeId}`,
        );
        validated.firstFrameNodeId = undefined;
    }

    if (step.lastFrameNodeId && !isValidId(step.lastFrameNodeId)) {
        logger.warn(
            `[CanvasADK] Ignored hallucinated lastFrameNodeId: ${step.lastFrameNodeId}`,
        );
        validated.lastFrameNodeId = undefined;
    }

    return validated;
}

const VALID_IMAGE_MODELS = new Set([
    "gemini-2.5-flash-image",
    "gemini-3-pro-image",
    "gemini-3.1-flash-image",
]);

const VALID_VIDEO_MODELS = new Set([
    "veo-3.1-lite-generate-001",
    "veo-3.1-fast-generate-001",
    "veo-3.1-generate-001",
]);

function resolveModel(
    stepModel: string | undefined,
    defaultModel: string | undefined,
    validModels: Set<string>,
): string | undefined {
    const candidate = stepModel ?? defaultModel;
    if (!candidate) return undefined;
    if (!validModels.has(candidate)) {
        logger.warn(`[CanvasADK] Ignored unrecognized model: ${candidate}`);
        return defaultModel && validModels.has(defaultModel)
            ? defaultModel
            : undefined;
    }
    return candidate;
}

function applyTypeDefaults(
    step: GenerationStep,
    imageDefaults?: MediaDefaults,
    videoDefaults?: VideoDefaults,
): GenerationStep {
    const isVideo = step.type === "video";
    const defaults = isVideo ? videoDefaults : imageDefaults;
    const validModels = isVideo ? VALID_VIDEO_MODELS : VALID_IMAGE_MODELS;
    const resolvedModel = resolveModel(
        step.model,
        defaults?.model,
        validModels,
    );
    return {
        ...step,
        aspectRatio: step.aspectRatio ?? defaults?.aspectRatio ?? "16:9",
        ...((step.resolution ?? defaults?.resolution)
            ? { resolution: step.resolution ?? defaults?.resolution }
            : {}),
        ...(resolvedModel ? { model: resolvedModel } : { model: undefined }),
        ...(isVideo
            ? {
                  generateAudio:
                      step.generateAudio ??
                      (videoDefaults as VideoDefaults | undefined)
                          ?.generateAudio ??
                      false,
                  ...(() => {
                      const raw =
                          step.duration ??
                          (videoDefaults as VideoDefaults | undefined)
                              ?.duration;
                      const valid =
                          raw && [4, 6, 8].includes(raw) ? raw : undefined;
                      return valid ? { duration: valid } : {};
                  })(),
              }
            : {}),
    };
}

export async function* extractAgentEvents(
    adkEvents: AsyncIterable<Event>,
    canvasNodeIds: string[],
    attachments: ChatAttachment[],
    imageDefaults?: MediaDefaults,
    videoDefaults?: VideoDefaults,
): AsyncGenerator<AgentEvent> {
    const attachmentNodeIds = attachments.map((a) => a.nodeId);
    const allSteps: GenerationStep[] = [];
    let actionsEmitted = false;

    for await (const event of adkEvents) {
        logger.debug(
            `[CanvasADK] event author=${event.author} partial=${event.partial} errorCode=${(event as unknown as { errorCode?: string }).errorCode} errorMessage=${(event as unknown as { errorMessage?: string }).errorMessage} parts=${JSON.stringify(event.content?.parts?.map((p) => ({ text: p.text?.slice(0, 80), fc: p.functionCall?.name, fr: p.functionResponse?.name })))}`,
        );

        // Surface ADK error events
        const adkError = event as unknown as {
            errorCode?: string;
            errorMessage?: string;
        };
        if (adkError.errorCode || adkError.errorMessage) {
            logger.error(
                `[CanvasADK] model error ${adkError.errorCode}: ${adkError.errorMessage}`,
            );
            yield {
                type: "text",
                delta: `Error: ${adkError.errorMessage ?? adkError.errorCode}`,
            };
            continue;
        }

        // Emit text from any model event that carries text parts
        if (event.author !== "user" && event.content?.parts) {
            const text = event.content.parts
                .filter((p) => p.text)
                .map((p) => p.text)
                .join("");
            if (text) yield { type: "text", delta: text };
        }

        // Process function calls
        const calls = getFunctionCalls(event);
        for (const call of calls) {
            if (
                call.name === "plan_image_generation" ||
                call.name === "plan_video_generation"
            ) {
                const inferredType =
                    call.name === "plan_video_generation" ? "video" : "image";
                const raw = (call.args as { steps?: unknown[] })?.steps ?? [];
                const steps = (raw as GenerationStep[]).map((s, i) => {
                    const sWithType: GenerationStep = {
                        ...s,
                        type: inferredType,
                    };
                    let step = applyTypeDefaults(
                        sWithType,
                        imageDefaults,
                        videoDefaults,
                    );
                    step = validateStepNodeIds(
                        step,
                        canvasNodeIds,
                        attachmentNodeIds,
                    );
                    applyVideoFallback(
                        step,
                        inferredType,
                        attachments,
                        i,
                        raw.length,
                    );
                    return step;
                });
                allSteps.push(...steps);
            }

            if (call.name === "suggest_actions" && !actionsEmitted) {
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

    if (allSteps.length > 0) {
        const plan: AgentPlan = { steps: allSteps };
        yield { type: "plan", plan };
    }

    yield { type: "done" };
}

export interface CanvasAgentRunnerConfig {
    sessionService?: BaseSessionService;
}

export class CanvasAgentRunner {
    private readonly sessionService: BaseSessionService;
    constructor(runnerConfig: CanvasAgentRunnerConfig = {}) {
        this.sessionService =
            runnerConfig.sessionService ?? createSessionService();
    }

    private buildAgentA(model: string, instruction: string): LlmAgent {
        return new LlmAgent({
            name: "CanvasAgentA",
            model: new Gemini({
                model,
                vertexai: true,
                project: config.PROJECT_ID,
                location: config.LOCATION,
            }),
            instruction,
            tools: [
                planImageGenerationTool,
                planVideoGenerationTool,
                suggestActionsTool,
            ],
        });
    }

    private buildAgentB(model: string, instruction: string): LlmAgent {
        return new LlmAgent({
            name: "CanvasAgentB",
            model: new Gemini({
                model,
                vertexai: true,
                project: config.PROJECT_ID,
                location: config.LOCATION,
            }),
            instruction,
            tools: [
                planImageGenerationTool,
                planVideoGenerationTool,
                suggestActionsTool,
            ],
        });
    }

    private getRunner(
        model: string,
        instruction: string,
        variant: "a" | "b" = "a",
    ): Runner {
        const agent =
            variant === "b"
                ? this.buildAgentB(model, instruction)
                : this.buildAgentA(model, instruction);

        return new Runner({
            appName: APP_NAME,
            agent,
            sessionService: this.sessionService,
        });
    }

    async *stream(input: AgentInput): AsyncGenerator<AgentEvent> {
        const model = input.model || MODELS.TEXT.GEMINI_3_5_FLASH;

        const instruction = [
            SYSTEM_PROMPT,
            getModeInstruction(input.mode),
            buildCanvasContext(input.canvasNodes),
            buildStyleInstruction(input.activeStyle),
        ].join("");

        const runner = this.getRunner(
            model,
            instruction,
            input.agentVariant ?? "a",
        );

        const userId = input.userId ?? "anon";
        const sessionId =
            input.sessionId ?? `${userId}:${input.canvasId ?? "default"}`;

        try {
            await this.sessionService.createSession({
                appName: APP_NAME,
                userId,
                sessionId,
            });
        } catch {
            // Session may already exist — that's fine
        }

        const userContent = buildUserContent(input);

        logger.info(
            `[CanvasADK] stream variant=${input.agentVariant ?? "a"} mode=${input.mode} model=${model} attachments=${input.attachments?.length ?? 0}`,
        );

        try {
            const adkEvents = runner.runAsync({
                userId,
                sessionId,
                newMessage: userContent,
                runConfig: { streamingMode: StreamingMode.SSE },
            });

            yield* extractAgentEvents(
                adkEvents,
                input.canvasNodes.map((n) => n.id),
                input.attachments ?? [],
                input.imageDefaults,
                input.videoDefaults,
            );
        } catch (error) {
            logger.error("[CanvasADK] stream error:", error);
            yield {
                type: "text",
                delta: "Sorry, I encountered an error processing your request.",
            };
            yield { type: "done" };
        }
    }
}
