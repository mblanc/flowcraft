import { describe, it, expect, vi, beforeAll } from "vitest";
import { CanvasAgentRunner } from "../../lib/canvas/agent/agent-runner";
import { executePlan } from "../../lib/canvas/generation";
import { GeminiService } from "../../lib/services/gemini.service";
import { MODELS } from "../../lib/constants";
import type { AgentInput, AgentEvent } from "../../lib/canvas/types";

vi.mock("@/lib/config", () => ({
    config: {
        PROJECT_ID: process.env.PROJECT_ID ?? "",
        LOCATION: process.env.LOCATION ?? "global",
        GCS_STORAGE_URI: process.env.GCS_STORAGE_URI ?? "",
    },
}));

vi.mock("@/lib/services/library.service", () => ({
    libraryService: {
        createAsset: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock("@/lib/services/skill.service", () => ({
    skillService: {
        listSkills: vi.fn().mockResolvedValue([]),
    },
}));

const hasCredentials = !!process.env.PROJECT_ID;

function baseInput(
    overrides: Partial<AgentInput> & { message: string },
): AgentInput {
    return {
        mode: "auto",
        model: MODELS.TEXT.GEMINI_3_5_FLASH,
        history: [],
        canvasNodes: [],
        ...overrides,
    };
}

describe.runIf(hasCredentials)(
    "Canvas Agent E2E Lookbook & Consistency Eval",
    () => {
        let runner: CanvasAgentRunner;
        const geminiService = new GeminiService();

        beforeAll(() => {
            runner = new CanvasAgentRunner();
        });

        it(
            "generates a model portrait and creates three campaign variants keeping identity consistent",
            { timeout: 350_000 },
            async () => {
                const input = baseInput({
                    message:
                        "Create a studio portrait photo of a female model with dark red hair and freckles wearing a plain white t-shirt. Then, using that model, create 3 fashion lookbook campaign variations: one on a wet neon-lit Tokyo street at night, one on a sunny pine forest mountain trail, and one inside a luxury minimalist concrete photo studio.",
                    canvasId: "eval-e2e-lookbook-consistency",
                    userId: "eval-user",
                });

                // 1. Planning Phase
                console.log("Planning steps...");
                const events: AgentEvent[] = [];
                for await (const event of runner.stream(input)) {
                    events.push(event);
                }

                const planEvent = events.find(
                    (e): e is Extract<AgentEvent, { type: "plan" }> =>
                        e.type === "plan",
                );
                expect(planEvent).toBeDefined();

                const steps = planEvent!.plan.steps;
                console.log("Planned steps:", JSON.stringify(steps, null, 2));

                // We expect at least 4 image generation steps:
                // - 1 master portrait step
                // - 3 variant campaign steps
                const imageSteps = steps.filter((s) => s.type === "image");
                expect(imageSteps.length).toBeGreaterThanOrEqual(4);

                // Locate the master image step (it shouldn't depend on other image steps)
                const masterStep = imageSteps.find(
                    (s) => !s.dependsOn || s.dependsOn.length === 0,
                );
                expect(masterStep).toBeDefined();

                // Locate variant steps (they should have a dependency on the master image step)
                const variantSteps = imageSteps.filter(
                    (s) =>
                        s.id !== masterStep!.id &&
                        s.dependsOn?.includes(masterStep!.id),
                );
                expect(variantSteps.length).toBe(3);

                // 2. Execution Phase
                console.log("Executing lookbook steps...");
                const completedUris = new Map<string, string>();
                const nodeTypes = new Map<string, string>();

                for (const step of steps) {
                    nodeTypes.set(step.id, step.type);
                }

                for await (const event of executePlan(
                    planEvent!.plan,
                    completedUris,
                    "eval-user",
                    "eval-e2e-lookbook-consistency",
                    "E2E Lookbook Canvas",
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    nodeTypes,
                    [], // canvasNodes
                )) {
                    if (event.type === "step_done") {
                        console.log(
                            `Step ${event.stepId} finished! GCS URI: ${event.node.sourceUrl}`,
                        );
                        completedUris.set(event.stepId, event.node.sourceUrl);
                    } else if (event.type === "step_error") {
                        throw new Error(
                            `Step ${event.stepId} failed execution: ${event.message}`,
                        );
                    }
                }

                const masterUri = completedUris.get(masterStep!.id);
                const variantUris = variantSteps.map((s) =>
                    completedUris.get(s.id)!,
                );

                expect(masterUri).toBeDefined();
                expect(variantUris.every((uri) => uri !== undefined)).toBe(
                    true,
                );

                console.log(`Master model photo: ${masterUri}`);
                variantUris.forEach((uri, idx) => {
                    console.log(`Campaign variant ${idx + 1}: ${uri}`);
                });

                // 3. Gemini as Judge Phase
                console.log(
                    "Running Gemini as judge for character consistency...",
                );

                const judgePrompt = `
You are an expert AI media evaluation judge. Your task is to evaluate the model identity consistency and environment alignment of a set of fashion lookbook images.

We have 4 images to analyze:
1. The first image is the master model portrait. It should represent a female model with dark red hair and freckles.
2. The remaining 3 images are variants representing the model in different campaign settings:
   - Variant A: Tokyo street at night, neon-lit and wet.
   - Variant B: Pine forest mountain trail, sunny.
   - Variant C: Minimalist concrete photo studio.

Please evaluate:
- Whether all 4 images contain the exact same female model, preserving key facial structure, dark red hair, and freckles (identity lock consistency).
- Whether each variant (A, B, C) accurately matches its target setting/environment.

Provide your evaluation in the requested JSON format.
`;

                const judgeSchema = {
                    type: "object",
                    properties: {
                        identityConsistent: {
                            type: "boolean",
                            description:
                                "Whether all 4 images depict the exact same person, maintaining visual features (red hair, face shape, freckles).",
                        },
                        environmentsCorrect: {
                            type: "boolean",
                            description:
                                "Whether the 3 campaign images correctly portray the model in the Tokyo street, pine forest trail, and concrete studio respectively.",
                        },
                        reason: {
                            type: "string",
                            description: "Reasoning for your evaluations.",
                        },
                    },
                    required: [
                        "identityConsistent",
                        "environmentsCorrect",
                        "reason",
                    ],
                };

                const judgeResponseText = await geminiService.generateText({
                    model: MODELS.TEXT.GEMINI_3_5_FLASH,
                    prompts: [judgePrompt],
                    files: [
                        { url: masterUri!, type: "image/png" },
                        { url: variantUris[0], type: "image/png" },
                        { url: variantUris[1], type: "image/png" },
                        { url: variantUris[2], type: "image/png" },
                    ],
                    outputType: "json",
                    responseSchema: JSON.stringify(judgeSchema),
                });

                console.log("Judge response:", judgeResponseText);
                const judgeResult = JSON.parse(judgeResponseText);

                expect(judgeResult.identityConsistent).toBe(true);
                expect(judgeResult.environmentsCorrect).toBe(true);
            },
        );
    },
);
