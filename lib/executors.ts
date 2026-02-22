import logger from "@/app/logger";
import {
    LLMData,
    ImageData,
    UpscaleData,
    VideoData,
    ResizeData,
    PromptData,
} from "./types";
import { Node } from "@xyflow/react";
import { ExecutionContext } from "./node-registry";
import { withRetry } from "./retry";

export async function executeLLMNode(
    node: Node<LLMData>,
    inputs: { prompts?: string[]; files?: { url: string; type: string }[] },
    context?: ExecutionContext,
): Promise<Partial<LLMData>> {
    const { prompts = [], files } = inputs;
    const fetcher = context?.fetch || fetch;

    // Build final prompts array: instructions first, then all connected prompts
    const finalPrompts: string[] = [];
    if (node.data.instructions) {
        finalPrompts.push(node.data.instructions);
    }
    finalPrompts.push(...prompts);

    if (finalPrompts.length === 0) {
        throw new Error("No prompt available for LLM node");
    }

    logger.info(
        `[Executor] Generating text with prompts: ${JSON.stringify(finalPrompts)}`,
    );

    const response = await fetcher("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prompts: finalPrompts,
            files: files || [],
            model: node.data.model,
            outputType: node.data.outputType,
            responseSchema: node.data.responseSchema,
            strictMode: node.data.strictMode,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate text: ${errorText}`);
    }

    const data = await response.json();
    const output =
        typeof data.text === "object"
            ? JSON.stringify(data.text, null, 2)
            : data.text;
    return { output };
}

export async function executeImageNode(
    node: Node<ImageData>,
    inputs: {
        prompt?: string | string[];
        images?: { url: string; type: string }[];
    },
    context?: ExecutionContext,
): Promise<Partial<ImageData>> {
    const { prompt, images } = inputs;
    const finalPrompt = prompt || node.data.prompt;
    const fetcher = context?.fetch || fetch;

    if (!finalPrompt) {
        throw new Error("No prompt available for image node");
    }

    logger.info(`[Executor] Generating image with prompt: ${finalPrompt}`);

    const generateFn = async () => {
        const response = await fetcher("/api/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: finalPrompt,
                images: images || [],
                aspectRatio: node.data.aspectRatio,
                model: node.data.model,
                resolution: node.data.resolution,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`Failed to generate image: ${errorText}`);
            Object.assign(error, { status: response.status });
            throw error;
        }

        // On success, clear any preceding retry errors
        context?.onNodeUpdate?.(node.id, { error: undefined });
        return response.json();
    };

    let data;
    try {
        data = await withRetry(generateFn, {
            maxRetries: 3,
            onRetry: (attempt, error, delay) => {
                const status =
                    typeof error === "object" &&
                    error !== null &&
                    "status" in error
                        ? (error as { status: number }).status
                        : undefined;
                if (status === 429) {
                    const msg = `High traffic detected! Our AI artists are working overtime. Retrying in a moment... (Attempt ${attempt}/3)`;
                    context?.onNodeUpdate?.(node.id, { error: msg });
                } else {
                    context?.onNodeUpdate?.(node.id, {
                        error: `Generation failed. Retrying in a moment... (Attempt ${attempt}/3)`,
                    });
                }
                logger.warn(
                    `[Executor] Attempt ${attempt} failed for image node ${node.id}. Retrying in ${Math.round(delay)}ms...`,
                    error,
                );
            },
        });
    } catch (error) {
        const status =
            typeof error === "object" && error !== null && "status" in error
                ? (error as { status: number }).status
                : undefined;
        if (status === 429) {
            const finalErr = `High traffic detected! Our AI artists are working overtime. Please try again later.`;
            context?.onNodeUpdate?.(node.id, { error: finalErr });
            throw new Error(finalErr);
        }
        throw error;
    }

    return { images: [data.imageUrl] };
}

export async function executeVideoNode(
    node: Node<VideoData>,
    inputs: {
        prompt?: string | string[];
        firstFrame?: string;
        lastFrame?: string;
        images?: { url: string; type: string }[];
    },
    context?: ExecutionContext,
): Promise<Partial<VideoData>> {
    const { prompt, firstFrame, lastFrame, images } = inputs;
    const finalPrompt = prompt || node.data.prompt;
    const fetcher = context?.fetch || fetch;

    if (!finalPrompt) {
        throw new Error("No prompt available for video node");
    }

    logger.info(`[Executor] Generating video with prompt: ${finalPrompt}`);

    const response = await fetcher("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prompt: finalPrompt,
            firstFrame,
            lastFrame,
            images: images || [],
            aspectRatio: node.data.aspectRatio,
            duration: node.data.duration,
            model: node.data.model,
            generateAudio: node.data.generateAudio,
            resolution: node.data.resolution,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate video: ${errorText}`);
    }

    const data = await response.json();
    return {
        videoUrl: data.videoUrl,
        firstFrame,
        lastFrame,
    };
}

export async function executeUpscaleNode(
    node: Node<UpscaleData>,
    inputs: { image?: string },
    context?: ExecutionContext,
): Promise<Partial<UpscaleData>> {
    const { image } = inputs;
    const finalImage = image || node.data.image;
    const fetcher = context?.fetch || fetch;

    if (!finalImage) {
        throw new Error("No image available for upscale node");
    }

    logger.info("[Executor] Upscaling image");

    const response = await fetcher("/api/upscale-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            image: finalImage,
            upscaleFactor: node.data.upscaleFactor,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upscale image: ${errorText}`);
    }

    const data = await response.json();
    return { image: data.imageUrl };
}

export async function executeResizeNode(
    node: Node<ResizeData>,
    inputs: { image?: string },
    context?: ExecutionContext,
): Promise<Partial<ResizeData>> {
    const { image } = inputs;
    const finalImage = image || node.data.image;
    const fetcher = context?.fetch || fetch;

    if (!finalImage) {
        throw new Error("No image available for resize node");
    }

    logger.info("[Executor] Resizing image");

    const response = await fetcher("/api/resize-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            image: finalImage,
            aspectRatio: node.data.aspectRatio,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to resize image: ${errorText}`);
    }

    const data = await response.json();
    return { output: data.imageUrl };
}

export async function executePromptNode(
    node: Node<PromptData>,
    inputs: Record<string, unknown>,
    _context?: ExecutionContext,
): Promise<Partial<PromptData>> {
    const template = node.data.prompt;
    if (!template) {
        return { output: [] };
    }

    // Regex to match @Variable where Variable can be any non-whitespace characters
    // following the @ until next whitespace or punctuation.
    // However, since we defined names like Image#1, we should be careful.
    const regex = /@([^\s,.!?()[\]{}'"]+)/g;
    const parts: {
        text?: string;
        fileData?: { fileUri: string; mimeType: string };
    }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(template)) !== null) {
        // Add preceding text if any
        if (match.index > lastIndex) {
            parts.push({ text: template.substring(lastIndex, match.index) });
        }

        const varName = match[1];
        const value = inputs[varName];

        if (value) {
            // Handle different value types to produce ContentList compatible format
            // If it's a string (GCS URI or base64), it's fileData
            if (typeof value === "string") {
                let mimeType = "application/octet-stream";
                if (value.toLowerCase().endsWith(".pdf"))
                    mimeType = "application/pdf";
                else if (value.match(/\.(png|jpg|jpeg|webp)$/i))
                    mimeType = "image/png";
                else if (value.match(/\.(mp4|mov)$/i)) mimeType = "video/mp4";

                parts.push({
                    fileData: {
                        fileUri: value,
                        mimeType,
                    },
                });
            } else if (Array.isArray(value)) {
                // Handle arrays (e.g., list of images)
                for (const item of value) {
                    if (typeof item === "string") {
                        parts.push({
                            fileData: { fileUri: item, mimeType: "image/png" },
                        });
                    } else if (
                        item &&
                        typeof item === "object" &&
                        "url" in item
                    ) {
                        const obj = item as { url: string; type?: string };
                        parts.push({
                            fileData: {
                                fileUri: obj.url,
                                mimeType: obj.type || "image/png",
                            },
                        });
                    }
                }
            } else if (value && typeof value === "object" && "url" in value) {
                // Handle single object with url/type
                const obj = value as { url: string; type?: string };
                parts.push({
                    fileData: {
                        fileUri: obj.url,
                        mimeType: obj.type || "application/octet-stream",
                    },
                });
            } else {
                // Fallback: convert to text
                parts.push({ text: String(value) });
            }
        } else {
            // Variable not found, keep as text @Variable
            parts.push({ text: `@${varName}` });
        }

        lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < template.length) {
        parts.push({ text: template.substring(lastIndex) });
    }

    const resultParts: {
        text?: string;
        fileData?: { fileUri: string; mimeType: string };
    }[] = parts;

    // Collect all string-like parts (text or URIs) for the 'text' field
    const textParts: string[] = [];
    parts.forEach((part) => {
        if (part.text) {
            textParts.push(part.text);
        } else if (part.fileData?.fileUri) {
            textParts.push(part.fileData.fileUri);
        }
    });

    return {
        output: resultParts,
        text: textParts,
    };
}
