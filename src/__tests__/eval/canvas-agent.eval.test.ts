/**
 * Canvas agent eval suite — uses the real LLM (Vertex AI / Gemini).
 *
 * Each eval case is a declarative scenario + criteria set. The harness runs
 * the agent, scores each criterion (0 or 1), and prints an ADK-style results
 * table. A case passes when its mean score meets the threshold (default 1.0).
 *
 * Run:
 *   INTEGRATION=true bun run test canvas-agent.eval.integration
 *
 * Requires Google ADC credentials (gcloud auth application-default login)
 * and a reachable Vertex AI project.
 */

import { describe, it, expect, vi, afterAll } from "vitest";

vi.mock("@/lib/config", () => ({
    config: { PROJECT_ID: "my-first-project-199607", LOCATION: "global" },
}));

import { CanvasAgentRunner } from "../lib/canvas/adk/runner";
import { MODELS } from "../lib/constants";
import type { AgentInput } from "../lib/canvas/agent";
import type { CanvasNode } from "../lib/canvas/types";
import {
    criteria,
    runEval,
    printEvalResults,
    assertEvalPasses,
    type EvalCase,
    type EvalCaseResult,
} from "./canvas-eval-harness";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const GCS_PORTRAIT =
    "gs://storycraft-perso/01089de2-b8b5-4b13-91a6-afaa17f1a58a.jpeg";
const PORTRAIT_ID = "canvas_portrait_ref";

const portraitNode: CanvasNode = {
    id: PORTRAIT_ID,
    type: "canvas-image",
    position: { x: 0, y: 0 },
    data: {
        type: "canvas-image",
        label: "Guy Portrait",
        sourceUrl: GCS_PORTRAIT,
        mimeType: "image/jpeg",
        width: 512,
        height: 512,
        status: "ready",
    },
};

function baseInput(
    overrides: Partial<AgentInput> & { message: string },
): AgentInput {
    return {
        mode: "auto",
        agentVariant: "a",
        model: MODELS.TEXT.GEMINI_3_5_FLASH,
        history: [],
        canvasNodes: [],
        ...overrides,
    };
}

// ─── Eval cases ───────────────────────────────────────────────────────────────

/**
 * Evalset: Agent A
 *
 * Covers the most common user intents for the streaming Agent A variant.
 */
const agentACases: EvalCase[] = [
    {
        id: "agent_a__simple_image",
        description: "Single t2i request — no canvas context",
        input: baseInput({
            message: "Generate a cyberpunk cityscape at night",
            canvasId: "eval-a-simple-image",
            userId: "eval-user",
        }),
        criteria: [
            criteria.noErrors(),
            criteria.hasPlan(),
            criteria.minStepsOfType("image", 1),
            criteria.validVideoDurations(),
        ],
    },
    {
        id: "agent_a__simple_video",
        description: "Single t2v request — no canvas context",
        input: baseInput({
            message: "Create a 6-second video of ocean waves at sunset",
            mode: "video",
            canvasId: "eval-a-simple-video",
            userId: "eval-user",
        }),
        criteria: [
            criteria.noErrors(),
            criteria.hasPlan(),
            criteria.minStepsOfType("video", 1),
            criteria.validVideoDurations(),
        ],
    },
    {
        id: "agent_a__variations",
        description: "4 image variations from a text prompt",
        input: baseInput({
            message: "4 variations of a samurai in a bamboo forest, 16:9",
            canvasId: "eval-a-variations",
            userId: "eval-user",
        }),
        criteria: [
            criteria.noErrors(),
            criteria.minStepsOfType("image", 4),
            criteria.allAspectRatio("16:9"),
            criteria.validVideoDurations(),
        ],
    },
    {
        id: "agent_a__i2i_with_ref",
        description:
            "Image-to-image: transform attached portrait into a pirate",
        input: baseInput({
            message:
                "This guy as a pirate from the Caribbean, 2 variations, 9:16",
            canvasNodes: [portraitNode],
            attachments: [
                {
                    nodeId: PORTRAIT_ID,
                    label: "Guy Portrait",
                    type: "canvas-image",
                },
            ],
            canvasId: "eval-a-i2i-pirate",
            userId: "eval-user",
        }),
        criteria: [
            criteria.noErrors(),
            criteria.minStepsOfType("image", 2),
            criteria.allAspectRatio("9:16"),
            criteria.refNodeUsed(PORTRAIT_ID),
            criteria.noHallucinatedNodeIds([PORTRAIT_ID]),
        ],
    },
    {
        id: "agent_a__image_then_animate",
        description: "Sequential: generate portrait then animate it",
        input: baseInput({
            message: "Generate a fantasy warrior portrait then animate it",
            canvasId: "eval-a-animate",
            userId: "eval-user",
        }),
        criteria: [
            criteria.noErrors(),
            criteria.minStepsOfType("image", 1),
            criteria.minStepsOfType("video", 1),
            criteria.videoStepsAreLinked(),
            criteria.validVideoDurations(),
        ],
    },
    {
        id: "agent_a__aspect_ratio_portrait",
        description: "User says 'vertical' — should map to 9:16",
        input: baseInput({
            message: "A moody film portrait, vertical format",
            canvasId: "eval-a-vertical",
            userId: "eval-user",
        }),
        criteria: [
            criteria.noErrors(),
            criteria.hasPlan(),
            criteria.allAspectRatio("9:16"),
        ],
    },
    {
        id: "agent_a__suggest_actions",
        description: "Agent should emit suggested follow-up actions",
        input: baseInput({
            message: "Generate a landscape painting in watercolor style",
            canvasId: "eval-a-suggest",
            userId: "eval-user",
        }),
        // suggest_actions is best-effort — lower threshold
        threshold: 0.8,
        criteria: [
            criteria.noErrors(),
            criteria.hasPlan(),
            criteria.hasSuggestedActions(),
        ],
    },
];

/**
 * Evalset: Agent B (Director)
 *
 * Covers multi-step DAG plans and Director-specific behavior.
 */
const agentBCases: EvalCase[] = [
    {
        id: "agent_b__pirate_2var_animate",
        description:
            "Classic: 2 pirate variations from portrait ref, then animate each (4-step DAG)",
        input: baseInput({
            agentVariant: "b",
            message:
                "This guy as a pirate from the Caribbean, 2 variations, 9:16, then animate them",
            canvasNodes: [portraitNode],
            attachments: [
                {
                    nodeId: PORTRAIT_ID,
                    label: "Guy Portrait",
                    type: "canvas-image",
                },
            ],
            imageDefaults: { aspectRatio: "9:16" },
            videoDefaults: { aspectRatio: "9:16", duration: 6 },
            canvasId: "eval-b-pirate-2var",
            userId: "eval-user",
        }),
        criteria: [
            criteria.noErrors(),
            criteria.minStepsOfType("image", 2),
            criteria.minStepsOfType("video", 2),
            criteria.allAspectRatio("9:16"),
            criteria.validVideoDurations(),
            criteria.refNodeUsed(PORTRAIT_ID),
            criteria.noHallucinatedNodeIds([PORTRAIT_ID]),
            criteria.videoStepsAreLinked(),
        ],
    },
    {
        id: "agent_b__simple_image",
        description: "Director on a simple single-image request",
        input: baseInput({
            agentVariant: "b",
            message: "A cinematic shot of a red fox in a snowy forest",
            canvasId: "eval-b-simple-image",
            userId: "eval-user",
        }),
        criteria: [
            criteria.noErrors(),
            criteria.hasPlan(),
            criteria.minStepsOfType("image", 1),
        ],
    },
    {
        id: "agent_b__valid_durations",
        description:
            "Director must never produce invalid video durations (e.g. 5s)",
        input: baseInput({
            agentVariant: "b",
            message: "Animate this portrait, maybe a couple seconds",
            canvasNodes: [portraitNode],
            attachments: [
                {
                    nodeId: PORTRAIT_ID,
                    label: "Guy Portrait",
                    type: "canvas-image",
                },
            ],
            videoDefaults: { duration: 6 },
            canvasId: "eval-b-valid-dur",
            userId: "eval-user",
        }),
        criteria: [
            criteria.noErrors(),
            criteria.minStepsOfType("video", 1),
            criteria.validVideoDurations([4, 6, 8]),
        ],
    },
    {
        id: "agent_b__no_hallucinated_ids",
        description: "Director must not invent canvas node IDs not in context",
        input: baseInput({
            agentVariant: "b",
            message:
                "This guy as a pirate from the Caribbean, 2 variations, 9:16, then animate them",
            canvasNodes: [portraitNode],
            attachments: [
                {
                    nodeId: PORTRAIT_ID,
                    label: "Guy Portrait",
                    type: "canvas-image",
                },
            ],
            canvasId: "eval-b-no-halluc",
            userId: "eval-user",
        }),
        criteria: [
            criteria.noErrors(),
            criteria.noHallucinatedNodeIds([PORTRAIT_ID]),
        ],
    },
];

// ─── Test suite ───────────────────────────────────────────────────────────────

const isIntegration = process.env.INTEGRATION === "true";

describe.runIf(isIntegration)("Canvas agent eval — Agent A", () => {
    const runner = new CanvasAgentRunner();
    const allResults: EvalCaseResult[] = [];

    afterAll(() => {
        printEvalResults(allResults);
    });

    for (const c of agentACases) {
        it(`${c.id}: ${c.description}`, { timeout: 120_000 }, async () => {
            const [result] = await runEval(runner, [c]);
            allResults.push(result);

            // Surface individual criterion failures as separate expect() calls
            // so Vitest shows exactly which criterion failed.
            for (const cr of result.criteriaResults) {
                expect(
                    cr.score,
                    `criterion: ${cr.name}`,
                ).toBeGreaterThanOrEqual(1.0);
            }
            expect(
                result.meanScore,
                `overall score below threshold ${result.threshold}`,
            ).toBeGreaterThanOrEqual(result.threshold);
        });
    }
});

describe.runIf(isIntegration)("Canvas agent eval — Agent B (Director)", () => {
    const runner = new CanvasAgentRunner();
    const allResults: EvalCaseResult[] = [];

    afterAll(() => {
        printEvalResults(allResults);
    });

    for (const c of agentBCases) {
        it(`${c.id}: ${c.description}`, { timeout: 180_000 }, async () => {
            const [result] = await runEval(runner, [c]);
            allResults.push(result);

            for (const cr of result.criteriaResults) {
                expect(
                    cr.score,
                    `criterion: ${cr.name}`,
                ).toBeGreaterThanOrEqual(1.0);
            }
            expect(
                result.meanScore,
                `overall score below threshold ${result.threshold}`,
            ).toBeGreaterThanOrEqual(result.threshold);
        });
    }
});
