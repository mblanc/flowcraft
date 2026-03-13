/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkflowEngine } from "../lib/workflow-engine";
import { Node, Edge } from "@xyflow/react";
import { NodeData } from "../lib/types";

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
            {
                id: "text-1",
                type: "text",
                data: { type: "text", name: "Text", text: "A beautiful cat" },
            },
            {
                id: "sub-1-node",
                type: "custom-workflow",
                data: {
                    type: "custom-workflow",
                    name: "Subflow 1",
                    subWorkflowId: "flow-1",
                    subWorkflowVersion: "1.0.1",
                },
            },
            {
                id: "sub-2-node",
                type: "custom-workflow",
                data: {
                    type: "custom-workflow",
                    name: "Subflow 2",
                    subWorkflowId: "flow-2",
                    subWorkflowVersion: "1.0.1",
                },
            },
        ] as Node<NodeData>[];

        const mainEdges = [
            {
                id: "e1",
                source: "text-1",
                target: "sub-1-node",
                targetHandle: "s1-in-prompt",
            },
            {
                id: "e2",
                source: "sub-1-node",
                sourceHandle: "s1-out-image",
                target: "sub-2-node",
                targetHandle: "s2-in-image",
            },
        ] as Edge[];

        // Subflow 1: WorkflowInput(prompt) -> ImageNode -> WorkflowOutput(image)
        const subflow1 = {
            nodes: [
                {
                    id: "s1-in-prompt",
                    type: "workflow-input",
                    data: {
                        type: "workflow-input",
                        name: "Prompt In",
                        portName: "prompt",
                        portType: "text",
                    },
                },
                {
                    id: "s1-image-gen",
                    type: "image",
                    data: {
                        type: "image",
                        name: "Image Gen",
                        prompt: "",
                        images: [],
                        model: "m1",
                        aspectRatio: "1:1",
                        resolution: "1K",
                    },
                },
                {
                    id: "s1-out-image",
                    type: "workflow-output",
                    data: {
                        type: "workflow-output",
                        name: "Image Out",
                        portName: "image",
                        portType: "image",
                    },
                },
            ],
            edges: [
                {
                    id: "s1-e1",
                    source: "s1-in-prompt",
                    target: "s1-image-gen",
                    targetHandle: "prompt-input",
                },
                { id: "s1-e2", source: "s1-image-gen", target: "s1-out-image" },
            ],
        };

        // Subflow 2: WorkflowInput(image) -> VideoNode -> WorkflowOutput(video)
        const subflow2 = {
            nodes: [
                {
                    id: "s2-in-image",
                    type: "workflow-input",
                    data: {
                        type: "workflow-input",
                        name: "Image In",
                        portName: "image",
                        portType: "image",
                    },
                },
                {
                    id: "s2-video-gen",
                    type: "video",
                    data: {
                        type: "video",
                        name: "Video Gen",
                        prompt: "A cat moving",
                        images: [],
                        model: "v1",
                        aspectRatio: "16:9",
                        duration: 4,
                        resolution: "720p",
                    },
                },
                {
                    id: "s2-out-video",
                    type: "workflow-output",
                    data: {
                        type: "workflow-output",
                        name: "Video Out",
                        portName: "video",
                        portType: "video",
                    },
                },
            ],
            edges: [
                {
                    id: "s2-e1",
                    source: "s2-in-image",
                    target: "s2-video-gen",
                    targetHandle: "image-input",
                },
                { id: "s2-e2", source: "s2-video-gen", target: "s2-out-video" },
            ],
        };

        // Mock fetch to return subflow definitions
        const mockFetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("flow-1"))
                return Promise.resolve({
                    ok: true,
                    json: async () => subflow1,
                });
            if (url.includes("flow-2"))
                return Promise.resolve({
                    ok: true,
                    json: async () => subflow2,
                });
            if (url.includes("generate-image"))
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ imageUrl: "gs://bucket/cat.png" }),
                });
            if (url.includes("generate-video"))
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ videoUrl: "gs://bucket/cat.mp4" }),
                });
            return Promise.reject(new Error("Unknown URL: " + url));
        });

        const engine = new WorkflowEngine(mainNodes, mainEdges, () => {}, {
            fetch: mockFetch,
        });
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
        const videoGenCall = mockFetch.mock.calls.find((call) =>
            call[0].includes("generate-video"),
        );
        expect(videoGenCall).toBeDefined();
        const videoGenBody = JSON.parse(videoGenCall![1].body);
        expect(videoGenBody.images).toContainEqual({
            url: "gs://bucket/cat.png",
            type: "image/png",
        });
    });

    it("should pass image from subflow output to regular resize node correctly", async () => {
        // Main Flow:
        // TextNode(prompt) -> Subflow1(in:prompt)
        // Subflow1(out:image) -> ResizeNode(in:image)
        // This tests the specific case where a sub-workflow output connects to a regular node

        const mainNodes = [
            {
                id: "text-1",
                type: "text",
                data: {
                    type: "text",
                    name: "Text",
                    text: "A beautiful landscape",
                },
            },
            {
                id: "sub-1-node",
                type: "custom-workflow",
                data: {
                    type: "custom-workflow",
                    name: "Image Generator",
                    subWorkflowId: "flow-1",
                    subWorkflowVersion: "1.0.1",
                },
            },
            {
                id: "resize-node",
                type: "resize",
                data: { type: "resize", name: "Resize", aspectRatio: "16:9" },
            },
        ] as Node<NodeData>[];

        const mainEdges = [
            {
                id: "e1",
                source: "text-1",
                target: "sub-1-node",
                targetHandle: "s1-in-prompt",
            },
            {
                id: "e2",
                source: "sub-1-node",
                sourceHandle: "s1-out-image",
                target: "resize-node",
                targetHandle: "image-input",
            },
        ] as Edge[];

        // Subflow 1: WorkflowInput(string) -> ImageNode -> WorkflowOutput(image)
        const subflow1 = {
            nodes: [
                {
                    id: "s1-in-prompt",
                    type: "workflow-input",
                    data: {
                        type: "workflow-input",
                        name: "Prompt In",
                        portName: "prompt",
                        portType: "text",
                    },
                },
                {
                    id: "s1-image-gen",
                    type: "image",
                    data: {
                        type: "image",
                        name: "Image Gen",
                        prompt: "",
                        images: [],
                        model: "m1",
                        aspectRatio: "1:1",
                        resolution: "1K",
                    },
                },
                {
                    id: "s1-out-image",
                    type: "workflow-output",
                    data: {
                        type: "workflow-output",
                        name: "Image Out",
                        portName: "image",
                        portType: "image",
                    },
                },
            ],
            edges: [
                {
                    id: "s1-e1",
                    source: "s1-in-prompt",
                    target: "s1-image-gen",
                    targetHandle: "prompt-input",
                },
                { id: "s1-e2", source: "s1-image-gen", target: "s1-out-image" },
            ],
        };

        // Mock fetch to return subflow definitions and API responses
        const mockFetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("flow-1"))
                return Promise.resolve({
                    ok: true,
                    json: async () => subflow1,
                });
            if (url.includes("generate-image"))
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        imageUrl: "gs://bucket/landscape.png",
                    }),
                });
            if (url.includes("resize-image"))
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        imageUrl: "gs://bucket/landscape-resized.png",
                    }),
                });
            return Promise.reject(new Error("Unknown URL: " + url));
        });

        const engine = new WorkflowEngine(mainNodes, mainEdges, () => {}, {
            fetch: mockFetch,
        });
        await engine.run();

        // Check Subflow result
        const subResult = engine.executionResults.get("sub-1-node") as any;
        expect(subResult.results["s1-out-image"]).toBeDefined();
        const imageOutput = subResult.results["s1-out-image"].value;
        expect(imageOutput.images).toContain("gs://bucket/landscape.png");

        // Check Resize node result
        const resizeResult = engine.executionResults.get("resize-node") as any;
        expect(resizeResult.output).toBe("gs://bucket/landscape-resized.png");

        // Verify that Resize node received the image from the sub-workflow
        const resizeCall = mockFetch.mock.calls.find((call) =>
            call[0].includes("resize-image"),
        );
        expect(resizeCall).toBeDefined();
        const resizeBody = JSON.parse(resizeCall![1].body);
        expect(resizeBody.image).toBe("gs://bucket/landscape.png");
    });

    it("should pass image from subflow output to regular upscale node correctly", async () => {
        // Main Flow:
        // TextNode(prompt) -> Subflow1(in:prompt)
        // Subflow1(out:image) -> UpscaleNode(in:image)

        const mainNodes = [
            {
                id: "text-1",
                type: "text",
                data: {
                    type: "text",
                    name: "Text",
                    text: "A detailed portrait",
                },
            },
            {
                id: "sub-1-node",
                type: "custom-workflow",
                data: {
                    type: "custom-workflow",
                    name: "Image Generator",
                    subWorkflowId: "flow-1",
                    subWorkflowVersion: "1.0.1",
                },
            },
            {
                id: "upscale-node",
                type: "upscale",
                data: {
                    type: "upscale",
                    name: "Upscale",
                    image: "",
                    upscaleFactor: "x2",
                },
            },
        ] as Node<NodeData>[];

        const mainEdges = [
            {
                id: "e1",
                source: "text-1",
                target: "sub-1-node",
                targetHandle: "s1-in-prompt",
            },
            {
                id: "e2",
                source: "sub-1-node",
                sourceHandle: "s1-out-image",
                target: "upscale-node",
                targetHandle: "image-input",
            },
        ] as Edge[];

        // Subflow 1: WorkflowInput(string) -> ImageNode -> WorkflowOutput(image)
        const subflow1 = {
            nodes: [
                {
                    id: "s1-in-prompt",
                    type: "workflow-input",
                    data: {
                        type: "workflow-input",
                        name: "Prompt In",
                        portName: "prompt",
                        portType: "text",
                    },
                },
                {
                    id: "s1-image-gen",
                    type: "image",
                    data: {
                        type: "image",
                        name: "Image Gen",
                        prompt: "",
                        images: [],
                        model: "m1",
                        aspectRatio: "1:1",
                        resolution: "1K",
                    },
                },
                {
                    id: "s1-out-image",
                    type: "workflow-output",
                    data: {
                        type: "workflow-output",
                        name: "Image Out",
                        portName: "image",
                        portType: "image",
                    },
                },
            ],
            edges: [
                {
                    id: "s1-e1",
                    source: "s1-in-prompt",
                    target: "s1-image-gen",
                    targetHandle: "prompt-input",
                },
                { id: "s1-e2", source: "s1-image-gen", target: "s1-out-image" },
            ],
        };

        // Mock fetch to return subflow definitions and API responses
        const mockFetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("flow-1"))
                return Promise.resolve({
                    ok: true,
                    json: async () => subflow1,
                });
            if (url.includes("generate-image"))
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        imageUrl: "gs://bucket/portrait.png",
                    }),
                });
            if (url.includes("upscale-image"))
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        imageUrl: "gs://bucket/portrait-upscaled.png",
                    }),
                });
            return Promise.reject(new Error("Unknown URL: " + url));
        });

        const engine = new WorkflowEngine(mainNodes, mainEdges, () => {}, {
            fetch: mockFetch,
        });
        await engine.run();

        // Check Subflow result
        const subResult = engine.executionResults.get("sub-1-node") as any;
        expect(subResult.results["s1-out-image"]).toBeDefined();
        const imageOutput = subResult.results["s1-out-image"].value;
        expect(imageOutput.images).toContain("gs://bucket/portrait.png");

        // Check Upscale node result
        const upscaleResult = engine.executionResults.get(
            "upscale-node",
        ) as any;
        expect(upscaleResult.image).toBe("gs://bucket/portrait-upscaled.png");

        // Verify that Upscale node received the image from the sub-workflow
        const upscaleCall = mockFetch.mock.calls.find((call) =>
            call[0].includes("upscale-image"),
        );
        expect(upscaleCall).toBeDefined();
        const upscaleBody = JSON.parse(upscaleCall![1].body);
        expect(upscaleBody.image).toBe("gs://bucket/portrait.png");
    });

    it("should handle missing sourceHandle by using single available output", async () => {
        // Test the fallback behavior when sourceHandle is missing but there's only one output

        const mainNodes = [
            {
                id: "text-1",
                type: "text",
                data: { type: "text", name: "Text", text: "Test prompt" },
            },
            {
                id: "sub-1-node",
                type: "custom-workflow",
                data: {
                    type: "custom-workflow",
                    name: "Image Generator",
                    subWorkflowId: "flow-1",
                    subWorkflowVersion: "1.0.1",
                },
            },
            {
                id: "resize-node",
                type: "resize",
                data: { type: "resize", name: "Resize", aspectRatio: "16:9" },
            },
        ] as Node<NodeData>[];

        // Note: Edge is missing sourceHandle - this tests the fallback behavior
        const mainEdges = [
            {
                id: "e1",
                source: "text-1",
                target: "sub-1-node",
                targetHandle: "s1-in-prompt",
            },
            {
                id: "e2",
                source: "sub-1-node",
                target: "resize-node",
                targetHandle: "image-input",
            }, // Missing sourceHandle!
        ] as Edge[];

        // Subflow with single output
        const subflow1 = {
            nodes: [
                {
                    id: "s1-in-prompt",
                    type: "workflow-input",
                    data: {
                        type: "workflow-input",
                        name: "Prompt In",
                        portName: "prompt",
                        portType: "text",
                    },
                },
                {
                    id: "s1-image-gen",
                    type: "image",
                    data: {
                        type: "image",
                        name: "Image Gen",
                        prompt: "",
                        images: [],
                        model: "m1",
                        aspectRatio: "1:1",
                        resolution: "1K",
                    },
                },
                {
                    id: "s1-out-image",
                    type: "workflow-output",
                    data: {
                        type: "workflow-output",
                        name: "Image Out",
                        portName: "image",
                        portType: "image",
                    },
                },
            ],
            edges: [
                {
                    id: "s1-e1",
                    source: "s1-in-prompt",
                    target: "s1-image-gen",
                    targetHandle: "prompt-input",
                },
                { id: "s1-e2", source: "s1-image-gen", target: "s1-out-image" },
            ],
        };

        const mockFetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("flow-1"))
                return Promise.resolve({
                    ok: true,
                    json: async () => subflow1,
                });
            if (url.includes("generate-image"))
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        imageUrl: "gs://bucket/fallback-test.png",
                    }),
                });
            if (url.includes("resize-image"))
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        imageUrl: "gs://bucket/fallback-resized.png",
                    }),
                });
            return Promise.reject(new Error("Unknown URL: " + url));
        });

        const engine = new WorkflowEngine(mainNodes, mainEdges, () => {}, {
            fetch: mockFetch,
        });
        await engine.run();

        // The resize should still work due to the single-output fallback
        const resizeResult = engine.executionResults.get("resize-node") as any;
        expect(resizeResult.output).toBe("gs://bucket/fallback-resized.png");

        // Verify that Resize node received the image from the sub-workflow fallback
        const resizeCall = mockFetch.mock.calls.find((call) =>
            call[0].includes("resize-image"),
        );
        expect(resizeCall).toBeDefined();
        const resizeBody = JSON.parse(resizeCall![1].body);
        expect(resizeBody.image).toBe("gs://bucket/fallback-test.png");
    });

    it("should pass image from subflow output to LLM node file input correctly", async () => {
        // Main Flow:
        // TextNode(prompt) -> Subflow1(in:prompt)
        // Subflow1(out:image) -> LLMNode(file-input)
        // This is the exact scenario reported by user: sub-workflow generates image, LLM node should receive it

        const mainNodes = [
            {
                id: "text-1",
                type: "text",
                data: {
                    type: "text",
                    name: "Text",
                    text: "Generate a cat image",
                },
            },
            {
                id: "sub-1-node",
                type: "custom-workflow",
                data: {
                    type: "custom-workflow",
                    name: "Image Generator",
                    subWorkflowId: "flow-1",
                    subWorkflowVersion: "1.0.1",
                },
            },
            {
                id: "llm-node",
                type: "llm",
                data: {
                    type: "llm",
                    name: "LLM",
                    model: "gemini-3-flash-preview",
                    instructions: "Describe this image",
                    outputType: "text",
                },
            },
        ] as Node<NodeData>[];

        // Edge with proper sourceHandle set
        const mainEdges = [
            {
                id: "e1",
                source: "text-1",
                target: "sub-1-node",
                targetHandle: "s1-in-prompt",
            },
            {
                id: "e2",
                source: "sub-1-node",
                sourceHandle: "s1-out-image",
                target: "llm-node",
                targetHandle: "file-input",
            },
        ] as Edge[];

        // Subflow 1: WorkflowInput(string) -> ImageNode -> WorkflowOutput(image)
        const subflow1 = {
            nodes: [
                {
                    id: "s1-in-prompt",
                    type: "workflow-input",
                    data: {
                        type: "workflow-input",
                        name: "Prompt In",
                        portName: "prompt",
                        portType: "text",
                    },
                },
                {
                    id: "s1-image-gen",
                    type: "image",
                    data: {
                        type: "image",
                        name: "Image Gen",
                        prompt: "",
                        images: [],
                        model: "m1",
                        aspectRatio: "1:1",
                        resolution: "1K",
                    },
                },
                {
                    id: "s1-out-image",
                    type: "workflow-output",
                    data: {
                        type: "workflow-output",
                        name: "Image Out",
                        portName: "image",
                        portType: "image",
                    },
                },
            ],
            edges: [
                {
                    id: "s1-e1",
                    source: "s1-in-prompt",
                    target: "s1-image-gen",
                    targetHandle: "prompt-input",
                },
                { id: "s1-e2", source: "s1-image-gen", target: "s1-out-image" },
            ],
        };

        // Mock fetch to return subflow definitions and API responses
        const mockFetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("flow-1"))
                return Promise.resolve({
                    ok: true,
                    json: async () => subflow1,
                });
            if (url.includes("generate-image"))
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        imageUrl: "gs://bucket/cat-image.png",
                    }),
                });
            if (url.includes("generate-text"))
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ text: "This is a cute cat" }),
                });
            return Promise.reject(new Error("Unknown URL: " + url));
        });

        const engine = new WorkflowEngine(mainNodes, mainEdges, () => {}, {
            fetch: mockFetch,
        });
        await engine.run();

        // Check Subflow result
        const subResult = engine.executionResults.get("sub-1-node") as any;
        expect(subResult.results["s1-out-image"]).toBeDefined();
        const imageOutput = subResult.results["s1-out-image"].value;
        expect(imageOutput.images).toContain("gs://bucket/cat-image.png");

        // Check LLM node result
        const llmResult = engine.executionResults.get("llm-node") as any;
        expect(llmResult.output).toBe("This is a cute cat");

        // CRITICAL: Verify that LLM node received the image from the sub-workflow
        const llmCall = mockFetch.mock.calls.find((call) =>
            call[0].includes("generate-text"),
        );
        expect(llmCall).toBeDefined();
        const llmBody = JSON.parse(llmCall![1].body);

        // The parts array should contain the image from the sub-workflow
        expect(llmBody.parts).toBeDefined();
        expect(llmBody.parts.length).toBeGreaterThan(0);
        expect(llmBody.parts).toContainEqual({
            kind: "uri",
            uri: "gs://bucket/cat-image.png",
            mimeType: "image/png",
        });
    });

    it("should pass image from subflow to LLM even when edge has no sourceHandle (single output fallback)", async () => {
        // Test the fallback behavior: edge from sub-workflow to LLM without sourceHandle
        // Should work when sub-workflow has only one output

        const mainNodes = [
            {
                id: "text-1",
                type: "text",
                data: {
                    type: "text",
                    name: "Text",
                    text: "Generate a dog image",
                },
            },
            {
                id: "sub-1-node",
                type: "custom-workflow",
                data: {
                    type: "custom-workflow",
                    name: "Image Generator",
                    subWorkflowId: "flow-1",
                    subWorkflowVersion: "1.0.1",
                },
            },
            {
                id: "llm-node",
                type: "llm",
                data: {
                    type: "llm",
                    name: "LLM",
                    model: "gemini-3-flash-preview",
                    instructions: "Describe this image",
                    outputType: "text",
                },
            },
        ] as Node<NodeData>[];

        // Edge WITHOUT sourceHandle - tests the fallback
        const mainEdges = [
            {
                id: "e1",
                source: "text-1",
                target: "sub-1-node",
                targetHandle: "s1-in-prompt",
            },
            {
                id: "e2",
                source: "sub-1-node",
                target: "llm-node",
                targetHandle: "file-input",
            }, // Missing sourceHandle!
        ] as Edge[];

        // Subflow with single output
        const subflow1 = {
            nodes: [
                {
                    id: "s1-in-prompt",
                    type: "workflow-input",
                    data: {
                        type: "workflow-input",
                        name: "Prompt In",
                        portName: "prompt",
                        portType: "text",
                    },
                },
                {
                    id: "s1-image-gen",
                    type: "image",
                    data: {
                        type: "image",
                        name: "Image Gen",
                        prompt: "",
                        images: [],
                        model: "m1",
                        aspectRatio: "1:1",
                        resolution: "1K",
                    },
                },
                {
                    id: "s1-out-image",
                    type: "workflow-output",
                    data: {
                        type: "workflow-output",
                        name: "Image Out",
                        portName: "image",
                        portType: "image",
                    },
                },
            ],
            edges: [
                {
                    id: "s1-e1",
                    source: "s1-in-prompt",
                    target: "s1-image-gen",
                    targetHandle: "prompt-input",
                },
                { id: "s1-e2", source: "s1-image-gen", target: "s1-out-image" },
            ],
        };

        const mockFetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("flow-1"))
                return Promise.resolve({
                    ok: true,
                    json: async () => subflow1,
                });
            if (url.includes("generate-image"))
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        imageUrl: "gs://bucket/dog-image.png",
                    }),
                });
            if (url.includes("generate-text"))
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ text: "This is a happy dog" }),
                });
            return Promise.reject(new Error("Unknown URL: " + url));
        });

        const engine = new WorkflowEngine(mainNodes, mainEdges, () => {}, {
            fetch: mockFetch,
        });
        await engine.run();

        // The LLM should still work due to single-output fallback
        const llmResult = engine.executionResults.get("llm-node") as any;
        expect(llmResult.output).toBe("This is a happy dog");

        // Verify LLM received the image even without explicit sourceHandle
        const llmCall = mockFetch.mock.calls.find((call) =>
            call[0].includes("generate-text"),
        );
        expect(llmCall).toBeDefined();
        const llmBody = JSON.parse(llmCall![1].body);
        expect(llmBody.parts).toBeDefined();
        expect(llmBody.parts.length).toBeGreaterThan(0);
        expect(llmBody.parts).toContainEqual({
            kind: "uri",
            uri: "gs://bucket/dog-image.png",
            mimeType: "image/png",
        });
    });

    it("should use stored results when executing single node after subflow was previously run", async () => {
        // This tests the scenario where:
        // 1. User runs full flow (subflow executes and stores results in node.data.results)
        // 2. User then executes only a downstream node (e.g., LLM) without re-running the subflow
        // The downstream node should use the stored results from the subflow's node data

        // Simulate a sub-workflow node that has already been executed
        // and has results stored in its data
        const mainNodes = [
            {
                id: "text-1",
                type: "text",
                data: {
                    type: "text",
                    name: "Text",
                    text: "Generate a cat image",
                },
            },
            {
                id: "sub-1-node",
                type: "custom-workflow",
                data: {
                    type: "custom-workflow",
                    name: "Image Generator",
                    subWorkflowId: "flow-1",
                    subWorkflowVersion: "1.0.1",
                    // These results were stored from a previous full-flow execution
                    results: {
                        "s1-out-image": {
                            value: {
                                type: "image",
                                images: [
                                    "gs://bucket/previously-generated-cat.png",
                                ],
                                prompt: "A cat",
                                aspectRatio: "1:1",
                                model: "m1",
                                resolution: "1K",
                                name: "Image Gen",
                            },
                        },
                    },
                },
            },
            {
                id: "llm-node",
                type: "llm",
                data: {
                    type: "llm",
                    name: "LLM",
                    model: "gemini-3-flash-preview",
                    instructions: "Describe this image",
                    outputType: "text",
                },
            },
        ] as Node<NodeData>[];

        const mainEdges = [
            {
                id: "e1",
                source: "text-1",
                target: "sub-1-node",
                targetHandle: "s1-in-prompt",
            },
            {
                id: "e2",
                source: "sub-1-node",
                sourceHandle: "s1-out-image",
                target: "llm-node",
                targetHandle: "file-input",
            },
        ] as Edge[];

        // Mock fetch - note that we should NOT call generate-image since we're only executing the LLM node
        const mockFetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("generate-text"))
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        text: "This is a previously generated cat",
                    }),
                });
            return Promise.reject(new Error("Unexpected URL: " + url));
        });

        const engine = new WorkflowEngine(mainNodes, mainEdges, () => {}, {
            fetch: mockFetch,
        });

        // Execute ONLY the LLM node (simulating clicking "Execute" on just that node)
        await engine.executeNode("llm-node");

        // Check LLM node result
        const llmResult = engine.executionResults.get("llm-node") as any;
        expect(llmResult.output).toBe("This is a previously generated cat");

        // Verify that LLM received the image from the stored sub-workflow results
        const llmCall = mockFetch.mock.calls.find((call) =>
            call[0].includes("generate-text"),
        );
        expect(llmCall).toBeDefined();
        const llmBody = JSON.parse(llmCall![1].body);

        // The LLM should have received the previously generated image
        expect(llmBody.parts).toBeDefined();
        expect(llmBody.parts.length).toBeGreaterThan(0);
        expect(llmBody.parts).toContainEqual({
            kind: "uri",
            uri: "gs://bucket/previously-generated-cat.png",
            mimeType: "image/png",
        });

        // Verify that generate-image was NOT called (we didn't re-run the subflow)
        const imageGenCall = mockFetch.mock.calls.find((call) =>
            call[0].includes("generate-image"),
        );
        expect(imageGenCall).toBeUndefined();
    });
});
