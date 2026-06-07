import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/logger", () => ({
    default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../lib/canvas/agent", () => ({
    applyVideoFallback: vi.fn((step: unknown) => step),
}));

import logger from "@/app/logger";
import {
    applyTypeDefaults,
    validateStepNodeIds,
    mapPlanNodesToSteps,
    VALID_IMAGE_MODELS,
    VALID_VIDEO_MODELS,
} from "../../lib/canvas/adk/step-mapper";
import type { GenerationStep, PlanNode } from "../../lib/canvas/types";

const mockWarn = vi.mocked(logger.warn);

beforeEach(() => vi.clearAllMocks());

// ─── resolveModel (exercised via applyTypeDefaults) ───────────────────────────

describe("resolveModel — via applyTypeDefaults", () => {
    const validImageModel = [...VALID_IMAGE_MODELS][0];
    const validVideoModel = [...VALID_VIDEO_MODELS][0];

    it("passes through a valid step model unchanged", () => {
        const step = applyTypeDefaults(
            { id: "s1", type: "image", prompt: "x", model: validImageModel },
            { model: validImageModel },
        );
        expect(step.model).toBe(validImageModel);
        expect(mockWarn).not.toHaveBeenCalled();
    });

    it("falls back to the default model when the step model is invalid", () => {
        const step = applyTypeDefaults(
            { id: "s1", type: "image", prompt: "x", model: "gpt-4o" },
            { model: validImageModel },
        );
        expect(step.model).toBe(validImageModel);
        expect(mockWarn).toHaveBeenCalledWith(
            expect.stringContaining("gpt-4o"),
        );
    });

    it("returns undefined when both step model and default are invalid", () => {
        const step = applyTypeDefaults(
            { id: "s1", type: "image", prompt: "x", model: "bad-model" },
            { model: "also-bad" },
        );
        expect(step.model).toBeUndefined();
    });

    it("returns undefined when no model is provided at all", () => {
        const step = applyTypeDefaults({
            id: "s1",
            type: "image",
            prompt: "x",
        });
        expect(step.model).toBeUndefined();
    });

    it("uses a valid default model when step has no model", () => {
        const step = applyTypeDefaults(
            { id: "s1", type: "image", prompt: "x" },
            { model: validImageModel },
        );
        expect(step.model).toBe(validImageModel);
    });

    it("validates video models against the video allowlist", () => {
        const step = applyTypeDefaults(
            { id: "s1", type: "video", prompt: "x", model: validImageModel },
            undefined,
            { model: validVideoModel },
        );
        // validImageModel is not in VALID_VIDEO_MODELS — should fall back to default
        expect(step.model).toBe(validVideoModel);
    });
});

// ─── applyTypeDefaults — duration boundary ────────────────────────────────────

describe("applyTypeDefaults — video duration coercion", () => {
    const baseVideo: GenerationStep = { id: "s1", type: "video", prompt: "x" };

    it("passes through valid duration 4", () => {
        const step = applyTypeDefaults({ ...baseVideo, duration: 4 });
        expect(step.duration).toBe(4);
    });

    it("passes through valid duration 6", () => {
        const step = applyTypeDefaults({ ...baseVideo, duration: 6 });
        expect(step.duration).toBe(6);
    });

    it("passes through valid duration 8", () => {
        const step = applyTypeDefaults({ ...baseVideo, duration: 8 });
        expect(step.duration).toBe(8);
    });

    it("coerces invalid duration 5 to 4", () => {
        const step = applyTypeDefaults({ ...baseVideo, duration: 5 as never });
        expect(step.duration).toBe(4);
    });

    it("coerces invalid duration 10 to 4", () => {
        const step = applyTypeDefaults({ ...baseVideo, duration: 10 as never });
        expect(step.duration).toBe(4);
    });

    it("defaults to 4 when duration is undefined", () => {
        const step = applyTypeDefaults({ ...baseVideo });
        expect(step.duration).toBe(4);
    });

    it("uses videoDefaults duration when step has none", () => {
        const step = applyTypeDefaults(baseVideo, undefined, { duration: 8 });
        expect(step.duration).toBe(8);
    });

    it("step duration takes precedence over videoDefaults", () => {
        const step = applyTypeDefaults(
            { ...baseVideo, duration: 6 },
            undefined,
            { duration: 8 },
        );
        expect(step.duration).toBe(6);
    });

    it("does not add duration field for image steps", () => {
        const step = applyTypeDefaults({
            id: "s1",
            type: "image",
            prompt: "x",
        });
        expect("duration" in step).toBe(false);
    });
});

// ─── applyTypeDefaults — other defaults ──────────────────────────────────────

describe("applyTypeDefaults — aspect ratio and imageSize", () => {
    it("defaults aspectRatio to 16:9 when not set", () => {
        const step = applyTypeDefaults({
            id: "s1",
            type: "image",
            prompt: "x",
        });
        expect(step.aspectRatio).toBe("16:9");
    });

    it("step aspectRatio takes precedence over defaults", () => {
        const step = applyTypeDefaults(
            { id: "s1", type: "image", prompt: "x", aspectRatio: "1:1" },
            { aspectRatio: "4:3" },
        );
        expect(step.aspectRatio).toBe("1:1");
    });

    it("applies imageSize from defaults for image steps", () => {
        const step = applyTypeDefaults(
            { id: "s1", type: "image", prompt: "x" },
            { imageSize: "2K" },
        );
        expect(step.imageSize).toBe("2K");
    });

    it("does not apply imageSize to video steps", () => {
        const step = applyTypeDefaults(
            { id: "s1", type: "video", prompt: "x" },
            { imageSize: "2K" },
        );
        expect(step.imageSize).toBeUndefined();
    });

    it("defaults generateAudio to false for video steps", () => {
        const step = applyTypeDefaults({
            id: "s1",
            type: "video",
            prompt: "x",
        });
        expect(step.generateAudio).toBe(false);
    });
});

// ─── validateStepNodeIds ─────────────────────────────────────────────────────

describe("validateStepNodeIds", () => {
    const canvasIds = ["canvas-1", "canvas-2"];
    const attachmentIds = ["att-1"];

    it("keeps valid referenceNodeIds", () => {
        const step = validateStepNodeIds(
            {
                id: "s1",
                type: "image",
                prompt: "x",
                referenceNodeIds: ["canvas-1", "att-1"],
            },
            canvasIds,
            attachmentIds,
        );
        expect(step.referenceNodeIds).toEqual(["canvas-1", "att-1"]);
    });

    it("strips hallucinated referenceNodeIds and warns", () => {
        const step = validateStepNodeIds(
            {
                id: "s1",
                type: "image",
                prompt: "x",
                referenceNodeIds: ["canvas-1", "ghost-node"],
            },
            canvasIds,
            attachmentIds,
        );
        expect(step.referenceNodeIds).toEqual(["canvas-1"]);
        expect(mockWarn).toHaveBeenCalledWith(
            expect.stringContaining("referenceNodeIds"),
        );
    });

    it("sets referenceNodeIds to undefined when all are invalid", () => {
        const step = validateStepNodeIds(
            {
                id: "s1",
                type: "image",
                prompt: "x",
                referenceNodeIds: ["ghost-1", "ghost-2"],
            },
            canvasIds,
            attachmentIds,
        );
        expect(step.referenceNodeIds).toBeUndefined();
    });

    it("clears a hallucinated firstFrameNodeId and warns", () => {
        const step = validateStepNodeIds(
            {
                id: "s1",
                type: "video",
                prompt: "x",
                firstFrameNodeId: "ghost-node",
            },
            canvasIds,
            attachmentIds,
        );
        expect(step.firstFrameNodeId).toBeUndefined();
        expect(mockWarn).toHaveBeenCalledWith(
            expect.stringContaining("firstFrameNodeId"),
        );
    });

    it("keeps a valid firstFrameNodeId", () => {
        const step = validateStepNodeIds(
            {
                id: "s1",
                type: "video",
                prompt: "x",
                firstFrameNodeId: "canvas-1",
            },
            canvasIds,
            attachmentIds,
        );
        expect(step.firstFrameNodeId).toBe("canvas-1");
    });

    it("clears a hallucinated lastFrameNodeId and warns", () => {
        const step = validateStepNodeIds(
            {
                id: "s1",
                type: "video",
                prompt: "x",
                lastFrameNodeId: "ghost-node",
            },
            canvasIds,
            attachmentIds,
        );
        expect(step.lastFrameNodeId).toBeUndefined();
        expect(mockWarn).toHaveBeenCalledWith(
            expect.stringContaining("lastFrameNodeId"),
        );
    });

    it("accepts attachment IDs as valid for firstFrameNodeId", () => {
        const step = validateStepNodeIds(
            { id: "s1", type: "video", prompt: "x", firstFrameNodeId: "att-1" },
            canvasIds,
            attachmentIds,
        );
        expect(step.firstFrameNodeId).toBe("att-1");
    });
});

// ─── mapPlanNodesToSteps ──────────────────────────────────────────────────────

describe("mapPlanNodesToSteps", () => {
    const baseNode = (overrides: Partial<PlanNode> = {}): PlanNode => ({
        id: "n1",
        operation: "t2i",
        promptIntent: "a sunset",
        ...overrides,
    });

    it("maps a t2i node to an image step", () => {
        const steps = mapPlanNodesToSteps([baseNode()], [], [], []);
        expect(steps).toHaveLength(1);
        expect(steps[0].type).toBe("image");
    });

    it("maps a t2v node to a video step", () => {
        const steps = mapPlanNodesToSteps(
            [baseNode({ operation: "t2v" })],
            [],
            [],
            [],
        );
        expect(steps[0].type).toBe("video");
    });

    it("maps i2i, i2v, i2v2 operations correctly", () => {
        const ops: Array<PlanNode["operation"]> = ["i2i", "i2v", "i2v2"];
        const expected = ["image", "video", "video"];
        ops.forEach((operation, i) => {
            const steps = mapPlanNodesToSteps(
                [baseNode({ id: `n${i}`, operation })],
                [],
                [],
                [],
            );
            expect(steps[0].type).toBe(expected[i]);
        });
    });

    it("skips unsupported operations with a warning", () => {
        const steps = mapPlanNodesToSteps(
            [baseNode({ operation: "upscale" as never })],
            [],
            [],
            [],
        );
        expect(steps).toHaveLength(0);
        expect(mockWarn).toHaveBeenCalledWith(
            expect.stringContaining("unsupported operation"),
        );
    });

    it("uses promptIntent when prompt is not set", () => {
        const steps = mapPlanNodesToSteps([baseNode()], [], [], []);
        expect(steps[0].prompt).toBe("a sunset");
    });

    it("uses prompt over promptIntent when both are set", () => {
        const steps = mapPlanNodesToSteps(
            [
                baseNode({
                    prompt: "engineered prompt",
                    promptIntent: "raw intent",
                }),
            ],
            [],
            [],
            [],
        );
        expect(steps[0].prompt).toBe("engineered prompt");
    });

    it("resolves subject_ref edges from canvas nodes as referenceNodeIds", () => {
        const steps = mapPlanNodesToSteps(
            [baseNode()],
            [{ from: "canvas-1", to: "n1", role: "subject_ref" }],
            ["canvas-1"],
            [],
        );
        expect(steps[0].referenceNodeIds).toContain("canvas-1");
    });

    it("resolves depends_on edges between plan nodes as dependsOn", () => {
        const nodes = [
            baseNode({ id: "n1" }),
            baseNode({ id: "n2", operation: "t2v" }),
        ];
        const steps = mapPlanNodesToSteps(
            nodes,
            [{ from: "n1", to: "n2", role: "depends_on" }],
            [],
            [],
        );
        const n2Step = steps.find((s) => s.id === "n2");
        expect(n2Step?.dependsOn).toContain("n1");
    });

    it("coerces invalid duration 5 to 4", () => {
        const steps = mapPlanNodesToSteps(
            [baseNode({ id: "n1", operation: "t2v", duration: 5 as never })],
            [],
            [],
            [],
        );
        expect(steps[0].duration).toBe(4);
    });

    it("passes through valid duration 8", () => {
        const steps = mapPlanNodesToSteps(
            [baseNode({ id: "n1", operation: "t2v", duration: 8 })],
            [],
            [],
            [],
        );
        expect(steps[0].duration).toBe(8);
    });

    // ─── concat operation ───────────────────────────────────────────────────

    it("maps a concat node to a concat step", () => {
        const steps = mapPlanNodesToSteps(
            [baseNode({ operation: "concat" })],
            [],
            [],
            [],
        );
        expect(steps).toHaveLength(1);
        expect(steps[0].type).toBe("concat");
    });

    it("concat step preserves dependsOn from plan edges", () => {
        const nodes = [
            baseNode({ id: "vid1", operation: "i2v" }),
            baseNode({ id: "vid2", operation: "i2v" }),
            baseNode({ id: "final", operation: "concat" }),
        ];
        const steps = mapPlanNodesToSteps(
            nodes,
            [
                { from: "vid1", to: "final", role: "depends_on" },
                { from: "vid2", to: "final", role: "depends_on" },
            ],
            [],
            [],
        );
        const finalStep = steps.find((s) => s.id === "final");
        expect(finalStep?.dependsOn).toContain("vid1");
        expect(finalStep?.dependsOn).toContain("vid2");
    });

    it("concat step does not get a default aspectRatio", () => {
        const steps = mapPlanNodesToSteps(
            [baseNode({ operation: "concat" })],
            [],
            [],
            [],
        );
        expect(steps[0].aspectRatio).toBeUndefined();
    });

    it("concat step does not get a default duration or generateAudio", () => {
        const steps = mapPlanNodesToSteps(
            [baseNode({ operation: "concat" })],
            [],
            [],
            [],
        );
        expect(steps[0].duration).toBeUndefined();
        expect(steps[0].generateAudio).toBeUndefined();
    });

    it("t2s is still skipped and concat is still mapped in a mixed plan", () => {
        const nodes = [
            baseNode({ id: "n1", operation: "t2i" }),
            baseNode({ id: "n2", operation: "t2s" }),
            baseNode({ id: "n3", operation: "concat" }),
        ];
        const steps = mapPlanNodesToSteps(nodes, [], [], []);
        expect(steps).toHaveLength(2);
        expect(steps.map((s) => s.type)).toEqual(["image", "concat"]);
    });
});
