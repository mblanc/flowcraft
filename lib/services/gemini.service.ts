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
} from "@google/genai";
import logger from "@/app/logger";
import { config } from "../config";
import {
    MODELS,
    DEFAULTS,
    ALL_SUPPORTED_MIME_TYPES,
    SupportedMimeType,
} from "../constants";
import type { ContentPart } from "../types";

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
    files?: Array<{ url: string; type: string }>;
    model?: string;
    outputType?: "text" | "json";
    responseSchema?: string;
    strictMode?: boolean;
}

export interface GenerateImageOptions {
    prompt?: string;
    parts?: ContentPart[];
    images?: Array<{ url: string; type: string }>;
    aspectRatio?: string;
    model?: string;
    resolution?: string;
    groundingGoogleSearch?: boolean;
    groundingImageSearch?: boolean;
}

export interface GenerateVideoOptions {
    prompt: string;
    firstFrame?: string;
    lastFrame?: string;
    images?: Array<{ url: string; type: string }>;
    aspectRatio?: string;
    duration?: number;
    model?: string;
    generateAudio?: boolean;
    resolution?: string;
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
        } = options;
        const selectedModel = model || MODELS.TEXT.GEMINI_3_FLASH_PREVIEW;

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
        if (outputType === "json") {
            generationConfig.responseMimeType = "application/json";
            if (responseSchema) {
                try {
                    generationConfig.responseSchema = JSON.parse(
                        responseSchema,
                    ) as Record<string, unknown>;
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
        const selectedModel =
            options.model || MODELS.TEXT.GEMINI_3_FLASH_PREVIEW;

        logger.info(
            `[GeminiService] Streaming text with model: ${selectedModel}`,
        );

        const stream = await this.ai.models.generateContentStream({
            model: selectedModel,
            contents: options.contents,
            config: {
                ...options.config,
                systemInstruction: options.systemInstruction,
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
    }): Promise<GenerateContentResponse> {
        const selectedModel =
            options.model || MODELS.TEXT.GEMINI_3_FLASH_PREVIEW;

        logger.info(
            `[GeminiService] Generating structured output with model: ${selectedModel}`,
        );

        return this.ai.models.generateContent({
            model: selectedModel,
            contents: options.contents,
            config: {
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
            resolution,
            groundingGoogleSearch,
            groundingImageSearch,
        } = options;
        const selectedModel =
            model || MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE_PREVIEW;

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
        const generateContentConfig: GenerateContentConfig = {
            responseModalities: ["IMAGE"],
            imageConfig: {
                aspectRatio: aspectRatio as string,
                imageSize: resolution as string,
            },
            thinkingConfig: {
                thinkingLevel: ThinkingLevel.LOW,
            },
        };

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

    async generateVideo(options: GenerateVideoOptions): Promise<string> {
        const {
            prompt,
            firstFrame,
            lastFrame,
            images,
            aspectRatio,
            duration,
            model,
            generateAudio,
            resolution,
        } = options;

        const selectedModel = model || MODELS.VIDEO.VEO_3_1_FAST_PREVIEW;
        logger.info(
            `[GeminiService] Generating video with model: ${selectedModel}, ${resolution}`,
        );

        const videoRequest: GenerateVideosParameters = {
            model: selectedModel,
            source: { prompt },
            config: {
                numberOfVideos: 1,
                durationSeconds: duration || DEFAULTS.VIDEO_DURATION,
                aspectRatio: aspectRatio || DEFAULTS.ASPECT_RATIO,
                generateAudio: generateAudio !== false,
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

        if (images && images.length > 0) {
            videoRequest.model = MODELS.VIDEO.VEO_3_1_PRO_PREVIEW;
            videoRequest.config!.referenceImages = images.map((image) => ({
                image: { gcsUri: image.url, mimeType: "image/png" },
                referenceType: VideoGenerationReferenceType.ASSET,
            }));
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
}

export const geminiService = new GeminiService();
