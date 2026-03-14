import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { WorkflowEngine } from "../lib/workflow-engine";
import { Node, Edge } from "@xyflow/react";
import { NodeData, LLMData, FileData, VideoData } from "../lib/types";

// Mock geminiService
vi.mock("../lib/services/gemini.service", () => ({
    geminiService: {
        generateText: vi.fn(),
    },
}));

describe("LLM Multimodal Integration", () => {
    let onNodeUpdate: Mock<(nodeId: string, data: Partial<NodeData>) => void>;
    let mockFetch: Mock<typeof fetch>;

    beforeEach(() => {
        vi.clearAllMocks();
        onNodeUpdate = vi.fn();
        mockFetch = vi
            .fn()
            .mockImplementation((input: string | URL | Request) => {
                const url = input.toString();
                if (url === "/api/generate-text") {
                    return Promise.resolve({
                        ok: true,
                        json: () =>
                            Promise.resolve({ text: "Mocked Response" }),
                    } as unknown as Response);
                }
                if (url === "/api/generate-video") {
                    return Promise.resolve({
                        ok: true,
                        json: () =>
                            Promise.resolve({
                                videoUrl: "gs://mocked-video.mp4",
                            }),
                    } as unknown as Response);
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({}),
                } as unknown as Response);
            });
    });

    it("should execute a workflow with FileNode (PDF) and LLMNode", async () => {
        // ... (nodes and edges same as before)
        const nodes: Node<NodeData>[] = [
            {
                id: "file-1",
                type: "file",
                data: {
                    type: "file",
                    name: "PDF File",
                    fileType: "pdf",
                    gcsUri: "gs://bucket/test.pdf",
                    fileUrl: "https://signed-url/test.pdf",
                    fileName: "test.pdf",
                    outputType: "text", // Although FileData doesn't have it, BaseNodeData might be mixed up in test
                } as unknown as FileData,
                position: { x: 0, y: 0 },
            },
            {
                id: "llm-1",
                type: "llm",
                data: {
                    type: "llm",
                    name: "Summarizer",
                    model: "gemini-1.5-flash",
                    instructions: "Summarize the attached PDF.",
                    outputType: "text",
                    strictMode: false,
                } as LLMData,
                position: { x: 250, y: 0 },
            },
        ];

        const edges: Edge[] = [
            {
                id: "e1-2",
                source: "file-1",
                target: "llm-1",
                targetHandle: "file-input",
            },
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ text: "This is a PDF summary." }),
        } as unknown as Response);

        const engine = new WorkflowEngine(nodes, edges, onNodeUpdate, {
            fetch: mockFetch,
        });
        await engine.run();

        expect(mockFetch).toHaveBeenCalledWith(
            "/api/generate-text",
            expect.objectContaining({
                body: expect.stringContaining('"uri":"gs://bucket/test.pdf"'),
            }),
        );

        expect(onNodeUpdate).toHaveBeenCalledWith(
            "llm-1",
            expect.objectContaining({
                output: "This is a PDF summary.",
            }),
        );
    });

    it("should execute a workflow with VideoNode and LLMNode", async () => {
        const nodes: Node<NodeData>[] = [
            {
                id: "video-1",
                type: "video",
                data: {
                    type: "video",
                    name: "Input Video",
                    prompt: "A cool video",
                    videoUrl: "gs://bucket/video.mp4",
                    images: [],
                    aspectRatio: "16:9",
                    duration: 4,
                    model: "veo-3.1-fast-generate-preview",
                    generateAudio: true,
                    resolution: "720p",
                } as VideoData,
                position: { x: 0, y: 0 },
            },
            {
                id: "llm-1",
                type: "llm",
                data: {
                    type: "llm",
                    name: "Analyzer",
                    model: "gemini-1.5-flash",
                    instructions: "What happens in this video?",
                    outputType: "text",
                    strictMode: false,
                } as LLMData,
                position: { x: 250, y: 0 },
            },
        ];

        const edges: Edge[] = [
            {
                id: "e1-2",
                source: "video-1",
                target: "llm-1",
                targetHandle: "file-input",
            },
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ videoUrl: "gs://bucket/video.mp4" }),
        } as unknown as Response);
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ text: "A cat jumps over a fence." }),
        } as unknown as Response);

        const engine = new WorkflowEngine(nodes, edges, onNodeUpdate, {
            fetch: mockFetch,
        });
        await engine.run();

        expect(mockFetch).toHaveBeenCalledWith(
            "/api/generate-text",
            expect.objectContaining({
                body: expect.stringContaining('"uri":"gs://bucket/video.mp4"'),
            }),
        );

        expect(onNodeUpdate).toHaveBeenCalledWith(
            "llm-1",
            expect.objectContaining({
                output: "A cat jumps over a fence.",
            }),
        );
    });

    it("should handle mixed inputs (Image + PDF + Video)", async () => {
        const nodes: Node<NodeData>[] = [
            {
                id: "file-pdf",
                type: "file",
                data: {
                    type: "file",
                    name: "PDF",
                    fileType: "pdf",
                    gcsUri: "gs://pdf",
                    fileUrl: "",
                    fileName: "test.pdf",
                } as FileData,
                position: { x: 0, y: 0 },
            },
            {
                id: "video-1",
                type: "video",
                data: {
                    type: "video",
                    name: "VID",
                    prompt: "p",
                    videoUrl: "gs://vid",
                    images: [],
                    aspectRatio: "16:9",
                    duration: 4,
                    model: "veo-3.1-fast-generate-preview",
                    generateAudio: true,
                    resolution: "720p",
                } as VideoData,
                position: { x: 0, y: 100 },
            },
            {
                id: "llm-1",
                type: "llm",
                data: {
                    type: "llm",
                    name: "Omni-Analyzer",
                    model: "gemini-1.5-flash",
                    instructions: "Analyze everything.",
                    outputType: "text",
                    strictMode: false,
                } as LLMData,
                position: { x: 250, y: 50 },
            },
        ];

        const edges: Edge[] = [
            {
                id: "e1",
                source: "file-pdf",
                target: "llm-1",
                targetHandle: "file-input",
            },
            {
                id: "e2",
                source: "video-1",
                target: "llm-1",
                targetHandle: "file-input",
            },
        ];

        mockFetch.mockImplementation((input: string | URL | Request) => {
            const url = input.toString();
            if (url === "/api/generate-video") {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ videoUrl: "gs://vid" }),
                } as unknown as Response);
            }
            if (url === "/api/generate-text") {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ text: "Analysis complete." }),
                } as unknown as Response);
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
            } as unknown as Response);
        });

        const engine = new WorkflowEngine(nodes, edges, onNodeUpdate, {
            fetch: mockFetch,
        });
        await engine.run();

        expect(mockFetch).toHaveBeenCalledWith(
            "/api/generate-text",
            expect.objectContaining({
                body: expect.stringContaining('"uri":"gs://pdf"'),
            }),
        );
        expect(mockFetch).toHaveBeenCalledWith(
            "/api/generate-text",
            expect.objectContaining({
                body: expect.stringContaining('"uri":"gs://vid"'),
            }),
        );
    });
});
