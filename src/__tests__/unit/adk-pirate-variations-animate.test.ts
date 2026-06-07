/**
 * Eval test: "pirate 2 variations + animate"
 *
 * Scenario: the user has a reference portrait on the canvas and asks
 * "This guy as a pirate from the caribbean, 2 variations, 9:16, then animate them"
 *
 * Expected plan:
 *   img_1 — i2i  — Pirate variation 1, 9:16, ref: canvas_ref_1
 *   img_2 — i2i  — Pirate variation 2, 9:16, ref: canvas_ref_1
 *   vid_1 — i2v  — animate img_1, 9:16, dependsOn: img_1
 *   vid_2 — i2v  — animate img_2, 9:16, dependsOn: img_2
 *
 * These tests simulate what the LLM would return (mocked ADK events) and
 * verify that extractAgentEvents maps them to the correct GenerationStep plan.
 */

import { describe, it, expect, vi } from "vitest";
import type { Event } from "@google/adk";
import type { PlanNode, PlanEdge } from "../../lib/canvas/types";

vi.mock("@/lib/config", () => ({
    config: { PROJECT_ID: "test-project", LOCATION: "us-central1" },
}));

import { extractAgentEvents } from "../../lib/canvas/adk/runner";
import type { ChatAttachment } from "../../lib/canvas/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeFunctionCallEvent(name: string, args: unknown): Event {
    return {
        id: "evt_fc",
        invocationId: "inv_1",
        timestamp: Date.now(),
        actions: { stateDelta: {}, artifactDelta: {} },
        content: {
            role: "model",
            parts: [{ functionCall: { name, args } }],
        },
    } as Event;
}

async function* asAsyncIter<T>(items: T[]): AsyncGenerator<T> {
    for (const item of items) yield item;
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
    const out: T[] = [];
    for await (const item of gen) out.push(item);
    return out;
}

// ─── shared fixtures ─────────────────────────────────────────────────────────

/** The existing canvas node the user attached as a reference */
const REF_NODE_ID = "canvas_ref_1";

const attachments: ChatAttachment[] = [
    { nodeId: REF_NODE_ID, label: "Guy Portrait", type: "canvas-image" },
];

const canvasNodeIds: string[] = [REF_NODE_ID];

// ─── Agent A  (plan_image_generation + plan_video_generation) ─────────────────

describe("Eval: pirate 2 variations + animate — Agent A", () => {
    /**
     * Agent A emits two separate tool calls:
     *   1. plan_image_generation — 2 i2i steps from the ref portrait
     *   2. plan_video_generation — 2 i2v steps that dependOn the image steps
     */
    const adkEvents: Event[] = [
        makeFunctionCallEvent("plan_image_generation", {
            steps: [
                {
                    id: "img_1",
                    type: "image",
                    prompt: "Portrait of a man as a Caribbean pirate, variation 1, dramatic lighting",
                    label: "Pirate Variation 1",
                    aspectRatio: "9:16",
                    referenceNodeIds: [REF_NODE_ID],
                },
                {
                    id: "img_2",
                    type: "image",
                    prompt: "Portrait of a man as a Caribbean pirate, variation 2, golden hour",
                    label: "Pirate Variation 2",
                    aspectRatio: "9:16",
                    referenceNodeIds: [REF_NODE_ID],
                },
            ],
        }),
        makeFunctionCallEvent("plan_video_generation", {
            steps: [
                {
                    id: "vid_1",
                    type: "video",
                    prompt: "Animate the pirate portrait, subtle camera drift",
                    label: "Pirate Animation 1",
                    aspectRatio: "9:16",
                    duration: "6",
                    generateAudio: false,
                    dependsOn: ["img_1"],
                },
                {
                    id: "vid_2",
                    type: "video",
                    prompt: "Animate the pirate portrait, gentle breeze effect",
                    label: "Pirate Animation 2",
                    aspectRatio: "9:16",
                    duration: "6",
                    generateAudio: false,
                    dependsOn: ["img_2"],
                },
            ],
        }),
        makeFunctionCallEvent("suggest_actions", {
            actions: [
                {
                    label: "Add ship background",
                    prompt: "Add a pirate ship background",
                },
                { label: "4K upscale", prompt: "Upscale to 4K" },
            ],
        }),
    ];

    it("produces a plan with exactly 4 steps", async () => {
        const events = await collect(
            extractAgentEvents(
                asAsyncIter(adkEvents),
                canvasNodeIds,
                attachments,
            ),
        );
        const planEvent = events.find((e) => e.type === "plan");
        expect(planEvent).toBeDefined();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((planEvent as any).plan.steps).toHaveLength(4);
    });

    it("has 2 image steps and 2 video steps", async () => {
        const events = await collect(
            extractAgentEvents(
                asAsyncIter(adkEvents),
                canvasNodeIds,
                attachments,
            ),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const steps = (events.find((e) => e.type === "plan") as any).plan.steps;
        const imageSteps = steps.filter(
            (s: { type: string }) => s.type === "image",
        );
        const videoSteps = steps.filter(
            (s: { type: string }) => s.type === "video",
        );
        expect(imageSteps).toHaveLength(2);
        expect(videoSteps).toHaveLength(2);
    });

    it("image steps reference the canvas attachment", async () => {
        const events = await collect(
            extractAgentEvents(
                asAsyncIter(adkEvents),
                canvasNodeIds,
                attachments,
            ),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const steps = (events.find((e) => e.type === "plan") as any).plan.steps;
        const imageSteps = steps.filter(
            (s: { type: string }) => s.type === "image",
        );
        for (const step of imageSteps) {
            expect(step.referenceNodeIds).toContain(REF_NODE_ID);
        }
    });

    it("all steps use 9:16 aspect ratio", async () => {
        const events = await collect(
            extractAgentEvents(
                asAsyncIter(adkEvents),
                canvasNodeIds,
                attachments,
            ),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const steps = (events.find((e) => e.type === "plan") as any).plan.steps;
        for (const step of steps) {
            expect(step.aspectRatio).toBe("9:16");
        }
    });

    it("video steps have duration 6 (valid, not 5)", async () => {
        const events = await collect(
            extractAgentEvents(
                asAsyncIter(adkEvents),
                canvasNodeIds,
                attachments,
            ),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const steps = (events.find((e) => e.type === "plan") as any).plan.steps;
        const videoSteps = steps.filter(
            (s: { type: string }) => s.type === "video",
        );
        for (const step of videoSteps) {
            expect([4, 6, 8]).toContain(step.duration);
            expect(step.duration).toBe(6);
        }
    });

    it("video steps carry dependsOn referencing the image step IDs", async () => {
        const events = await collect(
            extractAgentEvents(
                asAsyncIter(adkEvents),
                canvasNodeIds,
                attachments,
            ),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const steps = (events.find((e) => e.type === "plan") as any).plan.steps;
        const videoSteps = steps.filter(
            (s: { type: string }) => s.type === "video",
        );
        expect(videoSteps[0].dependsOn).toContain("img_1");
        expect(videoSteps[1].dependsOn).toContain("img_2");
    });

    it("emits suggest_actions", async () => {
        const events = await collect(
            extractAgentEvents(
                asAsyncIter(adkEvents),
                canvasNodeIds,
                attachments,
            ),
        );
        const actionsEvent = events.find((e) => e.type === "actions");
        expect(actionsEvent).toBeDefined();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((actionsEvent as any).actions.length).toBeGreaterThan(0);
    });
});

// ─── Agent B  (plan_production with DAG) ─────────────────────────────────────

describe("Eval: pirate 2 variations + animate — Agent B (Director)", () => {
    /**
     * Agent B emits a single plan_production call with a full DAG:
     *   - 2 i2i nodes (image variations from the ref portrait)
     *   - 2 i2v nodes (video animations, one per image)
     *   - subject_ref edges from canvas_ref_1 to i2i nodes
     *   - depends_on edges from i2i nodes to i2v nodes
     */
    const planNodes: PlanNode[] = [
        {
            id: "img_1",
            operation: "i2i",
            promptIntent:
                "Man dressed as a Caribbean pirate, variation 1, dramatic lighting, 9:16",
            aspectRatio: "9:16",
        },
        {
            id: "img_2",
            operation: "i2i",
            promptIntent:
                "Man dressed as a Caribbean pirate, variation 2, golden hour, 9:16",
            aspectRatio: "9:16",
        },
        {
            id: "vid_1",
            operation: "i2v",
            promptIntent: "Animate pirate variation 1, subtle camera drift",
            aspectRatio: "9:16",
            duration: 6,
        },
        {
            id: "vid_2",
            operation: "i2v",
            promptIntent: "Animate pirate variation 2, gentle breeze effect",
            aspectRatio: "9:16",
            duration: 6,
        },
    ];

    const planEdges: PlanEdge[] = [
        { from: REF_NODE_ID, to: "img_1", role: "subject_ref" },
        { from: REF_NODE_ID, to: "img_2", role: "subject_ref" },
        { from: "img_1", to: "vid_1", role: "depends_on" },
        { from: "img_2", to: "vid_2", role: "depends_on" },
    ];

    const adkEvents: Event[] = [
        makeFunctionCallEvent("plan_production", {
            nodes: planNodes,
            edges: planEdges,
        }),
        makeFunctionCallEvent("suggest_actions", {
            actions: [
                {
                    label: "Add ship background",
                    prompt: "Add a pirate ship background",
                },
                { label: "4K upscale", prompt: "Upscale to 4K" },
            ],
        }),
    ];

    it("produces a plan with exactly 4 steps", async () => {
        const events = await collect(
            extractAgentEvents(
                asAsyncIter(adkEvents),
                canvasNodeIds,
                attachments,
            ),
        );
        const planEvent = events.find((e) => e.type === "plan");
        expect(planEvent).toBeDefined();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((planEvent as any).plan.steps).toHaveLength(4);
    });

    it("has 2 image steps and 2 video steps", async () => {
        const events = await collect(
            extractAgentEvents(
                asAsyncIter(adkEvents),
                canvasNodeIds,
                attachments,
            ),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const steps = (events.find((e) => e.type === "plan") as any).plan.steps;
        const imageSteps = steps.filter(
            (s: { type: string }) => s.type === "image",
        );
        const videoSteps = steps.filter(
            (s: { type: string }) => s.type === "video",
        );
        expect(imageSteps).toHaveLength(2);
        expect(videoSteps).toHaveLength(2);
    });

    it("all steps use 9:16 aspect ratio", async () => {
        const events = await collect(
            extractAgentEvents(
                asAsyncIter(adkEvents),
                canvasNodeIds,
                attachments,
            ),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const steps = (events.find((e) => e.type === "plan") as any).plan.steps;
        for (const step of steps) {
            expect(step.aspectRatio).toBe("9:16");
        }
    });

    it("video steps have valid duration (4, 6, or 8 — never 5)", async () => {
        const events = await collect(
            extractAgentEvents(
                asAsyncIter(adkEvents),
                canvasNodeIds,
                attachments,
            ),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const steps = (events.find((e) => e.type === "plan") as any).plan.steps;
        const videoSteps = steps.filter(
            (s: { type: string }) => s.type === "video",
        );
        for (const step of videoSteps) {
            expect([4, 6, 8]).toContain(step.duration);
        }
    });

    it("step IDs are preserved from the plan_production nodes", async () => {
        const events = await collect(
            extractAgentEvents(
                asAsyncIter(adkEvents),
                canvasNodeIds,
                attachments,
            ),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const steps = (events.find((e) => e.type === "plan") as any).plan.steps;
        const ids = steps.map((s: { id: string }) => s.id);
        expect(ids).toContain("img_1");
        expect(ids).toContain("img_2");
        expect(ids).toContain("vid_1");
        expect(ids).toContain("vid_2");
    });

    it("emits suggest_actions", async () => {
        const events = await collect(
            extractAgentEvents(
                asAsyncIter(adkEvents),
                canvasNodeIds,
                attachments,
            ),
        );
        const actionsEvent = events.find((e) => e.type === "actions");
        expect(actionsEvent).toBeDefined();
    });
});

// ─── Guard: hallucinated video duration ──────────────────────────────────────

describe("Eval: pirate plan — invalid duration guard", () => {
    it("replaces 5s duration with default 4s for video steps (Agent A)", async () => {
        const adkEvents: Event[] = [
            makeFunctionCallEvent("plan_video_generation", {
                steps: [
                    {
                        id: "vid_bad",
                        type: "video",
                        prompt: "Animate",
                        aspectRatio: "9:16",
                        duration: "5", // invalid — should fall back to default 4
                    },
                ],
            }),
        ];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), [], []),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const steps = (events.find((e) => e.type === "plan") as any).plan.steps;
        expect(steps[0].duration).toBe(4);
    });

    it("replaces 5s duration with default 4s for video nodes (Agent B plan_production)", async () => {
        const adkEvents: Event[] = [
            makeFunctionCallEvent("plan_production", {
                nodes: [
                    {
                        id: "vid_bad",
                        operation: "t2v",
                        promptIntent: "Animate",
                        aspectRatio: "9:16",
                        duration: 5, // invalid — should fall back to default 4
                    },
                ],
                edges: [],
            }),
        ];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), [], []),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const steps = (events.find((e) => e.type === "plan") as any).plan.steps;
        expect(steps[0].duration).toBe(4);
    });

    it("defaults to 4s when no duration is specified", async () => {
        const adkEvents: Event[] = [
            makeFunctionCallEvent("plan_video_generation", {
                steps: [
                    {
                        id: "vid_1",
                        type: "video",
                        prompt: "Animate",
                        aspectRatio: "9:16",
                    },
                ],
            }),
        ];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), [], []),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const steps = (events.find((e) => e.type === "plan") as any).plan.steps;
        expect(steps[0].duration).toBe(4);
    });
});

// ─── Guard: hallucinated node IDs ────────────────────────────────────────────

describe("Eval: pirate plan — hallucinated node ID guard", () => {
    it("strips hallucinated plan-step firstFrameNodeId and falls back to attachment (Agent A)", async () => {
        const adkEvents: Event[] = [
            makeFunctionCallEvent("plan_video_generation", {
                steps: [
                    {
                        id: "vid_1",
                        type: "video",
                        prompt: "Animate",
                        aspectRatio: "9:16",
                        // model hallucinates a plan step ID instead of a canvas node ID
                        firstFrameNodeId: "img_1",
                    },
                ],
            }),
        ];
        const events = await collect(
            // img_1 is NOT in canvasNodeIds — it's a plan step ID, not a canvas node.
            // After stripping the hallucinated ID, applyVideoFallback assigns the
            // one real attachment (canvas_ref_1) as the first frame automatically.
            extractAgentEvents(
                asAsyncIter(adkEvents),
                canvasNodeIds,
                attachments,
            ),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const steps = (events.find((e) => e.type === "plan") as any).plan.steps;
        // hallucinated ID is gone; fallback replaces it with the real attachment
        expect(steps[0].firstFrameNodeId).toBe(REF_NODE_ID);
    });

    it("accepts firstFrameNodeId that is a real canvas attachment node", async () => {
        const adkEvents: Event[] = [
            makeFunctionCallEvent("plan_video_generation", {
                steps: [
                    {
                        id: "vid_1",
                        type: "video",
                        prompt: "Animate",
                        aspectRatio: "9:16",
                        firstFrameNodeId: REF_NODE_ID, // valid — real canvas node
                    },
                ],
            }),
        ];
        const events = await collect(
            extractAgentEvents(
                asAsyncIter(adkEvents),
                canvasNodeIds,
                attachments,
            ),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const steps = (events.find((e) => e.type === "plan") as any).plan.steps;
        expect(steps[0].firstFrameNodeId).toBe(REF_NODE_ID);
    });
});
