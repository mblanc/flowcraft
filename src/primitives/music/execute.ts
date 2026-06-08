import { geminiService } from "@/lib/services/gemini.service";
import { storageService } from "@/lib/services/storage.service";
import { v4 as uuidv4 } from "uuid";
import { MODELS } from "@/lib/constants";
import { z } from "zod";

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

type MusicRequest = z.infer<typeof musicRequestSchema>;
type MusicResult = { audioUrl: string; mimeType: string };

export async function musicExecute(
    inputs: MusicRequest,
    _ctx: { userId: string },
): Promise<MusicResult> {
    const { audioData, mimeType } = await geminiService.generateMusic({
        prompt: inputs.prompt,
        negativePrompt: inputs.negativePrompt,
        seed: inputs.seed,
        model: inputs.model,
    });

    const extension = mimeType.split("/")[1] || "wav";
    const audioGcsUri = await storageService.uploadFile(
        Buffer.from(audioData, "base64"),
        `music-${uuidv4()}.${extension}`,
        mimeType,
    );

    return { audioUrl: audioGcsUri, mimeType };
}
