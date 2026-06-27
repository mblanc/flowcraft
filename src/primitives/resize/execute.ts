import { storageService } from "@/lib/services/storage.service";
import { ResizeImageSchema } from "@/lib/schemas";
import { z } from "zod";

type ResizeRequest = z.infer<typeof ResizeImageSchema>;
type ResizeResult = { imageUrl: string };

export async function resizeExecute(
    inputs: ResizeRequest,
    _ctx: { userId: string },
): Promise<ResizeResult> {
    const { image, aspectRatio } = inputs;
    let width = 1920;
    let height = 1080;
    if (aspectRatio === "9:16") {
        width = 1080;
        height = 1920;
    }
    const gcsUri = await storageService.resizeImage(image, width, height);
    if (!gcsUri) {
        throw new Error("Failed to upload resized image");
    }
    return { imageUrl: gcsUri };
}
