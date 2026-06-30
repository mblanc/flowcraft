/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { GenerateVideoSchema } from "@/lib/schemas";
import type { Primitive } from "../types";
import type { VideoData } from "@/lib/types";
import type { CanvasVideoData } from "@/lib/canvas/types";
import { DEFAULTS, MODELS } from "@/lib/constants";
import {
    getSourceValue,
    isCollectionSource,
    findInputByHandle,
} from "@/lib/node-adapters/utils/node-helpers";

const videoOutputSchema = z.object({
    videoUrl: z.string(),
});

export const videoPrimitive: Primitive<
    VideoData,
    CanvasVideoData,
    z.infer<typeof GenerateVideoSchema>,
    z.infer<typeof videoOutputSchema>
> = {
    id: "video",
    label: "Video Generation",
    mediaType: "video",
    requestSchema: GenerateVideoSchema,
    outputShape: videoOutputSchema,

    execute: null,

    flow: {
        type: "video",
        inputs: {
            "prompt-input": "text",
            "first-frame-input": "image",
            "last-frame-input": "image",
            "image-input": "image",
            "audio-input": "audio",
        },
        outputs: {
            "result-output": "video",
        },
        gatherInputs: (node, edges, getSourceData) => {
            const inputs: any = {
                images: [],
                namedNodes: [],
                // Seed from node config; edge-connected values override below.
                prompt: node.data.prompt || undefined,
                model: node.data.model,
                aspectRatio: node.data.aspectRatio,
                duration: node.data.duration,
                generateAudio: node.data.generateAudio,
                resolution: node.data.resolution,
            };
            const namedNodesMap = new Map<string, any>();

            const promptEdges = edges.filter(
                (e) =>
                    e.target === node.id && e.targetHandle === "prompt-input",
            );
            for (const promptEdge of promptEdges) {
                const promptData = getSourceData(
                    promptEdge.source,
                    promptEdge.sourceHandle,
                );
                const promptValue = getSourceValue(promptData);

                if (
                    Array.isArray(promptValue) &&
                    isCollectionSource(promptData)
                ) {
                    if (!namedNodesMap.has(promptEdge.source)) {
                        namedNodesMap.set(promptEdge.source, {
                            nodeId: promptEdge.source,
                            name: promptData!.name,
                            textValue: (promptValue as string[])[0] ?? null,
                            textValues: promptValue as string[],
                            fileValues: [],
                        });
                    }
                } else if (typeof promptValue === "string") {
                    if (inputs.prompt === undefined)
                        inputs.prompt = promptValue;
                    if (promptData && !namedNodesMap.has(promptEdge.source)) {
                        namedNodesMap.set(promptEdge.source, {
                            nodeId: promptEdge.source,
                            name: promptData.name,
                            textValue: promptValue,
                            fileValues: [],
                        });
                    }
                }
            }

            const firstFrameData = findInputByHandle(
                node.id,
                edges,
                "first-frame-input",
                getSourceData,
            );
            const firstFrameValue = getSourceValue(firstFrameData);
            if (firstFrameValue) {
                const val = Array.isArray(firstFrameValue)
                    ? firstFrameValue[0]
                    : firstFrameValue;
                if (typeof val === "string") inputs.firstFrame = val;
                else if (
                    typeof val === "object" &&
                    val !== null &&
                    (val as Record<string, unknown>).url
                )
                    inputs.firstFrame = (val as Record<string, unknown>)
                        .url as string;
            }

            const lastFrameData = findInputByHandle(
                node.id,
                edges,
                "last-frame-input",
                getSourceData,
            );
            const lastFrameValue = getSourceValue(lastFrameData);
            if (lastFrameValue) {
                const val = Array.isArray(lastFrameValue)
                    ? lastFrameValue[0]
                    : lastFrameValue;
                if (typeof val === "string") inputs.lastFrame = val;
                else if (
                    typeof val === "object" &&
                    val !== null &&
                    (val as Record<string, unknown>).url
                )
                    inputs.lastFrame = (val as Record<string, unknown>)
                        .url as string;
            }

            const audioData = findInputByHandle(
                node.id,
                edges,
                "audio-input",
                getSourceData,
            );
            const audioValue = getSourceValue(audioData);
            if (audioValue) {
                const val = Array.isArray(audioValue)
                    ? audioValue[0]
                    : audioValue;
                if (typeof val === "string") inputs.audio = val;
                else if (
                    typeof val === "object" &&
                    val !== null &&
                    (val as Record<string, unknown>).url
                )
                    inputs.audio = (val as Record<string, unknown>)
                        .url as string;
            }

            const imageEdges = edges.filter(
                (e) => e.target === node.id && e.targetHandle === "image-input",
            );
            for (const edge of imageEdges) {
                const sourceData = getSourceData(
                    edge.source,
                    edge.sourceHandle,
                );
                if (!sourceData) continue;
                const value = getSourceValue(sourceData);
                if (!value) continue;

                const values = Array.isArray(value) ? value : [value];
                for (const item of values) {
                    if (typeof item === "string") {
                        inputs.images?.push({ url: item, type: "image/png" });
                    } else if (
                        typeof item === "object" &&
                        item !== null &&
                        (item as Record<string, unknown>).url
                    ) {
                        const itemObj = item as Record<string, unknown>;
                        inputs.images?.push({
                            url: itemObj.url as string,
                            type: (itemObj.type as string) || "image/png",
                        });
                    }
                }
            }

            inputs.namedNodes = Array.from(namedNodesMap.values());
            return inputs;
        },
        toFlowData: (node, inputs, result) => {
            const mediaInputs = [
                ...(inputs.firstFrame
                    ? [{ url: inputs.firstFrame, mimeType: "image/png" }]
                    : []),
                ...(inputs.lastFrame
                    ? [{ url: inputs.lastFrame, mimeType: "image/png" }]
                    : []),
                ...(inputs.images ?? []).map((i: any) => ({
                    url: i.url,
                    mimeType: i.type,
                })),
                ...(inputs.audio
                    ? [{ url: inputs.audio, mimeType: "audio/mp3" }]
                    : []),
            ];
            return {
                videoUrl: result.videoUrl,
                resolvedPrompt: node.data.prompt || inputs.prompt || undefined,
                ...(mediaInputs.length ? { mediaInputs } : {}),
            };
        },
        mergeResults: (results) => {
            if (results.length === 0) return {};
            const allUrls = results
                .map((r) => (r as Record<string, unknown>).videoUrl as string)
                .filter(Boolean);
            return {
                videoUrl: allUrls[0],
                videoUrls: allUrls,
                resolvedPrompt: (results[0] as Record<string, unknown>)
                    ?.resolvedPrompt as string | undefined,
                mediaInputs: (results[0] as Record<string, unknown>)
                    ?.mediaInputs as
                    | { url: string; mimeType?: string }[]
                    | undefined,
            };
        },
        saveToLibrary: async (node, result, ctx) => {
            const { flowId, flowName, fetch: fetchFn } = ctx;
            // result is the flow data shape: { videoUrl?, videoUrls?, resolvedPrompt?, mediaInputs? }
            const r = result as Record<string, unknown>;
            const uris =
                (r.videoUrls as string[] | undefined) ??
                (r.videoUrl ? [r.videoUrl as string] : []);
            if (uris.length === 0) return;
            const provenance = {
                sourceType: "flow" as const,
                sourceId: flowId,
                sourceName: flowName ?? "Untitled Flow",
                nodeId: node.id,
                nodeLabel: node.data.name || node.data.type,
                prompt:
                    (r.resolvedPrompt as string | undefined) ??
                    node.data.prompt,
                mediaInputs: r.mediaInputs as
                    | { url: string; mimeType?: string }[]
                    | undefined,
            };

            await Promise.all(
                uris.filter(Boolean).map((gcsUri) =>
                    fetchFn("/api/library", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "video",
                            gcsUri,
                            mimeType: "video/mp4",
                            aspectRatio: node.data.aspectRatio,
                            duration: node.data.duration,
                            model: node.data.model,
                            provenance,
                        }),
                    }),
                ),
            );
        },
        defaultData: {
            type: "video",
            name: "Video",
            prompt: "",
            images: [],
            aspectRatio: DEFAULTS.ASPECT_RATIO,
            duration: DEFAULTS.VIDEO_DURATION,
            model: MODELS.VIDEO.GEMINI_OMNI_FLASH,
            generateAudio: false,
            resolution: "720p",
        },
    },

    canvas: {
        type: "canvas-video",
        toCanvasData: (step, result) => {
            return {
                type: "canvas-video",
                label: step.label || "Generated Video",
                sourceUrl: result.videoUrl,
                mimeType: "video/mp4",
                prompt: step.prompt,
                width: step.width || 480,
                height: step.height || 270,
                aspectRatio: step.aspectRatio,
                resolution: step.resolution,
                model: step.model,
                status: "ready",
                styleId: step.styleId,
                styleName: step.styleName,
                operation: step.operation,
                planNodeId: step.planNodeId,
                derivedFrom: step.derivedFrom,
                skill: step.skill,
            };
        },
        toRequest: (step, _ctx) => {
            return {
                prompt: step.prompt || "",
                firstFrame: step.firstFrame,
                lastFrame: step.lastFrame,
                images: step.images || [],
                aspectRatio: step.aspectRatio || DEFAULTS.ASPECT_RATIO,
                duration: step.duration || DEFAULTS.VIDEO_DURATION,
                model: step.model || MODELS.VIDEO.VEO_3_1_LITE,
                generateAudio:
                    step.generateAudio !== undefined
                        ? step.generateAudio
                        : false,
                resolution: step.resolution || "720p",
                ...(step.styleInstruction
                    ? { styleInstruction: step.styleInstruction }
                    : {}),
            };
        },
    },

    agent: {
        skillPath:
            "src/lib/canvas/agent/skills/primitives/video-generation/SKILL.md",
        operationId: "t2v",
    },
};
export default videoPrimitive;
