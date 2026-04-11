import {
    Content,
    createPartFromText,
    createPartFromUri,
} from "@google/genai";
import { geminiService } from "@/lib/services/gemini.service";
import { MODELS } from "@/lib/constants";
import logger from "@/app/logger";
import type {
    ChatAttachment,
    ChatMessage,
    CanvasNode,
    ChatAction,
    AgentPlan,
    GenerationStep,
} from "@/lib/canvas-types";

export interface MediaDefaults {
    model?: string;
    aspectRatio?: string;
    resolution?: string;
}

export interface VideoDefaults extends MediaDefaults {
    duration?: number;
    generateAudio?: boolean;
}

export interface AgentInput {
    message: string;
    attachments?: ChatAttachment[];
    mode: "auto" | "image" | "video";
    model?: string;
    history: ChatMessage[];
    canvasNodes: CanvasNode[];
    imageDefaults?: MediaDefaults;
    videoDefaults?: VideoDefaults;
}

export type AgentEvent =
    | { type: "text"; delta: string }
    | { type: "plan"; plan: AgentPlan }
    | { type: "actions"; actions: ChatAction[] }
    | { type: "done" };

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
- When the user shares canvas items (via selection or @mention), they will be attached as multimodal content. ALWAYS reference these items by their exact label (e.g. "Image 1", "Video 2") in your response.
- When iterating on an existing item, acknowledge which item you're working from (e.g. "Based on Image 1, I'll..."). The referenced item will be passed as input to the generation model automatically.
- When the user asks to "animate" or "make a video from" an image, generate a video using the image as a reference.
- If the user specifies aspect ratio (e.g. "square", "portrait", "9:16", "vertical"), resolution (e.g. "1080p", "4K"), or duration (e.g. "8 seconds"), extract and apply those settings.
- Do NOT use markdown image or video syntax. Media will be generated separately and placed on the canvas.
- IMPORTANT: Never end your response with a question. Do not ask the user for clarification or confirmation. Just state what you will create and proceed.
- IMPORTANT: Reply ONLY with natural, conversational language. Do NOT output any JSON objects, ReAct formats, or tool call syntaxes. The actual media generation is automatically handled behind the scenes.`;

function getModeInstruction(mode: "auto" | "image" | "video"): string {
    switch (mode) {
        case "image":
            return "\n\nIMPORTANT: The user has selected IMAGE mode. You MUST generate at least one image based on their request.";
        case "video":
            return "\n\nIMPORTANT: The user has selected VIDEO mode. You MUST generate at least one video based on their request.";
        default:
            return "\n\nThe user is in AUTO mode. Decide whether their request requires generating images, videos, or just a text response. If they ask for something visual, generate the appropriate media.";
    }
}

function buildCanvasContextSummary(nodes: CanvasNode[]): string {
    if (nodes.length === 0) return "";

    const items = nodes.map((n) => {
        const d = n.data;
        let desc = `- ${d.label} (id: ${n.id}, type: ${n.type.replace("canvas-", "")})`;
        if ("prompt" in d && d.prompt) desc += ` — prompt: "${d.prompt}"`;
        if ("status" in d) desc += ` [${d.status}]`;
        return desc;
    });

    return `\n\nCurrent canvas items:\n${items.join("\n")}`;
}

function buildContents(input: AgentInput): Content[] {
    const contents: Content[] = [];

    const historySlice = input.history.slice(-20);
    for (const msg of historySlice) {
        if (msg.role === "system") continue;
        contents.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userParts: any[] = [];

    if (input.attachments && input.attachments.length > 0) {
        const attachmentLabels: string[] = [];

        for (const att of input.attachments) {
            const node = input.canvasNodes.find((n) => n.id === att.nodeId);
            if (node && "sourceUrl" in node.data && node.data.sourceUrl) {
                const sourceUrl = node.data.sourceUrl as string;
                if (sourceUrl.startsWith("gs://")) {
                    const mimeType =
                        ("mimeType" in node.data
                            ? (node.data.mimeType as string)
                            : null) ||
                        (node.type === "canvas-video"
                            ? "video/mp4"
                            : "image/png");
                    attachmentLabels.push(
                        `[${att.label} (id: ${att.nodeId}, type: ${node.type.replace("canvas-", "")})]`,
                    );
                    userParts.push(createPartFromUri(sourceUrl, mimeType));
                }
            }
        }

        if (attachmentLabels.length > 0) {
            userParts.unshift(
                createPartFromText(
                    `The user has shared these canvas items with you: ${attachmentLabels.join(", ")}. The media files follow in order.`,
                ),
            );
        }
    }

    userParts.push(createPartFromText(input.message));
    contents.push({ role: "user", parts: userParts });

    return contents;
}

const AGENT_SCHEMA = {
    type: "OBJECT" as const,
    properties: {
        conversationalText: {
            type: "STRING" as const,
            description:
                "Your natural language reply to the user. Briefly acknowledge what you will create and how many steps the plan involves. Do not ask questions.",
        },
        steps: {
            type: "ARRAY" as const,
            description:
                "List of generation steps. Empty array if no media generation needed.",
            items: {
                type: "OBJECT" as const,
                properties: {
                    id: {
                        type: "STRING" as const,
                        description:
                            'Unique step identifier within this plan (e.g. "step_0", "step_1")',
                    },
                    type: {
                        type: "STRING" as const,
                        enum: ["image", "video"],
                        description: "Type of media to generate",
                    },
                    prompt: {
                        type: "STRING" as const,
                        description:
                            "Detailed generation prompt. Be specific and descriptive.",
                    },
                    label: {
                        type: "STRING" as const,
                        description:
                            "Descriptive label for the generated node based on the prompt context (e.g. 'Golden Retriever', 'Sci-fi Cityscape')",
                    },
                    aspectRatio: {
                        type: "STRING" as const,
                        description:
                            "Aspect ratio (e.g. '16:9', '1:1', '9:16'). Default '16:9'.",
                    },
                    resolution: {
                        type: "STRING" as const,
                        enum: ["512", "1K", "2K", "4K", "720p", "1080p"],
                        description:
                            "Resolution if explicitly specified by the user. Default 1K for images, 720p for videos.",
                    },
                    model: {
                        type: "STRING" as const,
                        description:
                            "Override generation model if the user explicitly requests one.",
                    },
                    duration: {
                        type: "NUMBER" as const,
                        description:
                            "Video duration in seconds (4, 6, or 8). Only for video.",
                    },
                    generateAudio: {
                        type: "BOOLEAN" as const,
                        description:
                            "For video: generate audio. Set true only if user explicitly requests audio/sound/music/narration. Default false.",
                    },
                    referenceNodeIds: {
                        type: "ARRAY" as const,
                        items: { type: "STRING" as const },
                        description:
                            "IDs of existing canvas items to use as generic references. For image editing and style transfer.",
                    },
                    firstFrameNodeId: {
                        type: "STRING" as const,
                        description:
                            "For video: exact ID of the canvas item to use as first frame.",
                    },
                    lastFrameNodeId: {
                        type: "STRING" as const,
                        description:
                            "For video: exact ID of the canvas item to use as last frame.",
                    },
                    dependsOn: {
                        type: "ARRAY" as const,
                        items: { type: "STRING" as const },
                        description:
                            "Step IDs from this plan whose output should be used as reference. Use for sequential workflows like 'generate portrait then animate it'.",
                    },
                },
                required: ["id", "type", "prompt", "label"],
            },
        },
        suggestedActions: {
            type: "ARRAY" as const,
            items: {
                type: "OBJECT" as const,
                properties: {
                    label: {
                        type: "STRING" as const,
                        description: "Short button label (2-5 words)",
                    },
                    prompt: {
                        type: "STRING" as const,
                        description:
                            "Message sent when the user clicks this action",
                    },
                },
                required: ["label", "prompt"],
            },
            description: "2-3 suggested follow-up actions for the user",
        },
    },
    required: ["conversationalText", "steps", "suggestedActions"],
};

export function applyVideoFallback(
    step: GenerationStep,
    type: string,
    attachments: ChatAttachment[],
    index: number,
    totalSteps: number,
) {
    if (
        type === "video" &&
        !step.firstFrameNodeId &&
        !step.lastFrameNodeId &&
        !step.dependsOn?.length &&
        attachments.length > 0 &&
        !step.referenceNodeIds?.length
    ) {
        if (attachments.length === 1) {
            step.firstFrameNodeId = attachments[0].nodeId;
        } else if (attachments.length === 2) {
            step.firstFrameNodeId = attachments[0].nodeId;
            step.lastFrameNodeId = attachments[1].nodeId;
        } else if (totalSteps === attachments.length) {
            // Map 1-to-1 if counts match
            step.firstFrameNodeId = attachments[index].nodeId;
        } else {
            step.referenceNodeIds = attachments.map((a) => a.nodeId);
        }
    }
}

export async function* streamAgentResponse(
    input: AgentInput,
): AsyncGenerator<AgentEvent> {
    const model = input.model || MODELS.TEXT.GEMINI_3_FLASH_PREVIEW;
    const canvasSummary = buildCanvasContextSummary(input.canvasNodes);
    const modeInstruction = getModeInstruction(input.mode);

    const systemInstruction = `${SYSTEM_PROMPT}${modeInstruction}${canvasSummary}

You MUST respond with a JSON object matching the schema. The conversationalText field is your natural language reply. The steps array lists what to generate (empty if nothing visual is needed). The suggestedActions array provides 2-3 follow-up ideas.

Guidelines for steps:
- For "4 variants of X" → 4 steps with the same prompt, different labels.
- Give each step a descriptive label that reflects the content (e.g., "Cute Cat", "Sci-Fi Scene") instead of generic labels like "Image" or "Video".
- For sequential workflows ("generate a portrait then animate it") → step_0 generates the image, step_1 is video with dependsOn: ["step_0"].
- For no generation → steps: [].
- Each step that references an existing canvas item should list those items' IDs in referenceNodeIds (generic reference), firstFrameNodeId (video first frame), or lastFrameNodeId (video last frame).
- IMPORTANT: You must ONLY use Node IDs that are explicitly listed in the 'Current canvas items' list above. Do NOT invent, assume, or generate any other IDs.

For aspect ratio: ONLY include if the user explicitly mentioned it. Map: "square"→"1:1", "portrait"/"vertical"→"9:16", "landscape"/"wide"→"16:9". Otherwise omit.
For resolution: ONLY include if the user explicitly mentioned it. Map: "HD"→"2K", "1080p"→"1080p", "4K"/"ultra"→"4K". Otherwise omit.
For video duration: ONLY include if the user explicitly mentioned a duration. Otherwise omit.
For audio: generateAudio true ONLY if user explicitly asks for audio/sound/music/narration. Default false.`;

    const contents = buildContents(input);

    logger.info(
        `[CanvasAgent] Single-pass response. Mode=${input.mode}, Model=${model}, History=${input.history.length} messages, Attachments=${input.attachments?.length ?? 0}`,
    );

    try {
        const response = await geminiService.generateStructured({
            contents,
            systemInstruction,
            model,
            responseSchema: AGENT_SCHEMA,
        });

        const responseText = response.candidates?.[0]?.content?.parts
            ?.filter((p) => p.text)
            .map((p) => p.text)
            .join("");

        if (!responseText) {
            yield {
                type: "text",
                delta: "Sorry, I encountered an error processing your request.",
            };
            yield { type: "done" };
            return;
        }

        logger.debug(`[CanvasAgent] Raw response: ${responseText}`);

        const parsed = JSON.parse(responseText) as {
            conversationalText: string;
            steps: Array<{
                id: string;
                type: "image" | "video";
                prompt: string;
                label?: string;
                aspectRatio?: string;
                resolution?: string;
                model?: string;
                duration?: number;
                generateAudio?: boolean;
                referenceNodeIds?: string[];
                firstFrameNodeId?: string;
                lastFrameNodeId?: string;
                dependsOn?: string[];
            }>;
            suggestedActions?: Array<{ label: string; prompt: string }>;
        };

        // Emit conversational text
        if (parsed.conversationalText) {
            yield { type: "text", delta: parsed.conversationalText };
        }

        const attachments = input.attachments ?? [];

        // Emit plan if there are steps
        if (parsed.steps && parsed.steps.length > 0) {
            const steps: GenerationStep[] = parsed.steps.map((s, index) => {
                const isVideo = s.type === "video";
                const typeDefaults = isVideo
                    ? input.videoDefaults
                    : input.imageDefaults;

                const step: GenerationStep = {
                    id: s.id,
                    type: s.type,
                    prompt: s.prompt,
                    ...(s.label ? { label: s.label } : {}),
                    aspectRatio:
                        s.aspectRatio ?? typeDefaults?.aspectRatio ?? "16:9",
                    ...((s.resolution ?? typeDefaults?.resolution)
                        ? {
                              resolution:
                                  s.resolution ?? typeDefaults?.resolution,
                          }
                        : {}),
                    ...((s.model ?? typeDefaults?.model)
                        ? { model: s.model ?? typeDefaults?.model }
                        : {}),
                    ...(isVideo &&
                    (s.duration ??
                        (input.videoDefaults as VideoDefaults | undefined)
                            ?.duration)
                        ? {
                              duration:
                                  s.duration ??
                                  (
                                      input.videoDefaults as
                                          | VideoDefaults
                                          | undefined
                                  )?.duration,
                          }
                        : {}),
                    generateAudio:
                        s.generateAudio ??
                        (input.videoDefaults as VideoDefaults | undefined)
                            ?.generateAudio ??
                        false,
                    ...(s.dependsOn && s.dependsOn.length > 0
                        ? { dependsOn: s.dependsOn }
                        : {}),
                };

                // Validate referenced node IDs against known canvas nodes
                if (s.referenceNodeIds && s.referenceNodeIds.length > 0) {
                    const validIds = s.referenceNodeIds.filter(
                        (id) =>
                            input.canvasNodes.some((n) => n.id === id) ||
                            attachments.some((a) => a.nodeId === id),
                    );
                    if (validIds.length > 0) {
                        step.referenceNodeIds = validIds;
                    }
                    if (validIds.length < s.referenceNodeIds.length) {
                        logger.warn(
                            `[CanvasAgent] Ignored some hallucinated referenceNodeIds`,
                        );
                    }
                }

                if (s.firstFrameNodeId) {
                    const isValid =
                        input.canvasNodes.some(
                            (n) => n.id === s.firstFrameNodeId,
                        ) ||
                        attachments.some((a) => a.nodeId === s.firstFrameNodeId);
                    if (isValid) {
                        step.firstFrameNodeId = s.firstFrameNodeId;
                    } else {
                        logger.warn(
                            `[CanvasAgent] Ignored hallucinated firstFrameNodeId: ${s.firstFrameNodeId}`,
                        );
                    }
                }

                if (s.lastFrameNodeId) {
                    const isValid =
                        input.canvasNodes.some(
                            (n) => n.id === s.lastFrameNodeId,
                        ) ||
                        attachments.some((a) => a.nodeId === s.lastFrameNodeId);
                    if (isValid) {
                        step.lastFrameNodeId = s.lastFrameNodeId;
                    } else {
                        logger.warn(
                            `[CanvasAgent] Ignored hallucinated lastFrameNodeId: ${s.lastFrameNodeId}`,
                        );
                    }
                }

                // Programmatic fallback for video when LLM didn't specify frames
                applyVideoFallback(
                    step,
                    s.type,
                    attachments,
                    index,
                    parsed.steps.length,
                );

                return step;
            });

            yield { type: "plan", plan: { steps } };
        }

        // Emit suggested actions
        if (
            parsed.suggestedActions &&
            Array.isArray(parsed.suggestedActions) &&
            parsed.suggestedActions.length > 0
        ) {
            const actions: ChatAction[] = parsed.suggestedActions
                .slice(0, 3)
                .map((a: { label: string; prompt: string }, i: number) => ({
                    id: String(i + 1),
                    label: a.label,
                    prompt: a.prompt,
                }));
            yield { type: "actions", actions };
        }
    } catch (error) {
        logger.error("[CanvasAgent] Error:", error);
        yield {
            type: "text",
            delta: "Sorry, I encountered an error processing your request.",
        };
    }

    yield { type: "done" };
}
