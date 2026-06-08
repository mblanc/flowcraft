/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import type { Primitive } from "../types";
import type { MusicData } from "@/lib/types";
import type { CanvasAudioData } from "@/lib/canvas/types";
import { MODELS } from "@/lib/constants";

const musicRequestSchema = z.object({
    prompt: z.string().min(1, "Prompt is required"),
    negativePrompt: z.string().optional(),
    seed: z.number().optional(),
    duration: z.number().optional().default(30),
    model: z
        .enum([MODELS.MUSIC.LYRIA_3_CLIP, MODELS.MUSIC.LYRIA_3_PRO])
        .optional()
        .default(MODELS.MUSIC.LYRIA_3_CLIP),
});

const musicOutputSchema = z.object({
    audioUrl: z.string(),
    mimeType: z.string(),
});

export const musicPrimitive: Primitive<
    MusicData,
    CanvasAudioData,
    z.infer<typeof musicRequestSchema>,
    z.infer<typeof musicOutputSchema>
> = {
    id: "music",
    label: "Music Generation",
    mediaType: "audio",
    requestSchema: musicRequestSchema,
    outputShape: musicOutputSchema,

    execute: null,

    flow: {
        type: "music",
        inputs: {
            "prompt-input": "text",
        },
        outputs: {
            "": "audio",
        },
        gatherInputs: (node, edges, getSourceData) => {
            const inputs: any = {};
            const promptEdge = edges.find(
                (e) =>
                    e.target === node.id && e.targetHandle === "prompt-input",
            );
            if (promptEdge) {
                const sourceData = getSourceData(
                    promptEdge.source,
                    promptEdge.sourceHandle,
                );
                const text =
                    (sourceData as any)?.text ?? (sourceData as any)?.output;
                if (typeof text === "string") inputs.prompt = text;
            }
            inputs.prompt = inputs.prompt ?? node.data.prompt;
            inputs.duration = node.data.duration;
            inputs.model = node.data.model;
            return inputs;
        },
        toFlowData: (_node, _inputs, result) => ({
            audioUrl: result.audioUrl,
        }),
        mergeResults: (results) => {
            if (results.length === 0) return {};
            return results[0];
        },
        saveToLibrary: async () => {},
        defaultData: {
            type: "music",
            name: "Music",
            prompt: "",
            duration: 30,
            model: MODELS.MUSIC.LYRIA_3_CLIP,
        },
    },

    canvas: {
        type: "canvas-audio",
        toRequest: (step, _ctx) => ({
            prompt: step.prompt || "",
            negativePrompt: step.negativePrompt,
            seed: step.seed,
            duration: step.duration ?? 30,
            model: step.model ?? MODELS.MUSIC.LYRIA_3_CLIP,
        }),
        toCanvasData: (step, result): CanvasAudioData => ({
            type: "canvas-audio",
            label: step.label ?? "Music",
            sourceUrl: result.audioUrl,
            mimeType: result.mimeType,
            prompt: step.prompt,
            model: step.model,
            status: "ready",
            operation: step.operation,
            planNodeId: step.planNodeId,
            derivedFrom: step.derivedFrom,
        }),
    },

    agent: {
        skillPath:
            "src/lib/canvas/agent/skills/primitives/music-generation/SKILL.md",
        operationId: "t2m",
    },
};
