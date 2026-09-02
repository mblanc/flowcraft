/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import type { Primitive } from "../types";
import type { CanvasAudioData } from "@/lib/canvas/types";
import { MODELS } from "@/lib/constants";

const t2sRequestSchema = z.object({
    prompt: z
        .string()
        .min(1, "Prompt script is required")
        .max(5000, "Prompt script exceeds 5000 character limit"),
    voice: z.string().optional(),
    model: z
        .string()
        .optional()
        .default(MODELS.AUDIO.GEMINI_3_1_FLASH_TTS_PREVIEW),
});

const t2sOutputSchema = z.object({
    audioUrl: z.string(),
    mimeType: z.string(),
});

export const t2sPrimitive: Primitive<
    any,
    CanvasAudioData,
    z.infer<typeof t2sRequestSchema>,
    z.infer<typeof t2sOutputSchema>
> = {
    id: "t2s",
    label: "Text-to-Speech",
    mediaType: "audio",
    requestSchema: t2sRequestSchema,
    outputShape: t2sOutputSchema,

    execute: null,

    flow: {
        type: "t2s",
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
            inputs.model = node.data.model;
            return inputs;
        },
        toFlowData: (_node, _inputs, result) => ({
            audioUrl: result.audioUrl,
            mimeType: result.mimeType,
        }),
        mergeResults: (results) => {
            if (results.length === 0) return {};
            return results[0];
        },
        saveToLibrary: async () => {},
        defaultData: {
            type: "t2s",
            name: "Text-to-Speech",
            prompt: "",
            model: MODELS.AUDIO.GEMINI_3_1_FLASH_TTS_PREVIEW,
        },
    },

    canvas: {
        type: "canvas-t2s",
        toRequest: (step, _ctx) => ({
            prompt: step.prompt || "",
            voice: step.voice,
            model: step.model ?? MODELS.AUDIO.GEMINI_3_1_FLASH_TTS_PREVIEW,
        }),
        toCanvasData: (step, result): CanvasAudioData => ({
            type: "canvas-audio",
            label: step.label ?? "Speech Narration",
            sourceUrl: result.audioUrl,
            mimeType: result.mimeType,
            prompt: step.prompt,
            voice: step.voice,
            model: step.model,
            status: "ready",
            operation: step.operation ?? "t2s",
            planNodeId: step.planNodeId,
            derivedFrom: step.derivedFrom,
        }),
    },

    agent: {
        skillPath: "src/lib/canvas/agent/skills/primitives/t2s/SKILL.md",
        operationId: "t2s",
    },
};
