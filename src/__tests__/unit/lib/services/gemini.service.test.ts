/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { GeminiService } from "@/lib/services/gemini.service";
import * as genai from "@google/genai";
import { MODELS } from "@/lib/constants";
import { storageService } from "@/lib/services/storage.service";

vi.mock("@/lib/services/storage.service", () => ({
    storageService: {
        uploadFile: vi
            .fn()
            .mockResolvedValue("gs://mock-bucket/mock-video.mp4"),
    },
}));

vi.mock("google-auth-library", () => {
    return {
        GoogleAuth: vi.fn().mockImplementation(function () {
            return {
                getClient: vi.fn().mockResolvedValue({
                    getAccessToken: vi
                        .fn()
                        .mockResolvedValue({ token: "mock-token" }),
                }),
            };
        }),
    };
});

interface MockGoogleGenAIInstance {
    models: {
        generateContent: Mock;
        generateVideos: Mock;
        upscaleImage: Mock;
    };
    operations: {
        get: Mock;
    };
    interactions: {
        create: Mock;
    };
    files: {
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
        this.interactions = {
            create: vi.fn(),
        };
        this.files = {
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
        MediaResolution: {
            MEDIA_RESOLUTION_HIGH: "MEDIA_RESOLUTION_HIGH",
            MEDIA_RESOLUTION_LOW: "MEDIA_RESOLUTION_LOW",
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
        interactions: {
            create: Mock;
        };
        files: {
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

        it("should prioritize firstFrame/lastFrame over reference images", async () => {
            mockAi.models.generateVideos.mockResolvedValue({
                done: false,
                name: "ops/456",
            });
            mockAi.operations.get.mockResolvedValue({
                done: true,
                response: {
                    generatedVideos: [
                        { video: { uri: "gs://video-frames.mp4" } },
                    ],
                },
            });

            const delaySpy = vi
                .spyOn(global, "setTimeout")
                .mockImplementation((cb) => {
                    cb();
                    return 0 as any;
                });

            await geminiService.generateVideo({
                prompt: "Animate this scene",
                firstFrame: "gs://first.png",
                lastFrame: "gs://last.png",
                images: [{ url: "gs://ref.png", type: "image/png" }],
            });

            expect(mockAi.models.generateVideos).toHaveBeenCalledWith(
                expect.objectContaining({
                    source: expect.objectContaining({
                        image: {
                            gcsUri: "gs://first.png",
                            mimeType: "image/png",
                        },
                    }),
                    config: expect.objectContaining({
                        lastFrame: {
                            gcsUri: "gs://last.png",
                            mimeType: "image/png",
                        },
                    }),
                }),
            );

            const calledWith = mockAi.models.generateVideos.mock.calls[0][0];
            expect(calledWith.config.referenceImages).toBeUndefined();
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

    describe("generateVideo with gemini-omni-flash-preview", () => {
        beforeEach(() => {
            // Mock global fetch
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                arrayBuffer: async () => new ArrayBuffer(8),
            });
            vi.clearAllMocks();
            // Re-fetch mockAi since beforeEach in outer block runs, but let's ensure it is clean
            mockAi = (geminiService as unknown as { ai: typeof mockAi }).ai;
        });

        it("should call interactions.create and handle inline base64 output", async () => {
            mockAi.interactions.create.mockResolvedValue({
                id: "interaction-123",
                status: "COMPLETED",
                output_video: {
                    type: "video",
                    data: "base64_video_data",
                    mime_type: "video/mp4",
                },
            });

            const result = await geminiService.generateVideo({
                prompt: "A dog running",
                model: "gemini-omni-flash-preview",
            });

            expect(result).toEqual({
                videoUrl: "gs://mock-bucket/mock-video.mp4",
                interactionId: "interaction-123",
            });
            expect(mockAi.interactions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: "gemini-omni-flash-preview",
                    input: expect.arrayContaining([
                        expect.objectContaining({ text: "A dog running" }),
                    ]),
                    response_format: expect.objectContaining({
                        type: "video",
                        aspect_ratio: "16:9",
                        delivery: "uri",
                    }),
                }),
            );
        });

        it("should call interactions.create, poll file, download, and upload to GCS for URI delivery", async () => {
            mockAi.interactions.create.mockResolvedValue({
                id: "interaction-123",
                status: "COMPLETED",
                output_video: {
                    type: "video",
                    uri: "https://generativetoolkit.googleapis.com/v1beta/files/file-123",
                    mime_type: "video/mp4",
                },
            });

            mockAi.files.get
                .mockResolvedValueOnce({ state: "PROCESSING" })
                .mockResolvedValueOnce({
                    state: "ACTIVE",
                    uri: "https://generativetoolkit.googleapis.com/v1beta/files/file-123",
                });

            const delaySpy = vi
                .spyOn(global, "setTimeout")
                .mockImplementation((cb) => {
                    cb();
                    return 0 as any;
                });

            const result = await geminiService.generateVideo({
                prompt: "A dog running",
                model: "gemini-omni-flash-preview",
            });

            expect(result).toEqual({
                videoUrl: "gs://mock-bucket/mock-video.mp4",
                interactionId: "interaction-123",
            });
            expect(mockAi.files.get).toHaveBeenCalledTimes(2);
            expect(mockAi.files.get).toHaveBeenLastCalledWith({
                name: "file-123",
            });
            expect(global.fetch).toHaveBeenCalledWith(
                "https://generativetoolkit.googleapis.com/v1beta/files/file-123",
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "Bearer mock-token",
                    }),
                }),
            );
            delaySpy.mockRestore();
        });

        it("should propagate previousInteractionId for editing", async () => {
            mockAi.interactions.create.mockResolvedValue({
                id: "interaction-456",
                status: "COMPLETED",
                output_video: {
                    type: "video",
                    data: "base64_video_data",
                },
            });

            await geminiService.generateVideo({
                prompt: "Make it faster",
                model: "gemini-omni-flash-preview",
                previousInteractionId: "interaction-123",
            });

            expect(mockAi.interactions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: "gemini-omni-flash-preview",
                    previous_interaction_id: "interaction-123",
                }),
            );
        });

        it("should call interactions.create and return GCS URI immediately if response contains gs:// URI", async () => {
            mockAi.interactions.create.mockResolvedValue({
                id: "interaction-123",
                status: "COMPLETED",
                output_video: {
                    type: "video",
                    uri: "gs://my-bucket/omni-123.mp4",
                    mime_type: "video/mp4",
                },
            });

            const result = await geminiService.generateVideo({
                prompt: "A dog running",
                model: "gemini-omni-flash-preview",
            });

            expect(result).toEqual({
                videoUrl: "gs://my-bucket/omni-123.mp4",
                interactionId: "interaction-123",
            });
            expect(mockAi.files.get).not.toHaveBeenCalled();
            expect(global.fetch).not.toHaveBeenCalled();
        });
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
