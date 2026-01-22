import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkflowEngine } from "../lib/workflow-engine";
import { Node, Edge } from "@xyflow/react";
import {
    NodeData,
    TextData,
    ImageData,
    VideoData,
    WorkflowInputData,
    WorkflowOutputData,
} from "../lib/types";
import { getNodeDefinition } from "../lib/node-registry";

// Mock logger
vi.mock("../app/logger", () => ({
    default: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

describe("WorkflowEngine Nested Subflows", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should pass image from subflow 1 output to subflow 2 input correctly", async () => {
        // Main Flow:
        // TextNode(prompt) -> Subflow1(in:prompt)
        // Subflow1(out:image) -> Subflow2(in:image)
        // Subflow2(out:video) -> Final Result
        
        const mainNodes = [
            { id: "text-1", type: "text", data: { type: "text", name: "Text", text: "A beautiful cat" } },
            { id: "sub-1-node", type: "custom-workflow", data: { type: "custom-workflow", name: "Subflow 1", subWorkflowId: "flow-1", subWorkflowVersion: "1.0.1" } },
            { id: "sub-2-node", type: "custom-workflow", data: { type: "custom-workflow", name: "Subflow 2", subWorkflowId: "flow-2", subWorkflowVersion: "1.0.1" } },
        ] as Node<NodeData>[];

        const mainEdges = [
            { id: "e1", source: "text-1", target: "sub-1-node", targetHandle: "s1-in-prompt" },
            { id: "e2", source: "sub-1-node", sourceHandle: "s1-out-image", target: "sub-2-node", targetHandle: "s2-in-image" },
        ] as Edge[];

        // Subflow 1: WorkflowInput(prompt) -> ImageNode -> WorkflowOutput(image)
        const subflow1 = {
            nodes: [
                { id: "s1-in-prompt", type: "workflow-input", data: { type: "workflow-input", name: "Prompt In", portName: "prompt", portType: "string" } },
                { id: "s1-image-gen", type: "image", data: { type: "image", name: "Image Gen", prompt: "", images: [], model: "m1", aspectRatio: "1:1", resolution: "1K" } },
                { id: "s1-out-image", type: "workflow-output", data: { type: "workflow-output", name: "Image Out", portName: "image", portType: "image" } },
            ],
            edges: [
                { id: "s1-e1", source: "s1-in-prompt", target: "s1-image-gen", targetHandle: "prompt-input" },
                { id: "s1-e2", source: "s1-image-gen", target: "s1-out-image" },
            ]
        };

        // Subflow 2: WorkflowInput(image) -> VideoNode -> WorkflowOutput(video)
        const subflow2 = {
            nodes: [
                { id: "s2-in-image", type: "workflow-input", data: { type: "workflow-input", name: "Image In", portName: "image", portType: "image" } },
                { id: "s2-video-gen", type: "video", data: { type: "video", name: "Video Gen", prompt: "A cat moving", images: [], model: "v1", aspectRatio: "16:9", duration: 4, resolution: "720p" } },
                { id: "s2-out-video", type: "workflow-output", data: { type: "workflow-output", name: "Video Out", portName: "video", portType: "video" } },
            ],
            edges: [
                { id: "s2-e1", source: "s2-in-image", target: "s2-video-gen", targetHandle: "image-input" },
                { id: "s2-e2", source: "s2-video-gen", target: "s2-out-video" },
            ]
        };

        // Mock fetch to return subflow definitions
        const mockFetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("flow-1")) return Promise.resolve({ ok: true, json: async () => subflow1 });
            if (url.includes("flow-2")) return Promise.resolve({ ok: true, json: async () => subflow2 });
            if (url.includes("generate-image")) return Promise.resolve({ ok: true, json: async () => ({ imageUrl: "gs://bucket/cat.png" }) });
            if (url.includes("generate-video")) return Promise.resolve({ ok: true, json: async () => ({ videoUrl: "gs://bucket/cat.mp4" }) });
            return Promise.reject(new Error("Unknown URL: " + url));
        });

        const engine = new WorkflowEngine(mainNodes, mainEdges, () => {}, { fetch: mockFetch });
        await engine.run();

        // Check Subflow 1 result
        const s1Result = engine.executionResults.get("sub-1-node") as any;
        expect(s1Result.results["s1-out-image"]).toBeDefined();
        const s1ImageOutput = s1Result.results["s1-out-image"].value;
        expect(s1ImageOutput.images).toContain("gs://bucket/cat.png");

        // Check Subflow 2 result
        const s2Result = engine.executionResults.get("sub-2-node") as any;
        expect(s2Result.results["s2-out-video"]).toBeDefined();
        const s2VideoOutput = s2Result.results["s2-out-video"].value;
        expect(s2VideoOutput.videoUrl).toBe("gs://bucket/cat.mp4");

        // Verify that Subflow 2's VideoNode received the image from Subflow 1
        // We can check the fetch calls for generate-video
        const videoGenCall = mockFetch.mock.calls.find(call => call[0].includes("generate-video"));
        expect(videoGenCall).toBeDefined();
        const videoGenBody = JSON.parse(videoGenCall[1].body);
        expect(videoGenBody.images).toContainEqual({ url: "gs://bucket/cat.png", type: "image/png" });
    });
});
