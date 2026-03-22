/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { GeminiService } from "../lib/services/gemini.service";
import * as genai from "@google/genai";
import { MODELS } from "../lib/constants";

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
        ThinkingLevel: { LOW: "LOW" },
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

    describe("generateText", () => {
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
                prompts: ["Summarize this PDF"],
                files: [
                    { url: "gs://bucket/file.pdf", type: "application/pdf" },
                ],
            };
            const result = await geminiService.generateText(options);
            expect(result).toBe("This is a summary of the PDF.");
        });

        it("should handle parts array", async () => {
            const mockResponse = {
                candidates: [{ content: { parts: [{ text: "Result text" }] } }],
            };
            mockAi.models.generateContent.mockResolvedValue(mockResponse);

            const result = await geminiService.generateText({
                parts: [{ kind: "text", text: "Prompt with parts" }],
            });
            expect(result).toBe("Result text");
            expect(mockAi.models.generateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    contents: [{ text: "Prompt with parts" }],
                }),
            );
        });

        it("should handle JSON outputType with responseSchema", async () => {
            const mockResponse = {
                candidates: [
                    { content: { parts: [{ text: '{"key":"val"}' }] } },
                ],
            };
            mockAi.models.generateContent.mockResolvedValue(mockResponse);

            const result = await geminiService.generateText({
                prompts: ["Data"],
                outputType: "json",
                responseSchema: '{"type":"object"}',
                strictMode: true,
            });
            expect(result).toBe('{"key":"val"}');
            expect(mockAi.models.generateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    config: expect.objectContaining({
                        responseMimeType: "application/json",
                        responseSchema: { type: "object" },
                    }),
                }),
            );
        });

        it("should throw error if no candidates", async () => {
            mockAi.models.generateContent.mockResolvedValue({ candidates: [] });
            await expect(
                geminiService.generateText({ prompts: ["test"] }),
            ).rejects.toThrow("No candidates in response");
        });

        it("should throw error if no content parts", async () => {
            mockAi.models.generateContent.mockResolvedValue({
                candidates: [{}],
            });
            await expect(
                geminiService.generateText({ prompts: ["test"] }),
            ).rejects.toThrow("No content parts in response");
        });
    });

    describe("generateImage", () => {
        it("should generate image successfully", async () => {
            mockAi.models.generateContent.mockResolvedValue({
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    inlineData: {
                                        data: "base64data",
                                        mimeType: "image/png",
                                    },
                                },
                            ],
                        },
                    },
                ],
            });

            const result = await geminiService.generateImage({
                prompt: "A cool dog",
                aspectRatio: "16:9",
            });
            expect(result.data).toBe("base64data");
            expect(result.mimeType).toBe("image/png");
        });

        it("should throw if no candidates", async () => {
            mockAi.models.generateContent.mockResolvedValue({ candidates: [] });
            await expect(
                geminiService.generateImage({ prompt: "dog" }),
            ).rejects.toThrow();
        });

        it("should throw if no inline image data", async () => {
            mockAi.models.generateContent.mockResolvedValue({
                candidates: [
                    { content: { parts: [{ text: "Not an image" }] } },
                ],
            });
            await expect(
                geminiService.generateImage({ prompt: "dog" }),
            ).rejects.toThrow();
        });

        it("should use grounding Google Search when enabled", async () => {
            mockAi.models.generateContent.mockResolvedValue({
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    inlineData: {
                                        data: "base64",
                                        mimeType: "image/png",
                                    },
                                },
                            ],
                        },
                    },
                ],
            });
            await geminiService.generateImage({
                prompt: "dog",
                groundingGoogleSearch: true,
            });
            expect(mockAi.models.generateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    config: expect.objectContaining({
                        tools: [
                            {
                                googleSearch: {
                                    searchTypes: { webSearch: {} },
                                },
                            },
                        ],
                    }),
                }),
            );
        });

        it("should handle multi-modal inputs with base64 and GCS", async () => {
            mockAi.models.generateContent.mockResolvedValue({
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    inlineData: {
                                        data: "res",
                                        mimeType: "image/png",
                                    },
                                },
                            ],
                        },
                    },
                ],
            });
            await geminiService.generateImage({
                prompt: "dog",
                images: [
                    { url: "data:image/jpeg;base64,123", type: "image/jpeg" },
                    { url: "gs://bucket/file.png", type: "image/png" },
                ],
            });
            expect(genai.createPartFromBase64).toHaveBeenCalledWith(
                "123",
                "image/jpeg",
            );
            expect(genai.createPartFromUri).toHaveBeenCalledWith(
                "gs://bucket/file.png",
                "image/png",
            );
        });
    });

    describe("generateVideo", () => {
        it("should poll operation and return video URI", async () => {
            mockAi.models.generateVideos.mockResolvedValue({
                done: false,
                name: "ops/123",
            });
            mockAi.operations.get.mockResolvedValue({
                done: true,
                response: {
                    generatedVideos: [{ video: { uri: "gs://video.mp4" } }],
                },
            });

            // Mock delay to not actually wait in test
            const delaySpy = vi
                .spyOn(global, "setTimeout")
                .mockImplementation((cb) => {
                    cb();
                    return 0 as any;
                });

            const result = await geminiService.generateVideo({
                prompt: "A dog running",
            });

            expect(result).toBe("gs://video.mp4");
            expect(mockAi.operations.get).toHaveBeenCalled();
            delaySpy.mockRestore();
        });

        it("should throw if times out", async () => {
            mockAi.models.generateVideos.mockResolvedValue({ done: false });
            mockAi.operations.get.mockResolvedValue({ done: false });

            const delaySpy = vi
                .spyOn(global, "setTimeout")
                .mockImplementation((cb) => {
                    cb();
                    return 0 as any;
                });

            await expect(
                geminiService.generateVideo({ prompt: "A dog" }),
            ).rejects.toThrow("Video generation timed out");
            delaySpy.mockRestore();
        }, 10000); // give it a slightly higher timeout
    });

    describe("upscaleImage", () => {
        it("should upscale base64 image", async () => {
            mockAi.models.upscaleImage.mockResolvedValue({
                generatedImages: [{ image: { gcsUri: "gs://upscaled.png" } }],
            });
            const result = await geminiService.upscaleImage({
                image: "data:image/jpeg;base64,1234",
                upscaleFactor: "x2",
            });
            expect(result).toBe("gs://upscaled.png");
        });

        it("should upscale GCS image", async () => {
            mockAi.models.upscaleImage.mockResolvedValue({
                generatedImages: [{ image: { gcsUri: "gs://upscaled.png" } }],
            });
            const result = await geminiService.upscaleImage({
                image: "gs://input.png",
                upscaleFactor: "x4",
            });
            expect(result).toBe("gs://upscaled.png");
        });

        it("should error if no generated images", async () => {
            mockAi.models.upscaleImage.mockResolvedValue({
                generatedImages: [],
            });
            await expect(
                geminiService.upscaleImage({
                    image: "gs://input.png",
                    upscaleFactor: "x2",
                }),
            ).rejects.toThrow();
        });

        it("should error on invalid image format", async () => {
            await expect(
                geminiService.upscaleImage({
                    image: "http://invalid.png",
                    upscaleFactor: "x2",
                }),
            ).rejects.toThrow("Invalid image format");
        });
    });
});
