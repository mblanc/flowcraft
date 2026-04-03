import { Content, createPartFromText, createPartFromUri } from "@google/genai";
import { geminiService } from "@/lib/services/gemini.service";
import { MODELS } from "@/lib/constants";
import logger from "@/app/logger";
import type {
    ChatAttachment,
    ChatMessage,
    CanvasNode,
    ChatAction,
} from "@/lib/canvas-types";

export interface AgentInput {
    message: string;
    attachments?: ChatAttachment[];
    mode: "auto" | "image" | "video";
    model?: string;
    history: ChatMessage[];
    canvasNodes: CanvasNode[];
}

export interface MediaToGenerate {
    type: "image" | "video";
    prompt: string;
    referenceNodeIds?: string[];
    firstFrameNodeId?: string;
    lastFrameNodeId?: string;
    config: {
        aspectRatio?: string;
        resolution?: string;
        model?: string;
        duration?: number;
        generateAudio?: boolean;
    };
}

export type AgentEvent =
    | { type: "text"; delta: string }
    | { type: "media"; media: MediaToGenerate }
    | { type: "actions"; actions: ChatAction[] }
    | { type: "done" };

const SYSTEM_PROMPT = `You are a creative media assistant inside a visual canvas workspace. You help users generate and iterate on images and videos.

Your capabilities:
- Generate images from text descriptions
- Generate videos from text descriptions or from existing images (image-to-video)
- Edit and iterate on existing canvas images by using them as reference
- Discuss and refine creative ideas
- Understand natural-language generation config (aspect ratio, resolution, duration)

Guidelines:
- Be concise and helpful. Focus on the creative task at hand.
- When the user asks you to create something visual, respond with a brief acknowledgment of what you'll generate.
- When the user shares canvas items (via selection or @mention), they will be attached as multimodal content. ALWAYS reference these items by their exact label (e.g. "Image 1", "Video 2") in your response.
- When iterating on an existing item, acknowledge which item you're working from (e.g. "Based on Image 1, I'll..."). The referenced item will be passed as input to the generation model automatically.
- When the user asks to "animate" or "make a video from" an image, generate a video using the image as a reference.
- If the user specifies aspect ratio (e.g. "square", "portrait", "9:16", "vertical"), resolution (e.g. "1080p", "4K"), or duration (e.g. "8 seconds"), extract and apply those settings.
- Suggest follow-up creative directions the user might want to explore.
- Do NOT use markdown image or video syntax. Media will be generated separately and placed on the canvas.
- IMPORTANT: Reply ONLY with natural, conversational language. Do NOT output any JSON objects, ReAct formats, or tool call syntaxes. The actual media generation is automatically handled behind the scenes.`;

function getModeInstruction(mode: "auto" | "image" | "video"): string {
    switch (mode) {
        case "image":
            return "\n\nIMPORTANT: The user has selected IMAGE mode. You MUST generate an image based on their request. Craft an appropriate image generation prompt.";
        case "video":
            return "\n\nIMPORTANT: The user has selected VIDEO mode. You MUST generate a video based on their request. Craft an appropriate video generation prompt.";
        default:
            return "\n\nThe user is in AUTO mode. Decide whether their request requires generating an image, a video, or just a text response. If they ask for something visual, generate the appropriate media.";
    }
}

function buildCanvasContextSummary(nodes: CanvasNode[]): string {
    if (nodes.length === 0) return "";

    const items = nodes.map((n) => {
        const d = n.data;
        let desc = `- ${d.label} (${n.type.replace("canvas-", "")})`;
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
                        `[${att.label} (${node.type.replace("canvas-", "")})]`,
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

const INTENT_SCHEMA = {
    type: "OBJECT" as const,
    properties: {
        shouldGenerate: {
            type: "BOOLEAN" as const,
            description:
                "Whether media should be generated based on the conversation",
        },
        mediaType: {
            type: "STRING" as const,
            enum: ["image", "video", "none"],
            description: "Type of media to generate",
        },
        generationPrompt: {
            type: "STRING" as const,
            description:
                "Detailed prompt for generating the media. Be specific and descriptive. If no media, leave empty.",
        },
        aspectRatio: {
            type: "STRING" as const,
            description:
                "Aspect ratio for the media (e.g. '16:9', '1:1', '9:16'). Default to '16:9'.",
        },
        resolution: {
            type: "STRING" as const,
            enum: ["720p", "1080p", "4k"],
            description:
                "Resolution if explicitly specified by the user. Omit if not mentioned.",
        },
        duration: {
            type: "NUMBER" as const,
            description:
                "Video duration in seconds (4, 6, or 8). Only for video generation. Omit if not mentioned.",
        },
        generateAudio: {
            type: "BOOLEAN" as const,
            description:
                "For video only: whether to generate audio/sound alongside the video. Default false. Set to true only if the user explicitly requests audio, sound, music, or narration.",
        },
        generationModel: {
            type: "STRING" as const,
            description:
                "Override generation model if the user explicitly requests a specific one. Omit if not mentioned.",
        },
        firstFrameLabel: {
            type: "STRING" as const,
            description:
                "For video only: exact label of the canvas item to use as the first frame (e.g., 'Image 1'). Omit if unspecified.",
        },
        lastFrameLabel: {
            type: "STRING" as const,
            description:
                "For video only: exact label of the canvas item to use as the last frame. Omit if unspecified.",
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
    required: [
        "shouldGenerate",
        "mediaType",
        "generationPrompt",
        "suggestedActions",
    ],
};

export async function* streamAgentResponse(
    input: AgentInput,
): AsyncGenerator<AgentEvent> {
    const model = input.model || MODELS.TEXT.GEMINI_3_FLASH_PREVIEW;
    const canvasSummary = buildCanvasContextSummary(input.canvasNodes);
    const modeInstruction = getModeInstruction(input.mode);
    const systemInstruction = SYSTEM_PROMPT + modeInstruction + canvasSummary;

    const contents = buildContents(input);

    logger.info(
        `[CanvasAgent] Streaming response. Mode=${input.mode}, Model=${model}, History=${input.history.length} messages, Attachments=${input.attachments?.length ?? 0}`,
    );

    // Phase A: Stream conversational text
    let fullText = "";
    try {
        for await (const delta of geminiService.generateTextStream({
            contents,
            systemInstruction: systemInstruction,
            model,
        })) {
            fullText += delta;
            yield { type: "text", delta };
        }
        logger.debug(`[CanvasAgent] Phase A complete: ${fullText}`);
    } catch (error) {
        logger.error("[CanvasAgent] Streaming error:", error);
        if (!fullText) {
            yield {
                type: "text",
                delta: "Sorry, I encountered an error processing your request.",
            };
        }
        yield { type: "done" };
        return;
    }

    // Phase B: Structured intent detection for media generation + suggested actions
    try {
        const intentContents: Content[] = [
            ...contents.slice(0, -1),
            contents[contents.length - 1],
            { role: "model", parts: [{ text: fullText }] },
        ];

        const hasAttachments =
            input.attachments && input.attachments.length > 0;
        const attachmentContext = hasAttachments
            ? `\n\nThe user has shared ${input.attachments!.length} canvas item(s) as reference. These MUST be used as reference material for the generation. When crafting the generation prompt, incorporate details from the referenced items. For example:
- If an image is shared and the user wants edits → generate an image with the edit instructions (the original is passed as reference automatically).
- If an image is shared and the user wants a video → generate a video. If the user explicitly asks to use an image as the first or last frame, set firstFrameLabel and lastFrameLabel to the exact label of the image.
- If a video is shared and the user wants changes → generate a new video with the updated instructions.`
            : "";

        const intentSystemPrompt = `You are analyzing a conversation between a user and a creative media assistant on a visual canvas.
Based on the conversation, determine:
1. Whether media (image or video) should be generated
2. If so, craft a detailed generation prompt
3. Extract any generation configuration the user specified (aspect ratio, resolution, duration)
4. Suggest 2-3 follow-up actions the user might want

${modeInstruction}${attachmentContext}

For aspect ratio, map natural language: "square" → "1:1", "portrait"/"vertical" → "9:16", "landscape"/"wide"/"horizontal" → "16:9", "cinematic"/"ultrawide" → "21:9". Default to "16:9" if unspecified.
For resolution, accept "720p", "1080p", or "4k". Default to unspecified (let the system choose).
For video duration, accept 4, 6, or 8 seconds. Default to unspecified.
For audio, set generateAudio to true ONLY if the user explicitly asks for audio, sound, music, voiceover, or narration with the video. Default to false.

If the user is asking a question, making conversation, or the assistant already declined to generate, set shouldGenerate to false and mediaType to "none".`;

        const intentResponse = await geminiService.generateStructured({
            contents: intentContents,
            systemInstruction: intentSystemPrompt,
            model,
            responseSchema: INTENT_SCHEMA,
        });

        const intentText = intentResponse.candidates?.[0]?.content?.parts
            ?.filter((p) => p.text)
            .map((p) => p.text)
            .join("");

        logger.debug(`[CanvasAgent] Phase B raw intent: ${intentText}`);

        if (intentText) {
            const intent = JSON.parse(intentText);

            if (
                intent.shouldGenerate &&
                intent.mediaType !== "none" &&
                intent.generationPrompt
            ) {
                let referenceNodeIds = input.attachments
                    ?.map((a) => a.nodeId)
                    .filter(Boolean);

                let firstFrameNodeId: string | undefined;
                let lastFrameNodeId: string | undefined;

                if (
                    intent.mediaType === "video" &&
                    referenceNodeIds &&
                    referenceNodeIds.length > 0
                ) {
                    if (intent.firstFrameLabel) {
                        const att = input.attachments?.find(
                            (a) =>
                                a.label?.toLowerCase() ===
                                intent.firstFrameLabel?.toLowerCase(),
                        );
                        if (att) firstFrameNodeId = att.nodeId;
                    }
                    if (intent.lastFrameLabel) {
                        const att = input.attachments?.find(
                            (a) =>
                                a.label?.toLowerCase() ===
                                intent.lastFrameLabel?.toLowerCase(),
                        );
                        if (att) lastFrameNodeId = att.nodeId;
                    }

                    // Fallback programmatic logic if LLM didn't specify explicitly
                    if (!firstFrameNodeId && !lastFrameNodeId) {
                        if (referenceNodeIds.length === 1) {
                            firstFrameNodeId = referenceNodeIds[0];
                            referenceNodeIds = []; // Consumed
                        } else if (referenceNodeIds.length === 2) {
                            firstFrameNodeId = referenceNodeIds[0];
                            lastFrameNodeId = referenceNodeIds[1];
                            referenceNodeIds = []; // Consumed
                        } else {
                            // more -> always references images
                            // If there are 3+, keep them all as references, do not set first/last frame
                        }
                    } else {
                        // User explicitly assigned frames, and they are incompatible with generic references.
                        // Clear the remaining references so we don't mix them.
                        referenceNodeIds = [];
                    }
                }

                yield {
                    type: "media",
                    media: {
                        type: intent.mediaType as "image" | "video",
                        prompt: intent.generationPrompt,
                        referenceNodeIds:
                            referenceNodeIds && referenceNodeIds.length > 0
                                ? referenceNodeIds
                                : undefined,
                        firstFrameNodeId,
                        lastFrameNodeId,
                        config: {
                            aspectRatio: intent.aspectRatio || "16:9",
                            ...(intent.resolution
                                ? { resolution: intent.resolution }
                                : {}),
                            ...(intent.generationModel
                                ? { model: intent.generationModel }
                                : {}),
                            ...(intent.duration
                                ? { duration: intent.duration }
                                : {}),
                            generateAudio: intent.generateAudio === true,
                        },
                    },
                };
            }

            if (
                intent.suggestedActions &&
                Array.isArray(intent.suggestedActions) &&
                intent.suggestedActions.length > 0
            ) {
                const actions: ChatAction[] = intent.suggestedActions
                    .slice(0, 3)
                    .map((a: { label: string; prompt: string }, i: number) => ({
                        id: String(i + 1),
                        label: a.label,
                        prompt: a.prompt,
                    }));
                yield { type: "actions", actions };
            }
        }
    } catch (error) {
        logger.warn("[CanvasAgent] Intent detection failed:", error);
    }

    yield { type: "done" };
}
