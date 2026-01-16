import {
    GoogleGenAI,
    createPartFromBase64,
    createPartFromText,
    createPartFromUri,
    ContentListUnion,
    GenerateVideosParameters,
    VideoGenerationReferenceType,
    Image as GeminiImage,
} from "@google/genai";
import logger from "@/app/logger";

async function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface GenerateTextOptions {
    prompt: string;
    files?: Array<{ url: string }>;
    model?: string;
}

export interface GenerateImageOptions {
    prompt: string;
    images?: string[];
    aspectRatio?: string;
    model?: string;
    resolution?: string;
}

export interface GenerateVideoOptions {
    prompt: string;
    firstFrame?: string;
    lastFrame?: string;
    images?: string[];
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
    private ai: GoogleGenAI;

    constructor() {
        this.ai = new GoogleGenAI({
            vertexai: true,
            project: process.env.PROJECT_ID,
            location: "global", //process.env.LOCATION || "us-central1",
        });
    }

    async generateText(options: GenerateTextOptions): Promise<string> {
        const { prompt, files, model } = options;
        const selectedModel = model || "gemini-2.0-flash-exp";

        logger.info(
            `[GeminiService] Generating text with model: ${selectedModel}`,
        );

        const contents: ContentListUnion = [createPartFromText(prompt)];

        if (files && files.length > 0) {
            for (const file of files) {
                if (file.url.startsWith("gs://")) {
                    // For now using a default or we could inject StorageService to get mimeType
                    // But API routes currently do this themselves or pass it.
                    // Let's assume the caller handles complex part creation or we improve this.
                    contents.push(createPartFromUri(file.url, "image/jpeg"));
                } else if (file.url.startsWith("data:image/")) {
                    const base64Match = file.url.match(
                        /^data:([^;]+);base64,(.+)$/,
                    );
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

        const response = await this.ai.models.generateContent({
            model: selectedModel,
            contents,
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

    async generateImage(
        options: GenerateImageOptions,
    ): Promise<{ data: string; mimeType: string }> {
        const { prompt, images = [], aspectRatio, model } = options;
        const selectedModel = model || "imagen-3.0-generate-001"; // Fallback if not provided

        logger.info(
            `[GeminiService] Generating image with model: ${selectedModel}`,
        );

        const contents: ContentListUnion = [];

        for (const imageUrl of images) {
            if (imageUrl.startsWith("data:image/")) {
                const base64Data = imageUrl.split(",")[1];
                const mimeType = imageUrl.split(";")[0].split(":")[1];
                contents.push(createPartFromBase64(base64Data, mimeType));
            } else if (imageUrl.startsWith("gs://")) {
                contents.push(createPartFromUri(imageUrl, "image/png"));
            }
        }

        contents.push(createPartFromText(prompt));

        const response = await this.ai.models.generateContent({
            model: selectedModel,
            contents,
            config: {
                responseModalities: ["IMAGE"],
                imageConfig: { aspectRatio: aspectRatio as string },
            },
        });

        if (!response.candidates || response.candidates.length === 0) {
            throw new Error("No candidates in response");
        }

        const candidate = response.candidates[0];
        const imagePart = candidate.content?.parts?.find(
            (part) => part.inlineData,
        );

        if (!imagePart?.inlineData) {
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

        const selectedModel = model || "veo-3.1-fast-generate-preview";
        logger.info(
            `[GeminiService] Generating video with model: ${selectedModel}`,
        );

        const videoRequest: GenerateVideosParameters = {
            model: selectedModel,
            source: { prompt },
            config: {
                numberOfVideos: 1,
                durationSeconds: duration || 4,
                aspectRatio: aspectRatio || "16:9",
                generateAudio: generateAudio !== false,
                resolution: (resolution as string) || "720p",
                outputGcsUri: process.env.GCS_STORAGE_URI,
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
            videoRequest.model = "veo-3.1-generate-preview";
            videoRequest.config!.referenceImages = images.map(
                (image: string) => ({
                    image: { gcsUri: image, mimeType: "image/png" },
                    referenceType: VideoGenerationReferenceType.ASSET,
                }),
            );
        }

        let operation = await this.ai.models.generateVideos(videoRequest);

        let pollCount = 0;
        const maxPolls = 60;
        while (!operation.done && pollCount < maxPolls) {
            logger.debug(
                `[GeminiService] Polling video generation... (${pollCount + 1}/${maxPolls})`,
            );
            operation = await this.ai.operations.get({ operation: operation });
            await delay(5000);
            pollCount++;
        }

        if (!operation.done) throw new Error("Video generation timed out");

        const videos = operation.response?.generatedVideos;
        if (!videos || videos.length === 0)
            throw new Error("No videos generated");

        const videoUri = videos[0]?.video?.uri;
        if (!videoUri)
            throw new Error("Video URI is defined but missing from response");

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
            model: "imagen-4.0-upscale-preview",
            image: imageInput,
            upscaleFactor,
            config: {
                outputGcsUri: process.env.GCS_STORAGE_URI,
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
