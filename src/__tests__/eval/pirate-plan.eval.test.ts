/**
 * Eval: "pirate 2 variations + animate"
 *
 * Verifies that the Director produces a sensible 4-step plan for:
 *   "This guy as a pirate from the Caribbean, 2 variations, 9:16, then animate them"
 *
 * Expected plan shape:
 *   2 × image steps (i2i from ref portrait, 9:16)
 *   2 × video steps (animate each image, 9:16, valid duration)
 *
 * Run:
 *   bun run test:eval
 *
 * Requires Google ADC credentials and PROJECT_ID / LOCATION env vars.
 * Tests are skipped automatically when PROJECT_ID is not set.
 */

import { describe, it, expect, vi } from "vitest";
import type { GenerationStep } from "../../lib/canvas/types";

vi.mock("@/lib/config", () => ({
    config: {
        PROJECT_ID: process.env.PROJECT_ID ?? "",
        LOCATION: process.env.LOCATION ?? "global",
    },
}));

import { CanvasAgentRunner } from "../../lib/canvas/adk/runner";
import type { AgentEvent, AgentInput } from "../../lib/canvas/types";
import type { CanvasNode } from "../../lib/canvas/types";
import { MODELS } from "../../lib/constants";

// ─── helpers ─────────────────────────────────────────────────────────────────

async function collectEvents(
    runner: CanvasAgentRunner,
    input: AgentInput,
): Promise<AgentEvent[]> {
    console.log("\n─── REQUEST ──────────────────────────────────────────");
    console.log(`message:     ${input.message}`);
    console.log(
        `attachments: ${JSON.stringify(input.attachments?.map((a) => a.label))}`,
    );
    console.log(`imageDefaults: ${JSON.stringify(input.imageDefaults)}`);
    console.log(`videoDefaults: ${JSON.stringify(input.videoDefaults)}`);
    console.log(`canvasId:    ${input.canvasId}`);

    const events: AgentEvent[] = [];
    for await (const event of runner.stream(input)) {
        events.push(event);
    }

    console.log("\n─── EVENTS ───────────────────────────────────────────");
    for (const e of events) {
        if (e.type === "text") {
            console.log(
                `  text:    ${e.delta.slice(0, 120)}${e.delta.length > 120 ? "…" : ""}`,
            );
        } else if (e.type === "plan") {
            console.log(`  plan:    ${e.plan.steps.length} steps`);
            for (const s of e.plan.steps) {
                const ref =
                    s.referenceNodeIds?.join(",") ?? s.firstFrameNodeId ?? "—";
                console.log(
                    `    [${s.type}] ${s.id} | ar=${s.aspectRatio} | dur=${s.duration ?? "—"} | ref=${ref} | dependsOn=${s.dependsOn?.join(",") ?? "—"}`,
                );
                console.log(
                    `            prompt: ${s.prompt?.slice(0, 100) ?? ""}`,
                );
            }
        } else if (e.type === "actions") {
            console.log(
                `  actions: ${e.actions.map((a) => a.label).join(" | ")}`,
            );
        } else if (e.type === "error") {
            console.log(`  ERROR:   ${e.message.slice(0, 200)}`);
        } else if (e.type === "done") {
            console.log(`  done`);
        }
    }
    console.log("──────────────────────────────────────────────────────\n");

    return events;
}

function getPlan(events: AgentEvent[]): GenerationStep[] {
    const planEvent = events.find((e) => e.type === "plan");
    if (!planEvent || planEvent.type !== "plan") return [];
    return planEvent.plan.steps;
}

// ─── fixtures ────────────────────────────────────────────────────────────────

const REF_GCS_URI =
    "gs://storycraft-perso/01089de2-b8b5-4b13-91a6-afaa17f1a58a.jpeg";
const REF_NODE_ID = "canvas_portrait_ref";

const refCanvasNode: CanvasNode = {
    id: REF_NODE_ID,
    type: "canvas-image",
    position: { x: 0, y: 0 },
    data: {
        type: "canvas-image",
        label: "Guy Portrait",
        sourceUrl: REF_GCS_URI,
        mimeType: "image/jpeg",
        width: 512,
        height: 512,
        status: "ready",
    },
};

const USER_MESSAGE =
    "This guy as a pirate from the Caribbean, 2 variations, 9:16, then animate them";

// ─── guards ──────────────────────────────────────────────────────────────────

function assertValidPlanShape(steps: GenerationStep[]) {
    const imageSteps = steps.filter((s) => s.type === "image");
    const videoSteps = steps.filter((s) => s.type === "video");

    expect(
        steps.length,
        "plan should have at least 4 steps",
    ).toBeGreaterThanOrEqual(4);
    expect(
        imageSteps.length,
        "plan should have at least 2 image steps",
    ).toBeGreaterThanOrEqual(2);
    expect(
        videoSteps.length,
        "plan should have at least 2 video steps",
    ).toBeGreaterThanOrEqual(2);

    for (const step of steps) {
        expect(
            step.aspectRatio,
            `step ${step.id} (${step.type}) should be 9:16`,
        ).toBe("9:16");
    }

    for (const step of videoSteps) {
        if (step.duration !== undefined) {
            expect(
                [4, 6, 8],
                `video step ${step.id} has invalid duration ${step.duration}`,
            ).toContain(step.duration);
        }
    }
}

const hasCredentials = !!process.env.PROJECT_ID;

// ─── Director ────────────────────────────────────────────────────────────────

describe.runIf(hasCredentials)("Eval: pirate plan — Director", () => {
    it(
        "produces 2 image + 2 video steps, 9:16, valid durations",
        { timeout: 120_000 },
        async () => {
            const runner = new CanvasAgentRunner();

            const input: AgentInput = {
                message: USER_MESSAGE,
                mode: "auto",
                model: MODELS.TEXT.GEMINI_3_5_FLASH,
                history: [],
                canvasNodes: [refCanvasNode],
                attachments: [
                    {
                        nodeId: REF_NODE_ID,
                        label: "Guy Portrait",
                        type: "canvas-image",
                    },
                ],
                imageDefaults: { aspectRatio: "9:16" },
                videoDefaults: { aspectRatio: "9:16", duration: 6 },
                canvasId: "eval-director-plan",
                userId: "eval-user",
            };

            const events = await collectEvents(runner, input);

            const errorEvents = events.filter((e) => e.type === "error");
            expect(
                errorEvents,
                `ADK errors: ${JSON.stringify(errorEvents)}`,
            ).toHaveLength(0);

            const steps = getPlan(events);
            expect(steps.length, "no plan was produced").toBeGreaterThan(0);

            assertValidPlanShape(steps);
        },
    );

    it(
        "video steps have duration from valid set (never 5)",
        { timeout: 120_000 },
        async () => {
            const runner = new CanvasAgentRunner();

            const input: AgentInput = {
                message: USER_MESSAGE,
                mode: "auto",
                model: MODELS.TEXT.GEMINI_3_5_FLASH,
                history: [],
                canvasNodes: [refCanvasNode],
                attachments: [
                    {
                        nodeId: REF_NODE_ID,
                        label: "Guy Portrait",
                        type: "canvas-image",
                    },
                ],
                videoDefaults: { duration: 6 },
                canvasId: "eval-director-duration",
                userId: "eval-user",
            };

            const events = await collectEvents(runner, input);
            const steps = getPlan(events);
            const videoSteps = steps.filter((s) => s.type === "video");

            for (const step of videoSteps) {
                if (step.duration !== undefined) {
                    expect([4, 6, 8]).toContain(step.duration);
                    expect(step.duration).not.toBe(5);
                }
            }
        },
    );

    it(
        "does not use hallucinated node IDs in firstFrameNodeId",
        { timeout: 120_000 },
        async () => {
            const runner = new CanvasAgentRunner();

            const input: AgentInput = {
                message: USER_MESSAGE,
                mode: "auto",
                model: MODELS.TEXT.GEMINI_3_5_FLASH,
                history: [],
                canvasNodes: [refCanvasNode],
                attachments: [
                    {
                        nodeId: REF_NODE_ID,
                        label: "Guy Portrait",
                        type: "canvas-image",
                    },
                ],
                canvasId: "eval-director-nodeids",
                userId: "eval-user",
            };

            const events = await collectEvents(runner, input);
            const steps = getPlan(events);
            const validIds = new Set([REF_NODE_ID]);

            for (const step of steps) {
                if (step.firstFrameNodeId) {
                    expect(
                        validIds.has(step.firstFrameNodeId),
                        `firstFrameNodeId "${step.firstFrameNodeId}" is not a real canvas node`,
                    ).toBe(true);
                }
                if (step.lastFrameNodeId) {
                    expect(
                        validIds.has(step.lastFrameNodeId),
                        `lastFrameNodeId "${step.lastFrameNodeId}" is not a real canvas node`,
                    ).toBe(true);
                }
                if (step.referenceNodeIds) {
                    for (const refId of step.referenceNodeIds) {
                        expect(
                            validIds.has(refId),
                            `referenceNodeId "${refId}" is not a real canvas node`,
                        ).toBe(true);
                    }
                }
            }
        },
    );
});
