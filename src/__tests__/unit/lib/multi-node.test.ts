/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkflowEngine } from "@/lib/flow/workflow-engine";
import { Node, Edge } from "@xyflow/react";
import { NodeData } from "@/lib/types";
import { MODELS } from "@/lib/constants";

// Mock logger
vi.mock("@/app/logger", () => ({
    default: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

describe("WorkflowEngine Multi-Node Integration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should execute a linear workflow: Text -> LLM -> Image", async () => {
        const nodes: Node<NodeData>[] = [
            {
                id: "text-1",
                type: "text",
                position: { x: 0, y: 0 },
                data: {
                    type: "text",
                    name: "Initial Prompt",
                    text: "A magical forest",
                },
            },
            {
                id: "llm-1",
                type: "llm",
                position: { x: 0, y: 0 },
                data: {
                    type: "llm",
                    name: "Enhance Prompt",
                    model: MODELS.TEXT.GEMINI_3_5_FLASH,
                    instructions:
                        "Enhance this concept into a detailed image generation prompt.",
                    outputType: "text",
                    strictMode: false,
                },
            },
            {
                id: "image-1",
                type: "image",
                position: { x: 0, y: 0 },
                data: {
                    type: "image",
                    name: "Generate Image",
                    prompt: "", // will be filled by input
                    images: [],
                    model: MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE,
                    aspectRatio: "16:9",
                    imageSize: "1K",
                    groundingGoogleSearch: false,
                    groundingImageSearch: false,
                },
            },
        ];

        const edges: Edge[] = [
            {
                id: "e1",
                source: "text-1",
                sourceHandle: "text-output",
                target: "llm-1",
                targetHandle: "prompts-input",
            },
            {
                id: "e2",
                source: "llm-1",
                sourceHandle: "text-output",
                target: "image-1",
                targetHandle: "prompt-input",
            },
        ];

        const mockFetch = vi.fn().mockImplementation((url: string) => {
            if (
                url.includes("generate-text") ||
                url.includes("primitives/llm/execute")
            ) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        text: "A highly detailed, magical glowing forest with giant mushrooms and fireflies, fantasy concept art.",
                    }),
                });
            }
            if (
                url.includes("generate-image") ||
                url.includes("primitives/image/execute")
            ) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        imageUrl: "gs://bucket/magical-forest.png",
                    }),
                });
            }
            return Promise.reject(new Error("Unknown URL: " + url));
        });

        const engine = new WorkflowEngine(nodes, edges, () => {}, {
            fetch: mockFetch,
        });
        await engine.run();

        // Check LLM result
        const llmResult = engine.getResult("llm-1") as any;
        expect(llmResult?.output).toBe(
            "A highly detailed, magical glowing forest with giant mushrooms and fireflies, fantasy concept art.",
        );

        // Check Image result
        const imageResult = engine.getResult("image-1") as any;
        expect(imageResult?.images).toContain("gs://bucket/magical-forest.png");

        // Verify API calls
        expect(mockFetch).toHaveBeenCalledTimes(2);

        // Verify LLM received correct text
        const llmCall = mockFetch.mock.calls.find(
            (c) =>
                c[0].includes("generate-text") ||
                c[0].includes("primitives/llm/execute"),
        );
        const llmBody = JSON.parse(llmCall![1].body);
        expect(
            llmBody.parts.some(
                (p: any) => p.text && p.text.includes("A magical forest"),
            ),
        ).toBe(true);
        // Verify Image received correct enhanced prompt
        const imgCall = mockFetch.mock.calls.find(
            (c) =>
                c[0].includes("generate-image") ||
                c[0].includes("primitives/image/execute"),
        );
        const imgBody = JSON.parse(imgCall![1].body);
        expect(imgBody.prompt).toContain(
            "A highly detailed, magical glowing forest",
        );
    });

    it("should mock batch behavior correctly for multiple inputs to LLM", async () => {
        const nodes: Node<NodeData>[] = [
            {
                id: "text-1",
                type: "text",
                position: { x: 0, y: 0 },
                data: {
                    type: "text",
                    name: "Subject",
                    text: "A cat",
                },
            },
            {
                id: "text-2",
                type: "text",
                position: { x: 0, y: 0 },
                data: {
                    type: "text",
                    name: "Style",
                    text: "Cyberpunk",
                },
            },
            {
                id: "llm-batch",
                type: "llm",
                position: { x: 0, y: 0 },
                data: {
                    type: "llm",
                    name: "Combiner",
                    model: MODELS.TEXT.GEMINI_3_5_FLASH,
                    instructions: "Combine the inputs into a story.",
                    outputType: "text",
                    strictMode: false,
                },
            },
        ];

        const edges: Edge[] = [
            {
                id: "e1",
                source: "text-1",
                target: "llm-batch",
                targetHandle: "prompts-input",
            },
            {
                id: "e2",
                source: "text-2",
                target: "llm-batch",
                targetHandle: "prompts-input",
            },
        ];

        const mockFetch = vi.fn().mockImplementation((url: string) => {
            if (
                url.includes("generate-text") ||
                url.includes("primitives/llm/execute")
            ) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        text: "A cyberpunk cat roaming the neon streets.",
                    }),
                });
            }
            return Promise.reject(new Error("Unknown URL: " + url));
        });

        const engine = new WorkflowEngine(nodes, edges, () => {}, {
            fetch: mockFetch,
        });
        await engine.run();

        const llmResult = engine.getResult("llm-batch") as any;
        expect(llmResult?.output).toBe(
            "A cyberpunk cat roaming the neon streets.",
        );

        const llmCall = mockFetch.mock.calls.find(
            (c) =>
                c[0].includes("generate-text") ||
                c[0].includes("primitives/llm/execute"),
        );
        const body = JSON.parse(llmCall![1].body);

        // Ensure both texts were provided as parts (either exactly or within the text)
        expect(
            body.parts.some((p: any) => p.text && p.text.includes("A cat")),
        ).toBe(true);
        expect(
            body.parts.some((p: any) => p.text && p.text.includes("Cyberpunk")),
        ).toBe(true);
    });
});
