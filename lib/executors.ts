import logger from "@/app/logger";
import {
    LLMData,
    ImageData,
    UpscaleData,
    VideoData,
    ResizeData,
    ContentPart,
    NamedNodeInput,
} from "./types";
import { Node } from "@xyflow/react";
import { ExecutionContext } from "./node-registry";
import { withRetry } from "./retry";

const MENTION_RE = /@\[([^\]]+)\]/g;

/**
 * Parses a string containing `@[nodeId]` tokens and returns a `ContentPart[]`
 * array with media parts interleaved at their exact positions.
 *
 * Text @-references are substituted inline into the surrounding text buffer so
 * that `"A story about @[id1] and @[id2]"` with two text nodes produces a
 * single `{ kind: "text", text: "A story about a cat and a duck" }` part
 * rather than four separate parts.
 *
 * File/media @-references flush the accumulated text buffer and insert the
 * appropriate URI or base64 Part at their exact position, enabling true
 * multimodal interleaving.
 *
 * IDs that are successfully resolved are added to `referencedIds`.
 */
function resolveInlineMentions(
    text: string,
    namedNodes: NamedNodeInput[],
    referencedIds: Set<string>,
): ContentPart[] {
    const nodeMap = new Map(namedNodes.map((n) => [n.nodeId, n]));
    const parts: ContentPart[] = [];
    let currentText = "";
    let lastIndex = 0;

    MENTION_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = MENTION_RE.exec(text)) !== null) {
        // Accumulate plain text before this token
        currentText += text.slice(lastIndex, match.index);

        const nodeId = match[1];
        const named = nodeMap.get(nodeId);

        if (named) {
            referencedIds.add(nodeId);
            if (named.fileValues.length > 0) {
                // Media reference — flush accumulated text, then add file parts
                if (currentText) {
                    parts.push({ kind: "text", text: currentText });
                    currentText = "";
                }
                for (const fv of named.fileValues) {
                    if (fv.url.startsWith("gs://")) {
                        parts.push({
                            kind: "uri",
                            uri: fv.url,
                            mimeType: fv.type,
                        });
                    } else if (fv.url.startsWith("data:")) {
                        const m = fv.url.match(/^data:([^;]+);base64,(.+)$/);
                        if (m)
                            parts.push({
                                kind: "base64",
                                data: m[2],
                                mimeType: m[1],
                            });
                    }
                }
            } else if (named.textValue !== null) {
                // Text reference — merge inline into the current text buffer
                currentText += named.textValue;
            }
        } else {
            // Unknown nodeId — keep the raw token as plain text
            currentText += match[0];
        }

        lastIndex = match.index + match[0].length;
    }

    // Flush any remaining text
    currentText += text.slice(lastIndex);
    if (currentText) parts.push({ kind: "text", text: currentText });

    return parts;
}

/**
 * Appends Mode-1 (non-@-referenced) node values to the parts array.
 * All unreferenced text values are merged into a single text part; file
 * values are appended individually after.
 */
function appendUnreferencedNodes(
    parts: ContentPart[],
    namedNodes: NamedNodeInput[],
    referencedIds: Set<string>,
): void {
    const textSegments: string[] = [];
    for (const n of namedNodes) {
        if (referencedIds.has(n.nodeId)) continue;
        if (n.textValue !== null) textSegments.push(n.textValue);
    }
    if (textSegments.length > 0) {
        parts.push({ kind: "text", text: textSegments.join("\n\n") });
    }
    for (const n of namedNodes) {
        if (referencedIds.has(n.nodeId)) continue;
        for (const fv of n.fileValues) {
            if (fv.url.startsWith("gs://")) {
                parts.push({ kind: "uri", uri: fv.url, mimeType: fv.type });
            } else if (fv.url.startsWith("data:")) {
                const m = fv.url.match(/^data:([^;]+);base64,(.+)$/);
                if (m)
                    parts.push({
                        kind: "base64",
                        data: m[2],
                        mimeType: m[1],
                    });
            }
        }
    }
}

export async function executeLLMNode(
    node: Node<LLMData>,
    inputs: {
        prompts?: string[];
        files?: { url: string; type: string }[];
        namedNodes?: NamedNodeInput[];
    },
    context?: ExecutionContext,
): Promise<Partial<LLMData>> {
    const { namedNodes = [] } = inputs;
    const fetcher = context?.fetch || fetch;
    const referencedIds = new Set<string>();

    // Build ContentPart[] from instructions with inline @[nodeId] resolution
    const parts = resolveInlineMentions(
        node.data.instructions,
        namedNodes,
        referencedIds,
    );

    // Mode 1: append non-@-referenced connected nodes
    appendUnreferencedNodes(parts, namedNodes, referencedIds);

    if (parts.length === 0) {
        throw new Error("No prompt available for LLM node");
    }

    logger.info(
        `[Executor] Generating text with ${parts.length} content parts`,
    );

    const response = await fetcher("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            parts,
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
        prompt?: string;
        images?: { url: string; type: string }[];
        namedNodes?: NamedNodeInput[];
    },
    context?: ExecutionContext,
): Promise<Partial<ImageData>> {
    const { namedNodes = [] } = inputs;
    const fetcher = context?.fetch || fetch;
    const referencedIds = new Set<string>();

    // Use the node's own prompt field (which may contain @[nodeId] tokens)
    // plus any connected prompt-input text, resolving mentions inline.
    const promptSource = node.data.prompt || inputs.prompt || "";
    const parts = resolveInlineMentions(promptSource, namedNodes, referencedIds);

    // Mode 1: append non-@-referenced connected nodes
    appendUnreferencedNodes(parts, namedNodes, referencedIds);

    if (parts.length === 0) {
        throw new Error("No prompt available for image node");
    }

    logger.info(
        `[Executor] Generating image with ${parts.length} content parts`,
    );

    const generateFn = async () => {
        const response = await fetcher("/api/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                parts,
                aspectRatio: node.data.aspectRatio,
                model: node.data.model,
                resolution: node.data.resolution,
                groundingGoogleSearch: node.data.groundingGoogleSearch,
                groundingImageSearch: node.data.groundingImageSearch,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`Failed to generate image: ${errorText}`);
            Object.assign(error, { status: response.status });
            throw error;
        }

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
        prompt?: string;
        firstFrame?: string;
        lastFrame?: string;
        images?: { url: string; type: string }[];
        namedNodes?: NamedNodeInput[];
    },
    context?: ExecutionContext,
): Promise<Partial<VideoData>> {
    const { firstFrame, lastFrame, images, namedNodes = [] } = inputs;
    const fetcher = context?.fetch || fetch;

    // For video, @[nodeId] tokens in the prompt are text-only interpolation.
    const rawPrompt = node.data.prompt || inputs.prompt || "";
    const nodeMap = new Map(namedNodes.map((n) => [n.nodeId, n]));
    MENTION_RE.lastIndex = 0;
    const finalPrompt = rawPrompt.replace(MENTION_RE, (_, nodeId) => {
        const named = nodeMap.get(nodeId);
        return named?.textValue ?? "";
    });

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
