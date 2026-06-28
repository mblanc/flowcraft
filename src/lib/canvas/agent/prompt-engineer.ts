import fs from "fs";
import path from "path";
import logger from "@/app/logger";
import { MODELS } from "@/lib/constants";
import { geminiService } from "@/lib/services/gemini.service";
import type { GenerationStep } from "../types";
import type { CanvasNode } from "../types";
import { registry } from "@/primitives/registry";

const INSTRUCTION = `You are a media prompt engineer. Your only job is to take a plain-language generation intent and produce a single, fully-structured generation prompt that strictly follows the skill specification provided.

Rules:
- For standard images: follow the unified structure (General Description followed by Structured Features: SUBJECT, ENVIRONMENT, STYLE & MEDIUM, CHANGES, FORBIDDEN).
- For CHARACTER IDENTITY BOARD intents: follow the special-case instructions in the skill specification exactly. The intent already contains the correct block format — complete missing sections using the canonical template and output the block as-is.
- Fill every required section of the template. Never omit FORBIDDEN or CONSTRAINTS.
- Never describe emotion — describe the physical face or posture that produces it.
- For standard images, avoid vague mood words: atmospheric, beautiful, stunning, epic, moody, dramatic, gorgeous. Exception: CHARACTER IDENTITY BOARD prompts intentionally use "cinematic", "premium", "artbook-like", and "expressive" as format descriptors — preserve them exactly.
- Name every light source by type, direction, and quality. Never by mood.
- Output ONLY the final prompt text. No preamble, no explanation, no section headers, no markdown.`;

export class PromptEngineer {
    private readonly skillsDir: string;
    private readonly skillCache: Map<string, string> = new Map();

    constructor(skillsDir: string) {
        this.skillsDir = skillsDir;
    }

    private getSkillName(stepType: string): string {
        const primitive = registry.getByCanvasType(`canvas-${stepType}`);
        const skillPath = primitive?.agent?.skillPath;
        if (!skillPath) return "";
        return path.basename(path.dirname(skillPath));
    }

    private loadSkill(skillName: string): string {
        if (this.skillCache.has(skillName)) {
            return this.skillCache.get(skillName)!;
        }
        const skillDir = path.join(this.skillsDir, skillName);
        const skillPath = path.join(skillDir, "SKILL.md");
        try {
            const parts: string[] = [fs.readFileSync(skillPath, "utf-8")];
            const referencesDir = path.join(skillDir, "references");
            if (fs.existsSync(referencesDir)) {
                for (const file of fs.readdirSync(referencesDir).sort()) {
                    if (file.endsWith(".md")) {
                        parts.push(
                            fs.readFileSync(
                                path.join(referencesDir, file),
                                "utf-8",
                            ),
                        );
                    }
                }
            }
            const content = parts.join("\n\n---\n\n");
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
        violationFeedback?: string,
        activeRuleset?: {
            name: string;
            rules: { id: string; description: string; severity: string }[];
        } | null,
    ): string {
        const skillName = this.getSkillName(step.type);
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

        if (activeRuleset && activeRuleset.rules.length > 0) {
            const ruleLines = activeRuleset.rules
                .map((r) => `- [${r.severity}] ${r.description}`)
                .join("\n");
            lines.push(
                `ACTIVE RULESET — ${activeRuleset.name}:\n${ruleLines}\nEvery prompt you produce must explicitly satisfy these rules.`,
            );
        }

        if (violationFeedback) {
            lines.push("");
            lines.push(violationFeedback);
        }

        lines.push("");
        lines.push("Write the structured prompt now.");
        return lines.join("\n");
    }

    async engineerPrompt(
        step: GenerationStep,
        canvasNodes: CanvasNode[],
        activeStyle?: { name: string; content: string } | null,
        violationFeedback?: string,
        activeRuleset?: {
            name: string;
            rules: { id: string; description: string; severity: string }[];
        } | null,
    ): Promise<string> {
        const skillName = this.getSkillName(step.type);
        if (!skillName || !this.loadSkill(skillName)) {
            return step.prompt;
        }

        const request = this.buildRequest(
            step,
            canvasNodes,
            activeStyle,
            violationFeedback,
            activeRuleset,
        );

        try {
            const text = await geminiService.generateText({
                model: MODELS.TEXT.GEMINI_3_5_FLASH,
                prompts: [request],
                systemInstruction: INSTRUCTION,
            });
            return text.trim();
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
        activeRuleset?: {
            name: string;
            rules: { id: string; description: string; severity: string }[];
        } | null,
    ): Promise<GenerationStep[]> {
        const enrichable = steps.filter((s) => !!this.getSkillName(s.type));
        if (enrichable.length === 0) return steps;

        const enriched = await Promise.all(
            steps.map(async (step) => {
                if (!this.getSkillName(step.type)) return step;
                const engineeredPrompt = await this.engineerPrompt(
                    step,
                    canvasNodes,
                    activeStyle,
                    undefined,
                    activeRuleset,
                );
                return { ...step, prompt: engineeredPrompt };
            }),
        );

        return enriched;
    }
}
