import { describe, it, expect, vi, beforeAll } from "vitest";

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

import { CanvasAgentRunner } from "../../lib/canvas/agent/agent-runner";
import { executePlan } from "../../lib/canvas/generation";
import { GeminiService } from "../../lib/services/gemini.service";
import { MODELS } from "../../lib/constants";
import type { AgentInput, AgentEvent } from "../../lib/canvas/types";

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

describe.runIf(hasCredentials)("Canvas Agent E2E Live Generation Eval", () => {
    let runner: CanvasAgentRunner;
    const geminiService = new GeminiService();

    beforeAll(() => {
        runner = new CanvasAgentRunner();
    });

    it(
        "runs product-in-context to timeline-prompted multi-shot video pipeline",
        { timeout: 300_000 },
        async () => {
            const input = baseInput({
                message:
                    "Create a photorealistic image of a futuristic sports car parked on a wet neon-lit cyberpunk street, then generate a 4-second timeline video from that image: at [0s-2s] the camera slowly tracks left as the headlights turn on, and at [2s-4s] the car suddenly speeds away into the dark leaving light trails.",
                canvasId: "eval-e2e-cyberpunk-car",
                userId: "eval-user",
            });

            // 1. Plan / Trajectory Phase
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

            // Validate trajectory constraints:
            // - Should have an image generation step
            // - Should have a video generation step
            // - Video step should depend on the image step
            const imageStep = steps.find((s) => s.type === "image");
            const videoStep = steps.find((s) => s.type === "video");

            expect(imageStep).toBeDefined();
            expect(videoStep).toBeDefined();
            expect(videoStep!.dependsOn).toContain(imageStep!.id);

            // Set model on the video step to Omni so the primitive executes it using the Omni model
            if (videoStep) {
                videoStep.model = MODELS.VIDEO.GEMINI_OMNI_FLASH;
            }

            // 2. Execution Phase
            console.log("Executing planned steps...");
            const completedUris = new Map<string, string>();
            const nodeTypes = new Map<string, string>();
            let executedVideoPrompt = "";

            for (const step of steps) {
                nodeTypes.set(step.id, step.type);
            }

            for await (const event of executePlan(
                planEvent!.plan,
                completedUris,
                "eval-user",
                "eval-e2e-cyberpunk-car",
                "E2E Eval Canvas",
                undefined,
                undefined,
                undefined,
                undefined,
                nodeTypes,
                [], // canvasNodes (empty array to trigger prompt engineer)
            )) {
                if (event.type === "step_done") {
                    console.log(
                        `Step ${event.stepId} finished! GCS URI: ${event.node.sourceUrl}`,
                    );
                    completedUris.set(event.stepId, event.node.sourceUrl);
                    if (event.stepId === videoStep!.id) {
                        executedVideoPrompt = event.node.prompt ?? "";
                    }
                } else if (event.type === "step_error") {
                    throw new Error(
                        `Step ${event.stepId} failed execution: ${event.message}`,
                    );
                }
            }

            console.log("Enriched/executed video prompt:", executedVideoPrompt);
            // - Video step should use the timeline-prompting format (meaning it has timestamp brackets like [0s-2s])
            expect(executedVideoPrompt).toMatch(/\[\d+s[–-]\d+s\]/);

            const imageGcsUri = completedUris.get(imageStep!.id);
            const videoGcsUri = completedUris.get(videoStep!.id);

            expect(imageGcsUri).toBeDefined();
            expect(videoGcsUri).toBeDefined();

            console.log(`Image generated: ${imageGcsUri}`);
            console.log(`Video generated: ${videoGcsUri}`);

            // 3. Gemini as Judge Phase
            console.log("Running Gemini as judge (MediaResolution: HIGH)...");

            const judgePrompt = `
You are an expert AI media evaluation judge. Your task is to evaluate the quality and prompt alignment of an image and a video generated by a generative AI model.

The user's original request was:
"Create a photorealistic image of a futuristic sports car parked on a wet neon-lit cyberpunk street, then generate a 4-second timeline video from that image: at [0s-2s] the camera slowly tracks left as the headlights turn on, and at [2s-4s] the car suddenly speeds away into the dark leaving light trails."

Analyze the provided media files:
1. The first file is the generated image. Verify that:
   - It represents a futuristic sports car.
   - It is parked on a wet neon-lit cyberpunk street.
   - The style is photorealistic.
2. The second file is the generated video. Verify that:
   - It starts from the scene depicted in the image.
   - It follows the timeline prompting structure:
     - [0s-2s]: The camera tracks left and headlights turn on.
     - [2s-4s]: The car speeds away into the dark.
   - There are no major visual glitch artifacts or extreme model collapses.

Provide your evaluation in the requested JSON format.
`;

            const judgeSchema = {
                type: "object",
                properties: {
                    imagePassed: {
                        type: "boolean",
                        description:
                            "Whether the image matches the prompt and has good quality.",
                    },
                    imageReason: {
                        type: "string",
                        description: "Reasoning for the image evaluation.",
                    },
                    videoPassed: {
                        type: "boolean",
                        description:
                            "Whether the video matches the timeline prompts, starts from the image, and has good quality.",
                    },
                    videoReason: {
                        type: "string",
                        description: "Reasoning for the video evaluation.",
                    },
                },
                required: [
                    "imagePassed",
                    "imageReason",
                    "videoPassed",
                    "videoReason",
                ],
            };

            const judgeResponseText = await geminiService.generateText({
                model: MODELS.TEXT.GEMINI_3_5_FLASH,
                prompts: [judgePrompt],
                files: [
                    { url: imageGcsUri!, type: "image/png" },
                    { url: videoGcsUri!, type: "video/mp4" },
                ],
                outputType: "json",
                responseSchema: JSON.stringify(judgeSchema),
            });

            console.log("Judge response:", judgeResponseText);
            const judgeResult = JSON.parse(judgeResponseText);

            expect(judgeResult.imagePassed).toBe(true);
            expect(judgeResult.videoPassed).toBe(true);
        },
    );
});
