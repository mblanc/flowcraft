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
        generateVideo: vi.fn().mockResolvedValue({
            videoUrl: "gs://bucket/generated.mp4",
            interactionId: "interaction-abc",
        }),
        generateMusic: vi.fn().mockResolvedValue({
            audioData: "base64_audio_data",
            mimeType: "audio/mp3",
        }),
    },
}));

vi.mock("@/lib/services/storage.service", () => ({
    storageService: {
        uploadImage: vi.fn().mockResolvedValue("gs://bucket/image.png"),
        uploadFile: vi.fn().mockResolvedValue("gs://bucket/music.mp3"),
    },
}));

vi.mock("@/lib/services/library.service", () => ({
    libraryService: { createAsset: vi.fn().mockResolvedValue(undefined) },
}));

import { executePlan } from "@/lib/canvas/generation";
import { geminiService } from "@/lib/services/gemini.service";
import type { AgentPlan, CanvasNode } from "@/lib/canvas/types";

const mockGenerateVideo = vi.mocked(geminiService.generateVideo);

beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateVideo.mockResolvedValue({
        videoUrl: "gs://bucket/generated.mp4",
        interactionId: "interaction-abc",
    });
});

async function collectStepEvents(
    plan: AgentPlan,
    nodeUris = new Map<string, string>(),
    nodeTypes = new Map<string, string>(),
    canvasNodes: CanvasNode[] = [],
) {
    const events = [];
    for await (const event of executePlan(
        plan,
        nodeUris,
        "user-1",
        "canvas-1",
        "My Canvas",
        undefined,
        undefined,
        undefined,
        undefined,
        nodeTypes,
        canvasNodes,
    )) {
        events.push(event);
    }
    return events;
}

describe("executePlan — Omni features (audio and editing)", () => {
    it("passes audio reference to geminiService.generateVideo when video step depends on audio step", async () => {
        const plan: AgentPlan = {
            steps: [
                { id: "aud1", type: "audio", prompt: "music prompt" },
                {
                    id: "vid1",
                    type: "video",
                    prompt: "video prompt",
                    dependsOn: ["aud1"],
                },
            ],
        };

        const nodeTypes = new Map<string, string>([
            ["aud1", "audio"],
            ["vid1", "video"],
        ]);

        await collectStepEvents(plan, new Map(), nodeTypes);

        expect(mockGenerateVideo).toHaveBeenLastCalledWith(
            expect.objectContaining({
                prompt: "video prompt",
                audio: "gs://bucket/music.mp3",
            }),
        );
    });

    it("passes previousInteractionId when video step depends on another video step in the same plan", async () => {
        mockGenerateVideo
            .mockResolvedValueOnce({
                videoUrl: "gs://bucket/vid1.mp4",
                interactionId: "interaction-123",
            })
            .mockResolvedValueOnce({
                videoUrl: "gs://bucket/vid2.mp4",
                interactionId: "interaction-456",
            });

        const plan: AgentPlan = {
            steps: [
                { id: "vid1", type: "video", prompt: "first video" },
                {
                    id: "vid2",
                    type: "video",
                    prompt: "make it faster",
                    dependsOn: ["vid1"],
                },
            ],
        };

        const nodeTypes = new Map<string, string>([
            ["vid1", "video"],
            ["vid2", "video"],
        ]);

        await collectStepEvents(plan, new Map(), nodeTypes);

        expect(mockGenerateVideo).toHaveBeenLastCalledWith(
            expect.objectContaining({
                prompt: "make it faster",
                previousInteractionId: "interaction-123",
            }),
        );
    });

    it("passes previousInteractionId from an existing canvas video node", async () => {
        const plan: AgentPlan = {
            steps: [
                {
                    id: "vid2",
                    type: "video",
                    prompt: "make it faster",
                    referenceNodeIds: ["canvas_vid1"],
                },
            ],
        };

        const nodeUris = new Map<string, string>([
            ["canvas_vid1", "gs://bucket/canvas_vid1.mp4"],
        ]);

        const nodeTypes = new Map<string, string>([
            ["canvas_vid1", "canvas-video"],
            ["vid2", "video"],
        ]);

        const canvasNodes: CanvasNode[] = [
            {
                id: "canvas_vid1",
                type: "canvas-video",
                position: { x: 0, y: 0 },
                data: {
                    type: "canvas-video",
                    label: "My Video",
                    sourceUrl: "gs://bucket/canvas_vid1.mp4",
                    mimeType: "video/mp4",
                    interactionId: "interaction-existing-123",
                    status: "ready",
                },
            },
        ];

        await collectStepEvents(plan, nodeUris, nodeTypes, canvasNodes);

        expect(mockGenerateVideo).toHaveBeenCalledWith(
            expect.objectContaining({
                prompt: "make it faster",
                previousInteractionId: "interaction-existing-123",
            }),
        );
    });
});
