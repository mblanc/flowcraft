import {
    GoogleGenAI,
    createPartFromBase64,
    createPartFromText,
    createPartFromUri,
    Content,
    ContentListUnion,
    ContentUnion,
    GenerateVideosParameters,
    VideoGenerationReferenceType,
    Image as GeminiImage,
    GenerateContentConfig,
    GenerateContentResponse,
    Tool,
    ThinkingLevel,
    MediaResolution,
} from "@google/genai";
import logger from "@/app/logger";
import { config } from "../config";
import {
    MODELS,
    DEFAULTS,
    ALL_SUPPORTED_MIME_TYPES,
    SupportedMimeType,
    MODEL_THINKING_LEVELS,
} from "../constants";
import type { ContentPart, MediaRef } from "../types";
import { storageService } from "./storage.service";
import { GoogleAuth } from "google-auth-library";
import { v4 as uuidv4 } from "uuid";

const DATA_URI_REGEX = /^data:([^;]+);base64,(.+)$/;

function isSupportedMimeType(mimeType: string): mimeType is SupportedMimeType {
    return (ALL_SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
}

async function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Converts a serializable ContentPart to the Gemini SDK native Part type. */
function contentPartToSdkPart(
    part: ContentPart,
): ReturnType<
    | typeof createPartFromText
    | typeof createPartFromUri
    | typeof createPartFromBase64
> {
    if (part.kind === "text") return createPartFromText(part.text);
    if (part.kind === "uri") return createPartFromUri(part.uri, part.mimeType);
    if (part.kind === "base64")
        return createPartFromBase64(part.data, part.mimeType);
    throw new Error(`Unknown ContentPart kind`);
}

export interface GenerateTextOptions {
    prompts?: string[];
    parts?: ContentPart[];
    files?: MediaRef[];
    model?: string;
    outputType?: "text" | "json";
    responseSchema?: string;
    strictMode?: boolean;
    thinkingLevel?: string;
    systemInstruction?: string;
}

export interface GenerateImageOptions {
    prompt?: string;
    parts?: ContentPart[];
    images?: MediaRef[];
    aspectRatio?: string;
    model?: string;
    imageSize?: string;
    groundingGoogleSearch?: boolean;
    groundingImageSearch?: boolean;
    systemInstruction?: string;
    thinkingLevel?: string;
}

export interface GenerateVideoOptions {
    prompt: string;
    firstFrame?: string;
    lastFrame?: string;
    images?: MediaRef[];
    audio?: string;
    previousInteractionId?: string;
    aspectRatio?: string;
    duration?: number;
    model?: string;
    generateAudio?: boolean;
    resolution?: string;
    styleInstruction?: string;
}

export interface UpscaleImageOptions {
    image: string;
    upscaleFactor: "x2" | "x3" | "x4";
}

export class GeminiService {
    private _ai: GoogleGenAI | null = null;

    private get ai(): GoogleGenAI {
        if (!this._ai) {
            this._ai = new GoogleGenAI({
                vertexai: true,
                project: config.PROJECT_ID as string,
                location: config.LOCATION as string,
            });
        }
        return this._ai;
    }

    async generateText(options: GenerateTextOptions): Promise<string> {
        const {
            prompts,
            parts,
            files,
            model,
            outputType,
            responseSchema,
            strictMode,
            thinkingLevel,
            systemInstruction,
        } = options;
        const selectedModel = model || MODELS.TEXT.GEMINI_3_5_FLASH;

        logger.info(
            `[GeminiService] Generating text with model: ${selectedModel}`,
        );

        let contents: ContentListUnion;

        if (parts && parts.length > 0) {
            // Structured ContentPart[] path (from composable prompt executor)
            contents = parts.map(contentPartToSdkPart);
        } else {
            // Legacy flat-prompts path
            contents = (prompts ?? []).map((p) => createPartFromText(p));

            if (files && files.length > 0) {
                for (const file of files) {
                    if (!isSupportedMimeType(file.type)) {
                        logger.error(
                            `[GeminiService] Unsupported file type: ${file.type} for file: ${file.url}`,
                        );
                        throw new Error(`Unsupported file type: ${file.type}`);
                    }

                    if (file.url.startsWith("gs://")) {
                        contents.push(createPartFromUri(file.url, file.type));
                    } else if (file.url.startsWith("data:")) {
                        const base64Match = file.url.match(DATA_URI_REGEX);
                        if (base64Match) {
                            contents.push(
                                createPartFromBase64(
                                    base64Match[2],
                                    base64Match[1],
                                ),
                            );
                        }
                    }
                }
            }
        }

        const generationConfig: GenerateContentConfig = {};
        generationConfig.mediaResolution =
            MediaResolution.MEDIA_RESOLUTION_HIGH;
        if (outputType === "json") {
            generationConfig.responseMimeType = "application/json";
            if (responseSchema) {
                try {
                    if (responseSchema.length > 8192) {
                        throw new Error(
                            "responseSchema exceeds maximum length",
                        );
                    }
                    const parsed = JSON.parse(responseSchema);
                    if (
                        typeof parsed !== "object" ||
                        Array.isArray(parsed) ||
                        parsed === null
                    ) {
                        throw new Error("responseSchema must be a JSON object");
                    }
                    generationConfig.responseSchema = parsed as Record<
                        string,
                        unknown
                    >;
                    if (strictMode) {
                        logger.info(
                            "[GeminiService] Strict mode enabled for JSON output",
                        );
                    }
                } catch (e) {
                    logger.warn(
                        `[GeminiService] Failed to parse responseSchema: ${e}`,
                    );
                }
            }
        }

        if (thinkingLevel) {
            const levelKey =
                thinkingLevel.toUpperCase() as keyof typeof ThinkingLevel;
            generationConfig.thinkingConfig = {
                thinkingLevel: ThinkingLevel[levelKey] ?? thinkingLevel,
            };
        }

        if (systemInstruction) {
            generationConfig.systemInstruction = systemInstruction;
        }

        logger.info(
            `[GeminiService] Contents: ${JSON.stringify(contents, null, 2)}`,
        );

        const response = await this.ai.models.generateContent({
            model: selectedModel,
            contents,
            config: generationConfig,
        });

        if (!response.candidates || response.candidates.length === 0) {
            throw new Error("No candidates in response");
        }

        const candidate = response.candidates[0];
        if (!candidate.content?.parts || candidate.content.parts.length === 0) {
            throw new Error("No content parts in response");
        }

        return candidate.content.parts
            .filter((part) => part.text)
            .map((part) => part.text)
            .join("");
    }

    async *generateTextStream(options: {
        contents: Content[];
        systemInstruction?: ContentUnion;
        model?: string;
        config?: GenerateContentConfig;
    }): AsyncGenerator<string> {
        const selectedModel = options.model || MODELS.TEXT.GEMINI_3_5_FLASH;

        logger.info(
            `[GeminiService] Streaming text with model: ${selectedModel}`,
        );
        logger.debug(
            `[GeminiService] System Instruction: ${JSON.stringify(options.systemInstruction, null, 2)}`,
        );
        logger.debug(
            `[GeminiService] Contents: ${JSON.stringify(options.contents, null, 2)}`,
        );

        const stream = await this.ai.models.generateContentStream({
            model: selectedModel,
            contents: options.contents,
            config: {
                ...options.config,
                systemInstruction: options.systemInstruction,
                httpOptions: {
                    retryOptions: {
                        attempts: 3,
                    },
                },
            },
        });

        for await (const chunk of stream) {
            const text = chunk.candidates?.[0]?.content?.parts
                ?.filter((p) => p.text)
                .map((p) => p.text)
                .join("");
            if (text) {
                yield text;
            }
        }
    }

    async generateStructured(options: {
        contents: Content[];
        systemInstruction?: ContentUnion;
        model?: string;
        responseSchema: Record<string, unknown>;
        config?: GenerateContentConfig;
    }): Promise<GenerateContentResponse> {
        const selectedModel = options.model || MODELS.TEXT.GEMINI_3_5_FLASH;

        logger.info(
            `[GeminiService] Generating structured output with model: ${selectedModel}`,
        );
        logger.debug(
            `[GeminiService] System Instruction: ${JSON.stringify(options.systemInstruction, null, 2)}`,
        );
        logger.debug(
            `[GeminiService] Contents: ${JSON.stringify(options.contents, null, 2)}`,
        );

        return this.ai.models.generateContent({
            model: selectedModel,
            contents: options.contents,
            config: {
                ...options.config,
                systemInstruction: options.systemInstruction,
                responseMimeType: "application/json",
                responseSchema: options.responseSchema,
            },
        });
    }

    async generateImage(
        options: GenerateImageOptions,
    ): Promise<{ data: string; mimeType: string }> {
        const {
            prompt,
            parts,
            images = [],
            aspectRatio,
            model,
            imageSize,
            groundingGoogleSearch,
            groundingImageSearch,
            systemInstruction,
            thinkingLevel,
        } = options;
        const selectedModel = model || MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE;

        logger.info(
            `[GeminiService] Generating image with model: ${selectedModel}`,
        );

        let contents: ContentListUnion;

        if (parts && parts.length > 0) {
            // Structured ContentPart[] path (from composable prompt executor)
            contents = parts.map(contentPartToSdkPart);
        } else {
            // Legacy path: reference images first, then the prompt text
            contents = [];
            for (const image of images) {
                if (image.url.startsWith("data:")) {
                    const base64Data = image.url.split(",")[1];
                    const mimeType = image.url.split(";")[0].split(":")[1];
                    contents.push(createPartFromBase64(base64Data, mimeType));
                } else if (image.url.startsWith("gs://")) {
                    contents.push(createPartFromUri(image.url, image.type));
                }
            }
            contents.push(createPartFromText(prompt ?? ""));
        }

        logger.info(
            `[GeminiService] Contents: ${JSON.stringify(contents, null, 2)}`,
        );
        const imageConfigObj: Record<string, unknown> = {
            imageSize: imageSize as string,
        };
        if (aspectRatio && aspectRatio !== "Auto") {
            imageConfigObj.aspectRatio = aspectRatio as string;
        }

        const generateContentConfig: GenerateContentConfig = {
            responseModalities: ["IMAGE"],
            imageConfig: imageConfigObj as GenerateContentConfig["imageConfig"],
            ...(systemInstruction ? { systemInstruction } : {}),
        };

        const supportedLevels = MODEL_THINKING_LEVELS[selectedModel];
        if (supportedLevels) {
            if (thinkingLevel) {
                const levelKey =
                    thinkingLevel.toUpperCase() as keyof typeof ThinkingLevel;
                generateContentConfig.thinkingConfig = {
                    thinkingLevel: ThinkingLevel[levelKey] ?? thinkingLevel,
                };
            } else {
                generateContentConfig.thinkingConfig = {
                    thinkingLevel: ThinkingLevel.LOW,
                };
            }
        }

        if (groundingGoogleSearch || groundingImageSearch) {
            const searchTypes: Record<string, Record<string, unknown>> = {};
            if (groundingGoogleSearch) searchTypes.webSearch = {};
            if (groundingImageSearch) searchTypes.imageSearch = {};

            generateContentConfig.tools = [
                {
                    googleSearch: {
                        searchTypes,
                    },
                } as Tool,
            ];
        }

        logger.info(
            `[GeminiService] Config: ${JSON.stringify(generateContentConfig, null, 2)}`,
        );

        const response = await this.ai.models.generateContent({
            model: selectedModel,
            contents,
            config: generateContentConfig,
        });

        if (!response.candidates || response.candidates.length === 0) {
            logger.error(
                `[GeminiService] No candidates in response: ${JSON.stringify(
                    response,
                    null,
                    2,
                )}`,
            );
            throw new Error("No candidates in response");
        }

        const candidate = response.candidates[0];
        const imagePart = candidate.content?.parts?.find(
            (part) => part.inlineData,
        );

        if (!imagePart?.inlineData) {
            logger.error(
                `[GeminiService] No image data in response: ${JSON.stringify(
                    response,
                    null,
                    2,
                )}`,
            );
            throw new Error("No image data in response");
        }

        return {
            data: imagePart.inlineData.data!,
            mimeType: imagePart.inlineData.mimeType!,
        };
    }

    async generateVideo(
        options: GenerateVideoOptions,
    ): Promise<string | { videoUrl: string; interactionId?: string }> {
        const {
            prompt,
            firstFrame,
            lastFrame,
            images,
            audio,
            previousInteractionId,
            aspectRatio,
            duration,
            model,
            generateAudio,
            resolution,
            styleInstruction,
        } = options;

        const selectedModel = model || MODELS.VIDEO.VEO_3_1_LITE;

        const effectivePrompt = styleInstruction
            ? `${styleInstruction}\n\n${prompt}`
            : prompt;

        if (selectedModel === MODELS.VIDEO.GEMINI_OMNI_FLASH) {
            logger.info(
                `[GeminiService] Generating video with Omni: ${effectivePrompt}`,
            );

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const inputParts: any[] = [];

            if (images && images.length > 0) {
                for (const img of images) {
                    if (img.url.startsWith("data:")) {
                        const base64Match = img.url.match(DATA_URI_REGEX);
                        if (base64Match) {
                            inputParts.push({
                                type: "image",
                                data: base64Match[2],
                                mime_type: base64Match[1],
                            });
                        }
                    } else if (img.url.startsWith("gs://")) {
                        inputParts.push({
                            type: "image",
                            uri: img.url,
                            mime_type: img.type || "image/png",
                        });
                    }
                }
            }

            if (firstFrame) {
                if (firstFrame.startsWith("gs://")) {
                    inputParts.push({
                        type: "image",
                        uri: firstFrame,
                        mime_type: "image/png",
                    });
                } else if (firstFrame.startsWith("data:")) {
                    const base64Match = firstFrame.match(DATA_URI_REGEX);
                    if (base64Match) {
                        inputParts.push({
                            type: "image",
                            data: base64Match[2],
                            mime_type: base64Match[1],
                        });
                    }
                }
            }

            if (audio) {
                if (audio.startsWith("gs://")) {
                    inputParts.push({
                        type: "audio",
                        uri: audio,
                        mime_type: "audio/mp3",
                    });
                } else if (audio.startsWith("data:")) {
                    const base64Match = audio.match(DATA_URI_REGEX);
                    if (base64Match) {
                        inputParts.push({
                            type: "audio",
                            data: base64Match[2],
                            mime_type: base64Match[1],
                        });
                    }
                }
            }

            inputParts.push({
                type: "text",
                text: effectivePrompt,
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const interactionRequest: any = {
                model: selectedModel,
                input: inputParts,
                response_format: {
                    type: "video",
                    aspect_ratio: aspectRatio || DEFAULTS.ASPECT_RATIO,
                    delivery: "uri",
                },
            };

            if (previousInteractionId) {
                interactionRequest.previous_interaction_id =
                    previousInteractionId;
                interactionRequest.task = "edit";
            }

            const interaction =
                await this.ai.interactions.create(interactionRequest);

            const outputVideo = interaction.output_video;
            if (!outputVideo) {
                throw new Error("No video returned in interaction response");
            }

            let videoBuffer: Buffer;

            if (outputVideo.data) {
                videoBuffer = Buffer.from(outputVideo.data, "base64");
            } else if (outputVideo.uri) {
                const fileUri = outputVideo.uri;
                const fileName = fileUri.split("/").pop();
                if (!fileName) {
                    throw new Error(
                        `Invalid file URI returned by Omni: ${fileUri}`,
                    );
                }

                logger.info(
                    `[GeminiService] Polling Omni video file: ${fileName}`,
                );
                let fileState = "";
                let pollCount = 0;
                const maxPolls = 60;
                while (fileState !== "ACTIVE" && pollCount < maxPolls) {
                    const fileInfo = await this.ai.files.get({
                        name: fileName,
                    });
                    fileState = fileInfo.state || "";
                    if (fileState === "FAILED") {
                        throw new Error(
                            "Omni video generation failed on server",
                        );
                    }
                    if (fileState !== "ACTIVE") {
                        await delay(2000);
                    }
                    pollCount++;
                }

                if (fileState !== "ACTIVE") {
                    throw new Error(
                        "Omni video generation timed out on server",
                    );
                }

                logger.info(
                    `[GeminiService] Downloading Omni video from: ${fileUri}`,
                );

                const auth = new GoogleAuth({
                    scopes: "https://www.googleapis.com/auth/cloud-platform",
                });
                const client = await auth.getClient();
                const accessToken = await client.getAccessToken();
                if (!accessToken.token) {
                    throw new Error(
                        "Failed to retrieve Google Auth token for video download",
                    );
                }

                const response = await fetch(fileUri, {
                    headers: {
                        Authorization: `Bearer ${accessToken.token}`,
                    },
                });

                if (!response.ok) {
                    throw new Error(
                        `Failed to download video: ${response.statusText}`,
                    );
                }

                videoBuffer = Buffer.from(await response.arrayBuffer());
            } else {
                throw new Error("Output video has neither data nor uri");
            }

            const filename = `omni-video-${uuidv4()}.mp4`;
            logger.info(
                `[GeminiService] Uploading Omni video to GCS: ${filename}`,
            );
            const gcsUri = await storageService.uploadFile(
                videoBuffer,
                filename,
                outputVideo.mime_type || "video/mp4",
            );

            return {
                videoUrl: gcsUri,
                interactionId: interaction.id,
            };
        }

        logger.info(
            `[GeminiService] Generating video with model: ${selectedModel}, ${resolution}`,
        );

        const videoRequest: GenerateVideosParameters = {
            model: selectedModel,
            source: { prompt: effectivePrompt },
            config: {
                numberOfVideos: 1,
                durationSeconds: duration || DEFAULTS.VIDEO_DURATION,
                aspectRatio: aspectRatio || DEFAULTS.ASPECT_RATIO,
                generateAudio: !!generateAudio,
                resolution: (resolution as string) || "720p",
                outputGcsUri: config.GCS_STORAGE_URI,
            },
        };

        if (firstFrame?.startsWith("gs://")) {
            videoRequest.source!.image = {
                gcsUri: firstFrame,
                mimeType: "image/png",
            };
        }

        if (lastFrame?.startsWith("gs://")) {
            videoRequest.config!.lastFrame = {
                gcsUri: lastFrame,
                mimeType: "image/png",
            };
        }

        const hasExplicitFrames =
            firstFrame?.startsWith("gs://") || lastFrame?.startsWith("gs://");

        if (images && images.length > 0 && !hasExplicitFrames) {
            videoRequest.config!.referenceImages = images.map((image) => ({
                image: { gcsUri: image.url, mimeType: "image/png" },
                referenceType: VideoGenerationReferenceType.ASSET,
            }));
        } else if (images && images.length > 0 && hasExplicitFrames) {
            logger.info(
                "[GeminiService] Ignoring reference images because firstFrame/lastFrame is set",
            );
        }

        logger.info(
            `[GeminiService] Video request: ${JSON.stringify(videoRequest, null, 2)}`,
        );

        let operation = await this.ai.models.generateVideos(videoRequest);

        let pollCount = 0;
        const maxPolls = 120;
        while (!operation.done && pollCount < maxPolls) {
            logger.debug(
                `[GeminiService] Polling video generation... (${pollCount + 1}/${maxPolls})`,
            );
            operation = await this.ai.operations.get({ operation: operation });
            await delay(5000);
            pollCount++;
        }

        if (!operation.done) {
            logger.error(
                `[GeminiService] Video generation timed out: ${JSON.stringify(operation, null, 2)}`,
            );
            throw new Error("Video generation timed out");
        }

        const videos = operation.response?.generatedVideos;
        if (!videos || videos.length === 0) {
            logger.error(
                `No videos generated: ${JSON.stringify(operation, null, 2)}`,
            );
            throw new Error("No videos generated");
        }

        const videoUri = videos[0]?.video?.uri;
        if (!videoUri) {
            throw new Error("Video URI is defined but missing from response");
        }

        return videoUri;
    }

    async upscaleImage(options: UpscaleImageOptions): Promise<string> {
        const { image, upscaleFactor } = options;
        logger.info(
            `[GeminiService] Upscaling image with factor: ${upscaleFactor}`,
        );

        const imageInput: GeminiImage = {};
        if (image.startsWith("data:image/")) {
            const base64Data = image.split(",")[1];
            const mimeType = image.split(";")[0].split(":")[1];
            imageInput.imageBytes = base64Data;
            imageInput.mimeType = mimeType;
        } else if (image.startsWith("gs://")) {
            imageInput.gcsUri = image;
        } else {
            throw new Error("Invalid image format for upscaling");
        }

        const response = await this.ai.models.upscaleImage({
            model: MODELS.IMAGE.IMAGEN_4_0_UPSCALE,
            image: imageInput,
            upscaleFactor,
            config: {
                outputGcsUri: config.GCS_STORAGE_URI,
                outputMimeType: "image/png",
                enhanceInputImage: true,
                imagePreservationFactor: 1.0,
            },
        });

        if (
            !response.generatedImages ||
            response.generatedImages.length === 0
        ) {
            throw new Error("No generated images in upscale response");
        }

        const candidate = response.generatedImages[0];
        if (!candidate.image?.gcsUri)
            throw new Error("No GCS URI in upscale response");

        return candidate.image.gcsUri;
    }

    async generateMusic(options: {
        prompt: string;
        seed?: number;
        model?: string;
    }): Promise<{ audioData: string; mimeType: string }> {
        const { prompt, model = "lyria-3-clip-preview" } = options;

        logger.info(`[GeminiService] Generating music with model: ${model}`);

        const response = await this.ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseModalities: ["AUDIO", "TEXT"],
            },
        });

        const audioPart = response.candidates?.[0]?.content?.parts?.find(
            (part) => part.inlineData,
        );

        if (!audioPart?.inlineData) {
            logger.error(
                `[GeminiService] No audio data in Lyria response: ${JSON.stringify(response, null, 2)}`,
            );
            throw new Error("No audio data in Lyria response");
        }

        return {
            audioData: audioPart.inlineData.data!,
            mimeType: audioPart.inlineData.mimeType ?? "audio/wav",
        };
    }
}

export const geminiService = new GeminiService();
