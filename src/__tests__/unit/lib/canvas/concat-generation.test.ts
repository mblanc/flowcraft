import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/logger", () => ({
    default: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/services/gemini.service", () => ({
    geminiService: {
        generateImage: vi.fn().mockResolvedValue({
            data: "base64data",
            mimeType: "image/png",
        }),
        generateVideo: vi.fn().mockResolvedValue("gs://bucket/generated.mp4"),
    },
}));
vi.mock("@/lib/services/storage.service", () => ({
    storageService: {
        uploadImage: vi.fn().mockResolvedValue("gs://bucket/image.png"),
    },
}));
vi.mock("@/lib/services/library.service", () => ({
    libraryService: { createAsset: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@/lib/services/concat.service", () => ({
    concatService: {
        concatVideos: vi.fn().mockResolvedValue("gs://bucket/final.mp4"),
    },
}));

import { executePlan } from "@/lib/canvas/generation";
import { concatService } from "@/lib/services/concat.service";
import { geminiService } from "@/lib/services/gemini.service";
import type { AgentPlan } from "@/lib/canvas/types";

const mockConcatVideos = vi.mocked(concatService.concatVideos);
const mockGenerateVideo = vi.mocked(geminiService.generateVideo);

beforeEach(() => vi.clearAllMocks());

async function collectStepEvents(
    plan: AgentPlan,
    nodeUris = new Map<string, string>(),
) {
    const events = [];
    for await (const event of executePlan(
        plan,
        nodeUris,
        "user-1",
        "canvas-1",
        "My Canvas",
    )) {
        events.push(event);
    }
    return events;
}

// ─── concat step execution ────────────────────────────────────────────────────

describe("executePlan — concat step", () => {
    it("calls concatService with the URIs produced by preceding video steps in order", async () => {
        mockGenerateVideo
            .mockResolvedValueOnce("gs://bucket/vid1.mp4")
            .mockResolvedValueOnce("gs://bucket/vid2.mp4");

        const plan: AgentPlan = {
            steps: [
                { id: "vid1", type: "video", prompt: "clip 1" },
                { id: "vid2", type: "video", prompt: "clip 2" },
                {
                    id: "final",
                    type: "concat",
                    prompt: "Join",
                    dependsOn: ["vid1", "vid2"],
                },
            ],
        };

        await collectStepEvents(plan);

        expect(mockConcatVideos).toHaveBeenCalledWith([
            "gs://bucket/vid1.mp4",
            "gs://bucket/vid2.mp4",
        ]);
    });

    it("emits step_start then step_done for a concat step", async () => {
        const plan: AgentPlan = {
            steps: [
                { id: "vid1", type: "video", prompt: "clip 1" },
                {
                    id: "final",
                    type: "concat",
                    prompt: "Join",
                    dependsOn: ["vid1"],
                },
            ],
        };

        const events = await collectStepEvents(plan);

        expect(
            events.some((e) => e.type === "step_start" && e.stepId === "final"),
        ).toBe(true);
        expect(
            events.some((e) => e.type === "step_done" && e.stepId === "final"),
        ).toBe(true);
    });

    it("produces a canvas-video NodePayload with operation=concat and the GCS URI", async () => {
        mockConcatVideos.mockResolvedValueOnce("gs://bucket/result.mp4");
        const plan: AgentPlan = {
            steps: [
                { id: "vid1", type: "video", prompt: "clip 1" },
                {
                    id: "final",
                    type: "concat",
                    prompt: "Join",
                    label: "Final cut",
                    dependsOn: ["vid1"],
                },
            ],
        };

        const events = await collectStepEvents(plan);
        const done = events.find(
            (e) => e.type === "step_done" && e.stepId === "final",
        );

        expect(done).toBeDefined();
        if (done?.type === "step_done") {
            expect(done.node.type).toBe("canvas-video");
            expect(done.node.operation).toBe("concat");
            expect(done.node.sourceUrl).toBe("gs://bucket/result.mp4");
            expect(done.node.label).toBe("Final cut");
        }
    });

    it("records the concat output URI so downstream concat steps can chain from it", async () => {
        mockGenerateVideo.mockResolvedValueOnce("gs://bucket/vid1.mp4");
        mockConcatVideos
            .mockResolvedValueOnce("gs://bucket/concat1.mp4")
            .mockResolvedValueOnce("gs://bucket/concat2.mp4");

        const plan: AgentPlan = {
            steps: [
                { id: "vid1", type: "video", prompt: "clip 1" },
                {
                    id: "concat1",
                    type: "concat",
                    prompt: "Pass 1",
                    dependsOn: ["vid1"],
                },
                {
                    id: "concat2",
                    type: "concat",
                    prompt: "Pass 2",
                    dependsOn: ["concat1"],
                },
            ],
        };

        await collectStepEvents(plan);

        expect(mockConcatVideos).toHaveBeenNthCalledWith(2, [
            "gs://bucket/concat1.mp4",
        ]);
    });

    it("emits step_error when concatService throws", async () => {
        mockConcatVideos.mockRejectedValueOnce(new Error("ffmpeg failure"));
        const plan: AgentPlan = {
            steps: [
                { id: "vid1", type: "video", prompt: "clip 1" },
                {
                    id: "final",
                    type: "concat",
                    prompt: "Join",
                    dependsOn: ["vid1"],
                },
            ],
        };

        const events = await collectStepEvents(plan);
        const errorEvent = events.find(
            (e) => e.type === "step_error" && e.stepId === "final",
        );

        expect(errorEvent).toBeDefined();
        if (errorEvent?.type === "step_error") {
            expect(errorEvent.message).toBe("ffmpeg failure");
        }
    });

    it("emits step_error when no dependsOn URIs can be resolved", async () => {
        const plan: AgentPlan = {
            steps: [
                // "ghost" never ran — no URI in completedStepUris
                {
                    id: "final",
                    type: "concat",
                    prompt: "Join",
                    dependsOn: ["ghost"],
                },
            ],
        };

        const events = await collectStepEvents(plan);
        const errorEvent = events.find(
            (e) => e.type === "step_error" && e.stepId === "final",
        );

        expect(errorEvent).toBeDefined();
        if (errorEvent?.type === "step_error") {
            expect(errorEvent.message).toMatch(/no resolved input/i);
        }
    });
});

// ─── concat step library save ─────────────────────────────────────────────────

describe("executePlan — concat library save", () => {
    it("saves the concat result to the library as type=video", async () => {
        const { libraryService } =
            await import("@/lib/services/library.service");
        const plan: AgentPlan = {
            steps: [
                { id: "vid1", type: "video", prompt: "clip 1" },
                {
                    id: "final",
                    type: "concat",
                    prompt: "Join",
                    dependsOn: ["vid1"],
                },
            ],
        };

        await collectStepEvents(plan);

        const concatSave = vi
            .mocked(libraryService.createAsset)
            .mock.calls.find(([args]) => args.type === "video" && !args.model);
        expect(concatSave).toBeDefined();
    });
});
