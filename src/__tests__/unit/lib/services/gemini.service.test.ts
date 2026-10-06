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

    describe("generateVideo with Veo", () => {
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
                model: MODELS.VIDEO.VEO_3_1_FAST,
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
                model: MODELS.VIDEO.VEO_3_1_FAST,
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
                geminiService.generateVideo({
                    prompt: "A dog",
                    model: MODELS.VIDEO.VEO_3_1_FAST,
                }),
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
                        delivery: "uri",
                    }),
                }),
            );
            const call = mockAi.interactions.create.mock.calls[0][0] as any;
            expect(call.response_format.aspect_ratio).toBeUndefined();
        });

        it("should include aspect_ratio in response_format when explicitly specified for Omni", async () => {
            mockAi.interactions.create.mockResolvedValue({
                id: "interaction-123",
                status: "COMPLETED",
                output_video: {
                    type: "video",
                    data: "base64_video_data",
                },
            });

            await geminiService.generateVideo({
                prompt: "A dog running",
                model: "gemini-omni-flash-preview",
                aspectRatio: "16:9",
            });

            expect(mockAi.interactions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: "gemini-omni-flash-preview",
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

        it("should propagate previousInteractionId for editing without setting video task", async () => {
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
            const call = mockAi.interactions.create.mock.calls[0][0] as any;
            expect(call.generation_config).toBeUndefined();
            expect(call.response_format.aspect_ratio).toBeUndefined();
        });

        it("should set video task to edit when video is present and previousInteractionId is missing", async () => {
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
                video: "gs://bucket/input.mp4",
            });

            expect(mockAi.interactions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: "gemini-omni-flash-preview",
                    input: expect.arrayContaining([
                        expect.objectContaining({
                            type: "video",
                            uri: "gs://bucket/input.mp4",
                        }),
                    ]),
                    generation_config: {
                        video_config: {
                            task: "edit",
                        },
                    },
                }),
            );
            const call = mockAi.interactions.create.mock.calls[0][0] as any;
            expect(call.response_format.aspect_ratio).toBeUndefined();
        });

        it("should omit aspect_ratio in response_format and warn if specified for edit tasks", async () => {
            mockAi.interactions.create.mockResolvedValue({
                id: "interaction-456",
                status: "COMPLETED",
                output_video: {
                    type: "video",
                    data: "base64_video_data",
                },
            });

            await geminiService.generateVideo({
                prompt: "Reframe to portrait",
                model: "gemini-omni-flash-preview",
                video: "gs://bucket/input.mp4",
                aspectRatio: "9:16",
            });

            const call = mockAi.interactions.create.mock.calls[0][0] as any;
            expect(call.response_format.aspect_ratio).toBeUndefined();
        });

        it("should set custom task when task parameter is explicitly provided", async () => {
            mockAi.interactions.create.mockResolvedValue({
                id: "interaction-456",
                status: "COMPLETED",
                output_video: {
                    type: "video",
                    data: "base64_video_data",
                },
            });

            await geminiService.generateVideo({
                prompt: "A beautiful scenery",
                model: "gemini-omni-flash-preview",
                task: "text_to_video",
            });

            expect(mockAi.interactions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: "gemini-omni-flash-preview",
                    generation_config: {
                        video_config: {
                            task: "text_to_video",
                        },
                    },
                }),
            );
        });

        it("should ignore previousInteractionId and use video-input path when both are present", async () => {
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
                video: "gs://bucket/input.mp4",
            });

            expect(mockAi.interactions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: "gemini-omni-flash-preview",
                    input: expect.arrayContaining([
                        expect.objectContaining({
                            type: "video",
                            uri: "gs://bucket/input.mp4",
                        }),
                    ]),
                    generation_config: {
                        video_config: {
                            task: "edit",
                        },
                    },
                }),
            );
            const call = mockAi.interactions.create.mock.calls[0][0] as any;
            expect(call.previous_interaction_id).toBeUndefined();
            expect(call.response_format.aspect_ratio).toBeUndefined();
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

        it("should dynamically infer mime_type from GCS URIs for firstFrame and video, and ignore audio", async () => {
            mockAi.interactions.create.mockResolvedValue({
                id: "interaction-123",
                status: "COMPLETED",
                output_video: {
                    type: "video",
                    data: "base64_video_data",
                },
            });

            await geminiService.generateVideo({
                prompt: "A cool visual synchronized to audio",
                model: "gemini-omni-flash-preview",
                firstFrame: "gs://bucket/frame.jpg",
                audio: "gs://bucket/track.mp3",
                video: "gs://bucket/clip.webm",
            });

            expect(mockAi.interactions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: "gemini-omni-flash-preview",
                    input: expect.arrayContaining([
                        expect.objectContaining({
                            type: "image",
                            uri: "gs://bucket/frame.jpg",
                            mime_type: "image/jpeg",
                        }),
                        expect.objectContaining({
                            type: "video",
                            uri: "gs://bucket/clip.webm",
                            mime_type: "video/webm",
                        }),
                    ]),
                }),
            );

            // Assert that the input array does not contain any audio parts
            const call = mockAi.interactions.create.mock.calls[0][0] as any;
            const audioPart = call.input.find(
                (part: any) => part.type === "audio",
            );
            expect(audioPart).toBeUndefined();
        });
    });

    describe("generateVideo with gemini-omni-1.1-flash-preview", () => {
        beforeEach(() => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                arrayBuffer: async () => new ArrayBuffer(8),
            });
            vi.clearAllMocks();
            mockAi = (geminiService as unknown as { ai: typeof mockAi }).ai;
        });

        it("should default to gemini-omni-1.1-flash-preview when no model is specified", async () => {
            mockAi.interactions.create.mockResolvedValue({
                id: "interaction-omni-11-default",
                status: "COMPLETED",
                output_video: {
                    type: "video",
                    uri: "gs://bucket/default-output.mp4",
                },
            });

            const result = await geminiService.generateVideo({
                prompt: "A running cheetah",
            });

            expect(result).toEqual({
                videoUrl: "gs://bucket/default-output.mp4",
                interactionId: "interaction-omni-11-default",
            });
            expect(mockAi.interactions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: "gemini-omni-1.1-flash-preview",
                    response_format: expect.objectContaining({
                        type: "video",
                        delivery: "uri",
                        resolution: "720p",
                    }),
                }),
            );
        });

        it("should include custom resolution, duration, delivery: uri, and gcs_uri", async () => {
            mockAi.interactions.create.mockResolvedValue({
                id: "interaction-omni-11-params",
                status: "COMPLETED",
                output_video: {
                    type: "video",
                    uri: "gs://mock-bucket/custom.mp4",
                },
            });

            await geminiService.generateVideo({
                prompt: "Cyberpunk city night drive",
                model: "gemini-omni-1.1-flash-preview",
                resolution: "1080p",
                duration: 6,
                aspectRatio: "9:16",
            });

            expect(mockAi.interactions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: "gemini-omni-1.1-flash-preview",
                    response_format: expect.objectContaining({
                        type: "video",
                        delivery: "uri",
                        gcs_uri: expect.stringMatching(
                            /^gs:\/\/mock-bucket\/omni-.*\.mp4$/,
                        ),
                        aspect_ratio: "9:16",
                        resolution: "1080p",
                        duration: "6s",
                    }),
                }),
            );
        });

        it("should clamp duration to 3s-10s range", async () => {
            mockAi.interactions.create.mockResolvedValue({
                id: "interaction-omni-11-clamped",
                status: "COMPLETED",
                output_video: {
                    type: "video",
                    uri: "gs://mock-bucket/clamped.mp4",
                },
            });

            // Test under minimum (2s -> 3s)
            await geminiService.generateVideo({
                prompt: "Short clip",
                model: "gemini-omni-1.1-flash-preview",
                duration: 2,
            });
            let call = mockAi.interactions.create.mock.calls[0][0] as any;
            expect(call.response_format.duration).toBe("3s");

            // Test over maximum (12s -> 10s)
            await geminiService.generateVideo({
                prompt: "Long clip",
                model: "gemini-omni-1.1-flash-preview",
                duration: 12,
            });
            call = mockAi.interactions.create.mock.calls[1][0] as any;
            expect(call.response_format.duration).toBe("10s");
        });

        it("should support firstFrame and lastFrame with image_to_video task", async () => {
            mockAi.interactions.create.mockResolvedValue({
                id: "interaction-omni-11-frames",
                status: "COMPLETED",
                output_video: {
                    type: "video",
                    uri: "gs://mock-bucket/interpolated.mp4",
                },
            });

            await geminiService.generateVideo({
                prompt: "Transition between two scenes",
                model: "gemini-omni-1.1-flash-preview",
                firstFrame: "gs://bucket/first.png",
                lastFrame: "gs://bucket/last.png",
            });

            expect(mockAi.interactions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: "gemini-omni-1.1-flash-preview",
                    input: expect.arrayContaining([
                        expect.objectContaining({
                            type: "image",
                            uri: "gs://bucket/first.png",
                            mime_type: "image/png",
                        }),
                        expect.objectContaining({
                            type: "image",
                            uri: "gs://bucket/last.png",
                            mime_type: "image/png",
                        }),
                        expect.objectContaining({
                            type: "text",
                            text: "Transition between two scenes",
                        }),
                    ]),
                    generation_config: {
                        video_config: {
                            task: "image_to_video",
                        },
                    },
                }),
            );
        });

        it("should support 360p resolution (lowercased in response_format)", async () => {
            mockAi.interactions.create.mockResolvedValue({
                id: "interaction-omni-11-360p",
                status: "COMPLETED",
                output_video: {
                    type: "video",
                    uri: "gs://mock-bucket/360p.mp4",
                },
            });

            await geminiService.generateVideo({
                prompt: "Fast draft",
                model: "gemini-omni-1.1-flash-preview",
                resolution: "360p",
            });

            expect(mockAi.interactions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: "gemini-omni-1.1-flash-preview",
                    response_format: expect.objectContaining({
                        resolution: "360p",
                    }),
                }),
            );
        });

        it("should reject untrusted download URIs returned by Omni", async () => {
            mockAi.interactions.create.mockResolvedValue({
                id: "interaction-omni-untrusted",
                status: "COMPLETED",
                output_video: {
                    type: "video",
                    uri: "https://evil.example.com/files/vid123",
                },
            });
            mockAi.files.get.mockResolvedValue({ state: "ACTIVE" });

            await expect(
                geminiService.generateVideo({
                    prompt: "Test untrusted URI",
                    model: "gemini-omni-1.1-flash-preview",
                }),
            ).rejects.toThrow("Untrusted download URI returned by Omni");
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
                image: "gs://mock-bucket/input.png",
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
                    image: "gs://mock-bucket/input.png",
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
