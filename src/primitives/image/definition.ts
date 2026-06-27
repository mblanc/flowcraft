/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { GenerateImageSchema } from "@/lib/schemas";
import type { Primitive } from "../types";
import type { ImageData } from "@/lib/types";
import type { CanvasImageData } from "@/lib/canvas/types";
import { DEFAULTS, MODELS } from "@/lib/constants";
import {
    getSourceValue,
    isCollectionSource,
    buildFileValues,
    inferMimeType,
    createNamedNodesTracker,
} from "@/lib/node-adapters/utils/node-helpers";

const imageOutputSchema = z.object({
    imageUrl: z.string(),
    mimeType: z.string(),
});

export const imagePrimitive: Primitive<
    ImageData,
    CanvasImageData,
    z.infer<typeof GenerateImageSchema>,
    z.infer<typeof imageOutputSchema>
> = {
    id: "image",
    label: "Image Generation",
    mediaType: "image",
    requestSchema: GenerateImageSchema,
    outputShape: imageOutputSchema,

    execute: null,

    flow: {
        type: "image",
        inputs: {
            "prompt-input": "text",
            "image-input": "image",
        },
        outputs: {
            "result-output": "image",
        },
        gatherInputs: (node, edges, getSourceData) => {
            const validModels = Object.values(MODELS.IMAGE) as string[];
            const inputs: any = {
                images: [],
                namedNodes: [],
                // Seed from node config so the API receives user settings even
                // when no edges are connected. Edge-connected values override below.
                prompt: node.data.prompt || undefined,
                model: validModels.includes(node.data.model)
                    ? node.data.model
                    : MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE,
                aspectRatio: node.data.aspectRatio,
                imageSize: node.data.imageSize,
                groundingGoogleSearch: node.data.groundingGoogleSearch,
                groundingImageSearch: node.data.groundingImageSearch,
                thinkingLevel: node.data.thinkingLevel,
            };
            const tracker = createNamedNodesTracker();

            const promptEdges = edges.filter(
                (e) =>
                    e.target === node.id && e.targetHandle === "prompt-input",
            );
            for (const promptEdge of promptEdges) {
                const sourceData = getSourceData(
                    promptEdge.source,
                    promptEdge.sourceHandle,
                );
                const promptValue = getSourceValue(sourceData);

                if (
                    Array.isArray(promptValue) &&
                    isCollectionSource(sourceData)
                ) {
                    const named = tracker.getOrCreate(
                        promptEdge.source,
                        sourceData!,
                    );
                    named.textValues = promptValue as string[];
                    named.textValue = (promptValue as string[])[0] ?? null;
                } else if (typeof promptValue === "string") {
                    if (inputs.prompt === undefined)
                        inputs.prompt = promptValue;
                    if (sourceData) {
                        const named = tracker.getOrCreate(
                            promptEdge.source,
                            sourceData,
                        );
                        named.textValue = promptValue;
                    }
                }
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

                if (Array.isArray(value) && isCollectionSource(sourceData)) {
                    const named = tracker.getOrCreate(edge.source, sourceData);
                    named.fileValuesList = (value as string[]).map((url) => [
                        { url, type: inferMimeType(url, sourceData) },
                    ]);
                    named.fileValues = named.fileValuesList[0] || [];
                } else {
                    const rawValues = Array.isArray(value) ? value : [value];
                    const fileValues = buildFileValues(rawValues, sourceData);

                    for (const fv of fileValues) {
                        inputs.images?.push(fv);
                    }

                    const named = tracker.getOrCreate(edge.source, sourceData);
                    named.fileValues.push(...fileValues);
                }
            }

            inputs.namedNodes = tracker.values();
            return inputs;
        },
        mergeResults: (results) => {
            if (results.length === 0) return {};
            const allImages = results.flatMap(
                (r) =>
                    ((r as Record<string, unknown>).images as string[]) || [],
            );
            const firstImageResult = results[0] as Record<string, unknown>;
            return {
                images: allImages,
                prompt: firstImageResult?.prompt as string | undefined,
                mediaInputs: firstImageResult?.mediaInputs as any,
            };
        },
        toFlowData: (node, inputs, result) => {
            return {
                images: [result.imageUrl],
                resolvedPrompt: node.data.prompt || inputs.prompt || undefined,
                mediaInputs: inputs.images?.length
                    ? inputs.images.map((i: any) => ({
                          url: i.url,
                          mimeType: i.type || i.mimeType,
                      }))
                    : undefined,
            };
        },
        saveToLibrary: async (node, result, ctx) => {
            const { flowId, flowName, fetch: fetchFn } = ctx;
            // result is the flow data shape: { images: string[], resolvedPrompt?, mediaInputs? }
            const r = result as Record<string, unknown>;
            const uris = (r.images as string[] | undefined) ?? [];
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
                            type: "image",
                            gcsUri,
                            mimeType: "image/png",
                            aspectRatio: node.data.aspectRatio,
                            model: node.data.model,
                            provenance,
                        }),
                    }),
                ),
            );
        },
        defaultData: {
            type: "image",
            name: "Image",
            prompt: "",
            images: [],
            aspectRatio: DEFAULTS.IMAGE_ASPECT_RATIO,
            model: MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE,
            imageSize: DEFAULTS.IMAGE_RESOLUTION,
            groundingGoogleSearch: false,
            groundingImageSearch: false,
            thinkingLevel: "HIGH",
        },
    },

    canvas: {
        type: "canvas-image",
        toCanvasData: (step, result) => {
            return {
                type: "canvas-image",
                label: step.label || "Generated Image",
                sourceUrl: result.imageUrl,
                mimeType: result.mimeType || "image/png",
                prompt: step.prompt,
                width: step.width || 300,
                height: step.height || 300,
                aspectRatio: step.aspectRatio,
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
                aspectRatio: step.aspectRatio || DEFAULTS.IMAGE_ASPECT_RATIO,
                model: step.model || MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE,
                imageSize: step.imageSize || DEFAULTS.IMAGE_RESOLUTION,
                images: step.images || [],
                groundingGoogleSearch: step.groundingGoogleSearch || false,
                groundingImageSearch: step.groundingImageSearch || false,
                thinkingLevel: step.thinkingLevel || "HIGH",
                ...(step.systemInstruction
                    ? { systemInstruction: step.systemInstruction }
                    : {}),
            };
        },
    },

    agent: {
        skillPath:
            "src/lib/canvas/agent/skills/primitives/image-generation/SKILL.md",
        operationId: "t2i",
    },
};
