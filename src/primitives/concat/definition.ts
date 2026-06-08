/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import type { Primitive } from "../types";

const concatRequestSchema = z.object({
    inputUris: z.array(z.string()),
    label: z.string().optional(),
    prompt: z.string().optional(),
    dependsOn: z.array(z.string()).optional(),
});

const concatOutputSchema = z.object({
    videoUrl: z.string(),
});

export const concatPrimitive: Primitive<
    null,
    any,
    z.infer<typeof concatRequestSchema>,
    z.infer<typeof concatOutputSchema>
> = {
    id: "concat",
    label: "Concat Videos",
    mediaType: "video",
    requestSchema: concatRequestSchema,
    outputShape: concatOutputSchema,

    execute: null,

    flow: null,

    canvas: {
        type: "canvas-concat",
        toRequest: (step, _ctx) => ({
            inputUris: step.inputUris ?? [],
            label: step.label,
            prompt: step.prompt,
            dependsOn: step.dependsOn,
        }),
        toCanvasData: (step, result) => ({
            type: "canvas-video",
            label: step.label ?? "Final cut",
            sourceUrl: result.videoUrl,
            mimeType: "video/mp4",
            prompt: step.prompt ?? "",
            operation: "concat",
            derivedFrom: step.dependsOn,
        }),
    },

    agent: null,
};
