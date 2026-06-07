import logger from "@/app/logger";
import type { GenerationStep } from "../types";
import type { Skill } from "@google/adk";
import { runPromptEngineer } from "./prompt-engineer";

type ActiveStyle = { name: string; content: string } | null | undefined;
type SkillMap = Record<string, Skill>;

function inferOperation(step: GenerationStep): "t2i" | "i2v" | undefined {
    if (step.type === "image") return "t2i";
    if (step.type === "video" && step.firstFrameNodeId) return "i2v";
    return undefined;
}

export async function enrichPlanSteps(
    steps: GenerationStep[],
    skills: SkillMap,
    activeStyle: ActiveStyle,
): Promise<GenerationStep[]> {
    return Promise.all(
        steps.map(async (step) => {
            try {
                const operation = inferOperation(step);
                const skill = operation ? skills[operation] : undefined;

                const planNode = {
                    id: step.id,
                    operation: operation ?? ("t2i" as const),
                    promptIntent: step.prompt,
                    aspectRatio: step.aspectRatio,
                    duration: step.duration,
                    model: step.model,
                };

                const { prompt } = await runPromptEngineer(
                    planNode,
                    skill,
                    activeStyle,
                );
                return { ...step, prompt };
            } catch (err) {
                logger.warn(
                    `[EnrichPlanSteps] PromptEngineer failed for step ${step.id}, keeping original prompt:`,
                    err,
                );
                return step;
            }
        }),
    );
}
