import { geminiService } from "@/lib/services/gemini.service";
import { UpscaleImageSchema } from "@/lib/schemas";
import { z } from "zod";

type UpscaleRequest = z.infer<typeof UpscaleImageSchema>;
type UpscaleResult = { imageUrl: string; upscaleFactor: "x2" | "x3" | "x4" };

export async function upscaleExecute(
    inputs: UpscaleRequest,
    _ctx: { userId: string },
): Promise<UpscaleResult> {
    const imageGcsUri = await geminiService.upscaleImage(inputs);
    return {
        imageUrl: imageGcsUri,
        upscaleFactor: inputs.upscaleFactor || "x2",
    };
}
