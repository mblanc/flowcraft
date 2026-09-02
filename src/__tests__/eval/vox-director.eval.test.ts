/**
 * Canvas agent eval — Vox Director pattern skill.
 *
 * Verifies that the Director correctly plans vox-director paper collage videos
 * via plan_production when /vox-director or paper collage video is requested.
 *
 * Run:
 *   bun run test:eval -- vox-director
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

vi.mock("@/lib/config", () => ({
    config: {
        PROJECT_ID: process.env.PROJECT_ID ?? "",
        LOCATION: process.env.LOCATION ?? "global",
    },
}));

vi.mock("@/lib/services/skill.service", () => ({
    skillService: {
        listSkills: vi.fn().mockResolvedValue([]),
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
        id: "vox_director__slash_command",
        description:
            "/vox-director slash command produces a plan containing keyframe images, motion clips, and audio tracks",
        input: baseInput({
            message: "/vox-director Ancient Rome trade evolution",
            canvasId: "eval-vox-slash",
            userId: "eval-user",
        }),
        criteria: [
            criteria.noErrors(),
            criteria.hasPlan(),
            criteria.minStepsOfType("image", 2),
            criteria.minStepsOfType("video", 2),
            criteria.minStepsOfType("audio", 1),
        ],
    },
    {
        id: "vox_director__natural_language",
        description:
            "Natural language request for a paper collage explainer triggers vox-director planning",
        input: baseInput({
            message:
                "Make a Vox style paper collage video explaining how money evolved",
            canvasId: "eval-vox-nl",
            userId: "eval-user",
        }),
        criteria: [
            criteria.noErrors(),
            criteria.hasPlan(),
            criteria.minStepsOfType("image", 2),
            criteria.minStepsOfType("video", 2),
            criteria.minStepsOfType("audio", 1),
        ],
    },
];

const hasCredentials = !!process.env.PROJECT_ID;

describe.runIf(hasCredentials)("Canvas agent eval — Vox Director", () => {
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
