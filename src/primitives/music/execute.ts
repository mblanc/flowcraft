import { geminiService } from "@/lib/services/gemini.service";
import { storageService } from "@/lib/services/storage.service";
import { v4 as uuidv4 } from "uuid";
import { MODELS } from "@/lib/constants";

type MusicRequest = {
    prompt: string;
    seed?: number;
    model?: (typeof MODELS.MUSIC)[keyof typeof MODELS.MUSIC];
};
type MusicResult = { audioUrl: string; mimeType: string };

export async function musicExecute(
    inputs: MusicRequest,
    _ctx: { userId: string },
): Promise<MusicResult> {
    const { audioData, mimeType } = await geminiService.generateMusic({
        prompt: inputs.prompt,
        seed: inputs.seed,
        model: inputs.model,
    });

    const extension =
        mimeType === "audio/mpeg" ? "mp3" : mimeType.split("/")[1] || "wav";
    const audioGcsUri = await storageService.uploadFile(
        Buffer.from(audioData, "base64"),
        `music-${uuidv4()}.${extension}`,
        mimeType,
    );

    return { audioUrl: audioGcsUri, mimeType };
}
