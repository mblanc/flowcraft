import {
    Gemini,
    LlmAgent,
    SkillToolset,
    loadAllSkillsInDir,
    ListSkillsTool,
    type Skill,
} from "@google/adk";
import { ThinkingLevel } from "@google/genai";
import { config } from "@/lib/config";
import logger from "@/app/logger";
import {
    askUserTool,
    planProductionTool,
    planTextNodesTool,
    suggestActionsTool,
} from "./tools";
import path from "path";
import type { UserSkillDocument } from "./skills/skill-types";

const PATTERNS_DIR = path.join(
    process.cwd(),
    "src/lib/canvas/agent/skills/patterns",
);

export class CanvasAgent {
    private patternSkillsCache: Record<string, Skill> = {};

    async ensurePatternSkillsLoaded(): Promise<void> {
        if (Object.keys(this.patternSkillsCache).length === 0) {
            try {
                this.patternSkillsCache =
                    await loadAllSkillsInDir(PATTERNS_DIR);
            } catch (err) {
                logger.warn("[CanvasADK] Could not load pattern skills:", err);
            }
        }
    }

    async build(
        model: string,
        instruction: string,
        userSkills: UserSkillDocument[] = [],
        disabledSkills: string[] = [],
    ): Promise<LlmAgent> {
        await this.ensurePatternSkillsLoaded();

        // Convert UserSkillDocument[] to Record<string, Skill>
        const formattedUserSkills: Record<string, Skill> = {};
        for (const userSkill of userSkills) {
            const phaseInstructions = userSkill.phases
                .map(
                    (phase, idx) =>
                        `### Phase ${idx + 1}: ${phase.title}\n${phase.rules}`,
                )
                .join("\n\n");

            const instructions = `## Trigger condition\n\nUse this pattern when the user asks to:\n\n${userSkill.triggerHints
                .map((hint) => `- "${hint}"`)
                .join(
                    "\n",
                )}\n\n---\n\n## Workflow steps\n\n${phaseInstructions}`;

            formattedUserSkills[userSkill.name] = {
                frontmatter: {
                    name: userSkill.name,
                    description: userSkill.description,
                    metadata: {
                        type: "pattern",
                        userCreated: true,
                    },
                },
                instructions,
            };
        }

        // Combine built-in skills and user skills
        const combinedSkills = {
            ...this.patternSkillsCache,
            ...formattedUserSkills,
        };

        // Filter out disabled skills
        const activeSkills: Record<string, Skill> = {};
        const disabledSet = new Set(disabledSkills);
        for (const [name, skill] of Object.entries(combinedSkills)) {
            if (!disabledSet.has(name)) {
                activeSkills[name] = skill;
            }
        }

        const skillToolset = new SkillToolset(activeSkills);
        // Patch the instance dynamically to remove ListSkillsTool
        const st = skillToolset as unknown as { _tools?: unknown[] };
        if (Array.isArray(st._tools)) {
            st._tools = st._tools.filter(
                (tool) => !(tool instanceof ListSkillsTool),
            );
        }
        return new LlmAgent({
            name: "Director",
            model: new Gemini({
                model,
                vertexai: true,
                project: config.PROJECT_ID,
                location: config.LOCATION,
            }),
            instruction,
            generateContentConfig: {
                thinkingConfig: {
                    thinkingLevel: ThinkingLevel.LOW,
                    includeThoughts: true,
                },
            },
            tools: [
                askUserTool,
                planTextNodesTool,
                planProductionTool,
                suggestActionsTool,
                skillToolset,
            ],
        });
    }

    get loadedPatternNames(): string[] {
        return Object.keys(this.patternSkillsCache);
    }

    get patternSkills(): Record<string, Skill> {
        return this.patternSkillsCache;
    }
}
