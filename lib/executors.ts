import logger from "@/app/logger";
import {
    LLMData,
    ImageData,
    UpscaleData,
    VideoData,
    ResizeData,
} from "./types";
import { Node } from "@xyflow/react";
import { ExecutionContext } from "./node-registry";

export async function executeLLMNode(
    node: Node<LLMData>,
    inputs: { prompt?: string; files?: { url: string; type: string }[] },
    context?: ExecutionContext,
): Promise<Partial<LLMData>> {
    const { prompt, files } = inputs;
    const finalPrompt = prompt || node.data.instructions;
    const fetcher = context?.fetch || fetch;

    if (!finalPrompt) {
        throw new Error("No prompt available for LLM node");
    }

    logger.info(`[Executor] Generating text with prompt: ${finalPrompt}`);

    const response = await fetcher("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prompt: finalPrompt,
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
    inputs: { prompt?: string; images?: { url: string; type: string }[] },
    context?: ExecutionContext,
): Promise<Partial<ImageData>> {
    const { prompt, images } = inputs;
    const finalPrompt = prompt || node.data.prompt;
    const fetcher = context?.fetch || fetch;

    if (!finalPrompt) {
        throw new Error("No prompt available for image node");
    }

    logger.info(`[Executor] Generating image with prompt: ${finalPrompt}`);

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
        throw new Error(`Failed to generate image: ${errorText}`);
    }

    const data = await response.json();
    return { images: [data.imageUrl] };
}

export async function executeVideoNode(
    node: Node<VideoData>,
    inputs: {
        prompt?: string;
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
