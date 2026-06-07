import fs from "fs";
import path from "path";
import { GoogleGenAI, createPartFromText } from "@google/genai";
import logger from "@/app/logger";
import { config } from "@/lib/config";
import { MODELS } from "@/lib/constants";
import type { GenerationStep } from "../types";
import type { CanvasNode } from "../types";

const SKILL_FOR_TYPE: Record<"image" | "video", string> = {
    image: "image-generation",
    video: "video-generation",
};

const INSTRUCTION = `You are a media prompt engineer. Your only job is to take a plain-language generation intent and produce a single, fully-structured generation prompt that strictly follows the skill specification provided.

Rules:
- Identify the correct Job type from the available references (Job A: no refs, Job B: one ref, Job C: multiple refs).
- Fill every required section of the template. Never omit FORBIDDEN or CONSTRAINTS.
- Never describe emotion — describe the physical face or posture that produces it.
- Never use mood words: cinematic, atmospheric, beautiful, stunning, epic, moody, dramatic, gorgeous.
- Name every light source by type, direction, and quality. Never by mood.
- Output ONLY the final prompt text. No preamble, no explanation, no section headers, no markdown.`;

export class PromptEngineer {
    private readonly genAI: GoogleGenAI;
    private readonly skillsDir: string;
    private readonly skillCache: Map<string, string> = new Map();

    constructor(skillsDir: string) {
        this.skillsDir = skillsDir;
        this.genAI = new GoogleGenAI({
            vertexai: true,
            project: config.PROJECT_ID,
            location: config.LOCATION,
        });
    }

    private loadSkill(skillName: string): string {
        if (this.skillCache.has(skillName)) {
            return this.skillCache.get(skillName)!;
        }
        const skillPath = path.join(this.skillsDir, skillName, "SKILL.md");
        try {
            const content = fs.readFileSync(skillPath, "utf-8");
            this.skillCache.set(skillName, content);
            return content;
        } catch {
            logger.warn(`[PromptEngineer] Could not load skill: ${skillName}`);
            return "";
        }
    }

    private buildRequest(
        step: GenerationStep,
        canvasNodes: CanvasNode[],
        activeStyle?: { name: string; content: string } | null,
    ): string {
        const skillName = SKILL_FOR_TYPE[step.type];
        const skillContent = this.loadSkill(skillName);

        const lines: string[] = [];
        lines.push("SKILL SPECIFICATION:");
        lines.push(skillContent);
        lines.push("---");
        lines.push(`GENERATION INTENT: ${step.prompt}`);
        lines.push(`MEDIA TYPE: ${step.type}`);

        const refs = (step.referenceNodeIds ?? [])
            .map((id) => canvasNodes.find((n) => n.id === id))
            .filter(Boolean) as CanvasNode[];

        if (refs.length > 0) {
            lines.push("CANVAS REFERENCES:");
            for (const node of refs) {
                const prompt =
                    "prompt" in node.data
                        ? (node.data.prompt as string)
                        : undefined;
                lines.push(
                    `- ${node.data.label}${prompt ? `: "${prompt}"` : ""}`,
                );
            }
        }

        if (step.dependsOn && step.dependsOn.length > 0) {
            lines.push(
                `PLAN DEPENDENCIES: output of steps [${step.dependsOn.join(", ")}] will be provided as reference`,
            );
        }

        if (activeStyle) {
            lines.push(`ACTIVE STYLE — ${activeStyle.name}:`);
            lines.push(activeStyle.content);
        }

        lines.push("");
        lines.push("Write the structured prompt now.");
        return lines.join("\n");
    }

    async engineerPrompt(
        step: GenerationStep,
        canvasNodes: CanvasNode[],
        activeStyle?: { name: string; content: string } | null,
    ): Promise<string> {
        const skillName = SKILL_FOR_TYPE[step.type];
        if (!skillName || !this.loadSkill(skillName)) {
            return step.prompt;
        }

        const request = this.buildRequest(step, canvasNodes, activeStyle);

        try {
            const result = await this.genAI.models.generateContent({
                model: MODELS.TEXT.GEMINI_3_5_FLASH,
                config: {
                    systemInstruction: INSTRUCTION,
                    thinkingConfig: { thinkingBudget: 0 },
                },
                contents: [
                    { role: "user", parts: [createPartFromText(request)] },
                ],
            });
            const text = result.text?.trim();
            if (!text) throw new Error("empty response");
            return text;
        } catch (err) {
            logger.error(
                `[PromptEngineer] Failed to engineer prompt for step ${step.id}:`,
                err,
            );
            return step.prompt;
        }
    }

    async enrichSteps(
        steps: GenerationStep[],
        canvasNodes: CanvasNode[],
        activeStyle?: { name: string; content: string } | null,
    ): Promise<GenerationStep[]> {
        const enrichable = steps.filter(
            (s) => s.type === "image" || s.type === "video",
        );
        if (enrichable.length === 0) return steps;

        const enriched = await Promise.all(
            steps.map(async (step) => {
                if (step.type !== "image" && step.type !== "video") return step;
                const engineeredPrompt = await this.engineerPrompt(
                    step,
                    canvasNodes,
                    activeStyle,
                );
                return { ...step, prompt: engineeredPrompt };
            }),
        );

        return enriched;
    }
}
