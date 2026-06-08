/**
 * Canvas agent eval suite — uses the real LLM (Vertex AI / Gemini).
 *
 * Each eval case is a declarative scenario + criteria set. The harness runs
 * the agent, scores each criterion (0 or 1), and prints an ADK-style results
 * table. A case passes when its mean score meets the threshold (default 1.0).
 *
 * Run:
 *   bun run test:eval
 *
 * Requires Google ADC credentials and PROJECT_ID / LOCATION env vars.
 * Tests are skipped automatically when PROJECT_ID is not set.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

vi.mock("@/lib/config", () => ({
    config: {
        PROJECT_ID: process.env.PROJECT_ID ?? "",
        LOCATION: process.env.LOCATION ?? "global",
    },
}));

import { CanvasAgentRunner } from "../../lib/canvas/agent/agent-runner";
import { MODELS } from "../../lib/constants";
import type { AgentInput } from "../../lib/canvas/types";
import type { CanvasNode } from "../../lib/canvas/types";
import {
    criteria,
    runEval,
    printEvalResults,
    type EvalCase,
    type EvalCaseResult,
} from "./harness";

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
        model: MODELS.TEXT.GEMINI_3_5_FLASH,
        history: [],
        canvasNodes: [],
        ...overrides,
    };
}

// ─── Eval cases ───────────────────────────────────────────────────────────────

/**
 * Evalset: Director
 *
 * Covers multi-step DAG plans and Director-specific behavior.
 */
const evalCases: EvalCase[] = [
    {
        id: "director__pirate_2var_animate",
        description:
            "Classic: 2 pirate variations from portrait ref, then animate each (4-step DAG)",
        input: baseInput({
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
            criteria.noSuggestedActions(),
        ],
    },
    {
        id: "director__simple_image",
        description: "Director on a simple single-image request",
        input: baseInput({
            message: "A cinematic shot of a red fox in a snowy forest",
            canvasId: "eval-b-simple-image",
            userId: "eval-user",
        }),
        criteria: [
            criteria.noErrors(),
            criteria.hasPlan(),
            criteria.minStepsOfType("image", 1),
            criteria.noSuggestedActions(),
        ],
    },
    {
        id: "director__valid_durations",
        description:
            "Director must never produce invalid video durations (e.g. 5s)",
        input: baseInput({
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
            criteria.noSuggestedActions(),
        ],
    },
    {
        id: "director__scenario_grounded_trailer",
        description:
            "Multi-shot narrative: agent emits scenario text node before planning media",
        input: baseInput({
            message:
                "Create a 27-second cinematic trailer for a short film about a stray cat finding a home",
            canvasNodes: [],
            canvasId: "eval-b-scenario-trailer",
            userId: "eval-user",
        }),
        criteria: [
            criteria.noErrors(),
            criteria.hasTextNodes(),
            criteria.textNodesBeforeProduction(),
            criteria.minSteps(4),
            criteria.minStepsOfType("video", 3),
            criteria.noSuggestedActions(),
        ],
        threshold: 0.75,
    },
    {
        id: "director__no_hallucinated_ids",
        description: "Director must not invent canvas node IDs not in context",
        input: baseInput({
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
            criteria.noSuggestedActions(),
        ],
    },
];

// ─── Test suite ───────────────────────────────────────────────────────────────

const hasCredentials = !!process.env.PROJECT_ID;

describe.runIf(hasCredentials)("Canvas agent eval — Director", () => {
    let runner: CanvasAgentRunner;
    const allResults: EvalCaseResult[] = [];

    beforeAll(() => {
        runner = new CanvasAgentRunner();
    });

    afterAll(() => {
        printEvalResults(allResults);
    });

    for (const c of evalCases) {
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
