import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { GeminiService } from "../lib/services/gemini.service";
import * as genai from "@google/genai";

interface MockGoogleGenAIInstance {
    models: {
        generateContent: Mock;
        generateVideos: Mock;
        upscaleImage: Mock;
    };
    operations: {
        get: Mock;
    };
}

vi.mock("@google/genai", () => {
    const mockGoogleGenAI = vi.fn().mockImplementation(function (
        this: MockGoogleGenAIInstance,
    ) {
        this.models = {
            generateContent: vi.fn(),
            generateVideos: vi.fn(),
            upscaleImage: vi.fn(),
        };
        this.operations = {
            get: vi.fn(),
        };
    });

    return {
        GoogleGenAI: mockGoogleGenAI,
        createPartFromText: vi.fn((text) => ({ text })),
        createPartFromUri: vi.fn((uri, mimeType) => ({
            fileData: { fileUri: uri, mimeType },
        })),
        createPartFromBase64: vi.fn((data, mimeType) => ({
            inlineData: { data, mimeType },
        })),
        VideoGenerationReferenceType: {
            ASSET: "ASSET",
        },
    };
});

describe("GeminiService", () => {
    let geminiService: GeminiService;
    let mockAi: {
        models: {
            generateContent: Mock;
            generateVideos: Mock;
            upscaleImage: Mock;
        };
        operations: {
            get: Mock;
        };
    };

    beforeEach(() => {
        vi.clearAllMocks();
        geminiService = new GeminiService();
        mockAi = (geminiService as unknown as { ai: typeof mockAi }).ai;
    });

    describe("generateText with multi-modal inputs", () => {
        it("should correctly handle PDF files", async () => {
            const mockResponse = {
                candidates: [
                    {
                        content: {
                            parts: [{ text: "This is a summary of the PDF." }],
                        },
                    },
                ],
            };
            mockAi.models.generateContent.mockResolvedValue(mockResponse);

            const options = {
                prompt: "Summarize this PDF",
                files: [
                    { url: "gs://bucket/file.pdf", type: "application/pdf" },
                ],
            };

            const result = await geminiService.generateText(options);

            expect(result).toBe("This is a summary of the PDF.");
            expect(genai.createPartFromUri).toHaveBeenCalledWith(
                "gs://bucket/file.pdf",
                "application/pdf",
            );
            expect(mockAi.models.generateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    contents: [
                        { text: "Summarize this PDF" },
                        {
                            fileData: {
                                fileUri: "gs://bucket/file.pdf",
                                mimeType: "application/pdf",
                            },
                        },
                    ],
                }),
            );
        });

        it("should correctly handle video files", async () => {
            const mockResponse = {
                candidates: [
                    {
                        content: {
                            parts: [{ text: "The video shows a cat." }],
                        },
                    },
                ],
            };
            mockAi.models.generateContent.mockResolvedValue(mockResponse);

            const options = {
                prompt: "What is in this video?",
                files: [{ url: "gs://bucket/video.mp4", type: "video/mp4" }],
            };

            const result = await geminiService.generateText(options);

            expect(result).toBe("The video shows a cat.");
            expect(genai.createPartFromUri).toHaveBeenCalledWith(
                "gs://bucket/video.mp4",
                "video/mp4",
            );
            expect(mockAi.models.generateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    contents: [
                        { text: "What is in this video?" },
                        {
                            fileData: {
                                fileUri: "gs://bucket/video.mp4",
                                mimeType: "video/mp4",
                            },
                        },
                    ],
                }),
            );
        });

        it("should correctly handle data: URL files", async () => {
            const mockResponse = {
                candidates: [
                    {
                        content: {
                            parts: [{ text: "I see an image." }],
                        },
                    },
                ],
            };
            mockAi.models.generateContent.mockResolvedValue(mockResponse);

            const options = {
                prompt: "What is in this image?",
                files: [
                    {
                        url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
                        type: "image/png",
                    },
                ],
            };

            const result = await geminiService.generateText(options);

            expect(result).toBe("I see an image.");
            expect(genai.createPartFromBase64).toHaveBeenCalledWith(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
                "image/png",
            );
        });

        it("should throw an error for unsupported file types", async () => {
            const options = {
                prompt: "Process this zip",
                files: [
                    { url: "gs://bucket/file.zip", type: "application/zip" },
                ],
            };

            await expect(geminiService.generateText(options)).rejects.toThrow(
                "Unsupported file type: application/zip",
            );
        });
    });
});
