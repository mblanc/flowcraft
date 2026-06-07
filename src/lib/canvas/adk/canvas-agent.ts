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
    planProductionTool,
    planTextNodesTool,
    suggestActionsTool,
} from "./tools";
import path from "path";

const PATTERNS_DIR = path.join(
    process.cwd(),
    "src/lib/canvas/adk/skills/patterns",
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

    async build(model: string, instruction: string): Promise<LlmAgent> {
        await this.ensurePatternSkillsLoaded();
        const skillToolset = new SkillToolset(this.patternSkillsCache);
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
}
