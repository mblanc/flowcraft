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
    config: {
        aspectRatio?: string;
        resolution?: string;
        model?: string;
        duration?: number;
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
- Generate videos from text descriptions
- Discuss and refine creative ideas
- Reference and iterate on existing canvas items the user shares with you

Guidelines:
- Be concise and helpful. Focus on the creative task at hand.
- When the user asks you to create something visual, respond with a brief acknowledgment of what you'll generate.
- When discussing existing canvas items (shared via attachments), reference them by their labels.
- Suggest follow-up creative directions the user might want to explore.
- Do NOT use markdown image or video syntax. Media will be generated separately and placed on the canvas.`;

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

function buildContents(
    input: AgentInput,
): Content[] {
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
                    userParts.push(createPartFromUri(sourceUrl, mimeType));
                }
            }
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
            description: "Whether media should be generated based on the conversation",
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
            description: "Aspect ratio for the media (e.g. '16:9', '1:1', '9:16'). Default to '16:9'.",
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
                        description: "Message sent when the user clicks this action",
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
    const systemInstruction =
        SYSTEM_PROMPT + modeInstruction + canvasSummary;

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

        const intentSystemPrompt = `You are analyzing a conversation between a user and a creative media assistant on a visual canvas.
Based on the conversation, determine:
1. Whether media (image or video) should be generated
2. If so, craft a detailed generation prompt
3. Suggest 2-3 follow-up actions the user might want

${modeInstruction}

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

        if (intentText) {
            const intent = JSON.parse(intentText);

            if (
                intent.shouldGenerate &&
                intent.mediaType !== "none" &&
                intent.generationPrompt
            ) {
                const referenceNodeIds = input.attachments
                    ?.map((a) => a.nodeId)
                    .filter(Boolean);

                yield {
                    type: "media",
                    media: {
                        type: intent.mediaType as "image" | "video",
                        prompt: intent.generationPrompt,
                        referenceNodeIds:
                            referenceNodeIds && referenceNodeIds.length > 0
                                ? referenceNodeIds
                                : undefined,
                        config: {
                            aspectRatio: intent.aspectRatio || "16:9",
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
                    .map(
                        (
                            a: { label: string; prompt: string },
                            i: number,
                        ) => ({
                            id: String(i + 1),
                            label: a.label,
                            prompt: a.prompt,
                        }),
                    );
                yield { type: "actions", actions };
            }
        }
    } catch (error) {
        logger.warn("[CanvasAgent] Intent detection failed:", error);
    }

    yield { type: "done" };
}
