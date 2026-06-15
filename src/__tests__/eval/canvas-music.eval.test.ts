/**
 * Canvas agent eval — music generation.
 *
 * Verifies that the Director correctly plans t2m (text-to-music) steps
 * via plan_production when the user requests music.
 *
 * Run:
 *   bun run test:eval -- canvas-music
 *
 * Requires Google ADC credentials and PROJECT_ID / LOCATION env vars.
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
import {
    criteria,
    runEval,
    printEvalResults,
    type EvalCase,
    type EvalCaseResult,
} from "./harness";

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

const evalCases: EvalCase[] = [
    {
        id: "music__simple_request",
        description:
            "Simple music request produces a plan with at least one audio step",
        input: baseInput({
            message: "Generate music for an epic adventure movie",
            canvasId: "eval-music-simple",
            userId: "eval-user",
        }),
        criteria: [
            criteria.noErrors(),
            criteria.hasPlan(),
            criteria.minStepsOfType("audio", 1),
            criteria.noSuggestedActions(),
        ],
    },
    {
        id: "music__genre_specific",
        description:
            "Genre-specific music request (jazz) produces an audio plan, not text response",
        input: baseInput({
            message:
                "Create a relaxing jazz lounge track for a cocktail bar scene",
            canvasId: "eval-music-jazz",
            userId: "eval-user",
        }),
        criteria: [
            criteria.noErrors(),
            criteria.hasPlan(),
            criteria.minStepsOfType("audio", 1),
            criteria.noSuggestedActions(),
        ],
    },
    {
        id: "music__no_video_confusion",
        description:
            "Explicit music-only request must not produce video steps instead of audio steps",
        input: baseInput({
            message:
                "Generate an orchestral background score for a nature documentary — sweeping strings, no percussion",
            canvasId: "eval-music-no-video",
            userId: "eval-user",
        }),
        criteria: [
            criteria.noErrors(),
            criteria.hasPlan(),
            criteria.minStepsOfType("audio", 1),
            {
                name: "no_video_steps",
                score: (steps) =>
                    steps.filter((s) => s.type === "video").length === 0
                        ? 1
                        : 0,
            },
            criteria.noSuggestedActions(),
        ],
    },
];

const hasCredentials = !!process.env.PROJECT_ID;

describe.runIf(hasCredentials)("Canvas agent eval — Music", () => {
    let runner: CanvasAgentRunner;
    const allResults: EvalCaseResult[] = [];

    beforeAll(() => {
        runner = new CanvasAgentRunner();
    });

    afterAll(() => {
        printEvalResults(allResults);
    });

    for (const c of evalCases) {
        it(`${c.id}: ${c.description}`, { timeout: 120_000 }, async () => {
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
