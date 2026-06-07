import {
    Gemini,
    InMemorySessionService,
    LlmAgent,
    Runner,
    StreamingMode,
} from "@google/adk";
import { config } from "@/lib/config";
import { MODELS } from "@/lib/constants";
import logger from "@/app/logger";
import type { PlanNode } from "../types";
import type { Skill } from "@google/adk";

export interface MediaParams {
    aspectRatio?: string;
    imageSize?: string;
    resolution?: string;
    model?: string;
    duration?: number;
    generateAudio?: boolean;
}

export interface PromptEngineerResult {
    prompt: string;
    negativePrompt?: string;
    resolvedParams: MediaParams;
}

type ActiveStyle = { name: string; content: string } | null | undefined;

const PE_APP_NAME = "flowcraft-prompt-engineer";

function buildInstruction(
    node: PlanNode,
    skill: Skill | undefined,
    style: ActiveStyle,
): string {
    const skillBody = skill
        ? `\n\nSKILL GUIDANCE (${skill.frontmatter.name}):\n${skill.frontmatter.description ?? ""}`
        : "";
    const styleBody = style
        ? `\n\nACTIVE STYLE — "${style.name}":\n${style.content}`
        : "";

    return `You are a media prompt engineer. Your job is to transform a plain-language intent into a rich, production-ready generation prompt for a ${node.operation} model.

Rules:
- Return ONLY a JSON object with these fields: { "prompt": string, "negativePrompt": string | null }
- "prompt" must be specific, concrete, and follow best practices for the operation type.
- "negativePrompt" should capture style constraints from the active style guide (if any), otherwise null.
- Do NOT add commentary outside the JSON object.
- Do NOT wrap the JSON in markdown code fences.${skillBody}${styleBody}`;
}

function buildUserMessage(node: PlanNode): string {
    const parts: string[] = [`Intent: ${node.promptIntent}`];
    if (node.aspectRatio) parts.push(`Aspect ratio: ${node.aspectRatio}`);
    if (node.duration) parts.push(`Duration: ${node.duration}s`);
    return parts.join("\n");
}

function resolveParams(node: PlanNode): MediaParams {
    return {
        aspectRatio: node.aspectRatio,
        imageSize: node.imageSize,
        resolution: node.resolution,
        model: node.model,
        duration: node.duration,
        generateAudio: node.generateAudio,
    };
}

export function parseLlmResponse(
    raw: string,
    node: PlanNode,
): Pick<PromptEngineerResult, "prompt" | "negativePrompt"> {
    try {
        // Strip markdown fences if the model ignored the instruction
        const cleaned = raw
            .replace(/^```(?:json)?\n?/, "")
            .replace(/\n?```$/, "")
            .trim();
        const parsed = JSON.parse(cleaned) as {
            prompt?: unknown;
            negativePrompt?: unknown;
        };
        if (typeof parsed.prompt === "string" && parsed.prompt.length > 0) {
            return {
                prompt: parsed.prompt,
                negativePrompt:
                    typeof parsed.negativePrompt === "string"
                        ? parsed.negativePrompt
                        : undefined,
            };
        }
    } catch {
        // fall through to fallback
    }
    logger.warn(
        "[PromptEngineer] Could not parse LLM response, falling back to promptIntent",
    );
    return { prompt: node.promptIntent };
}

export async function runPromptEngineer(
    node: PlanNode,
    skill: Skill | undefined,
    style: ActiveStyle,
): Promise<PromptEngineerResult> {
    const resolvedParams = resolveParams(node);

    try {
        const model = MODELS.TEXT.GEMINI_3_5_FLASH;
        const sessionService = new InMemorySessionService();
        const agent = new LlmAgent({
            name: "PromptEngineer",
            model: new Gemini({
                model,
                vertexai: true,
                project: config.PROJECT_ID,
                location: config.LOCATION,
            }),
            instruction: buildInstruction(node, skill, style),
            tools: [],
        });

        const runner = new Runner({
            appName: PE_APP_NAME,
            agent,
            sessionService,
        });

        const sessionId = `pe-${node.id}-${Date.now()}`;
        await sessionService.createSession({
            appName: PE_APP_NAME,
            userId: "system",
            sessionId,
        });

        const events = runner.runAsync({
            userId: "system",
            sessionId,
            newMessage: {
                role: "user",
                parts: [{ text: buildUserMessage(node) }],
            },
            runConfig: { streamingMode: StreamingMode.NONE },
        });

        let fullText = "";
        for await (const event of events) {
            if (event.content?.parts) {
                for (const part of event.content.parts) {
                    if ("text" in part && typeof part.text === "string") {
                        fullText += part.text;
                    }
                }
            }
        }

        if (fullText.trim().length === 0) {
            logger.warn(
                "[PromptEngineer] Empty LLM response, using promptIntent",
            );
            return { prompt: node.promptIntent, resolvedParams };
        }

        const { prompt, negativePrompt } = parseLlmResponse(fullText, node);
        return { prompt, negativePrompt, resolvedParams };
    } catch (err) {
        logger.warn(
            "[PromptEngineer] LLM call failed, falling back to promptIntent:",
            err,
        );
        return { prompt: node.promptIntent, resolvedParams };
    }
}
