/* eslint-disable @typescript-eslint/no-explicit-any */
import { geminiService } from "@/lib/services/gemini.service";
import { storageService } from "@/lib/services/storage.service";
import { v4 as uuidv4 } from "uuid";
import { GenerateImageSchema } from "@/lib/schemas";
import { z } from "zod";
import {
    resolveInlineMentions,
    appendUnreferencedNodes,
} from "@/lib/node-adapters/utils/mention-resolver";

type ImageRequest = z.infer<typeof GenerateImageSchema> & {
    parts?: any;
    namedNodes?: any;
};
type ImageResult = { imageUrl: string; mimeType: string };

export async function imageExecute(
    inputs: ImageRequest,
    _ctx: { userId: string },
): Promise<ImageResult> {
    let parts = inputs.parts;
    if ((!parts || parts.length === 0) && inputs.prompt && inputs.namedNodes) {
        const referencedIds = new Set<string>();
        const resolvedParts = resolveInlineMentions(
            inputs.prompt,
            inputs.namedNodes,
            referencedIds,
        );
        appendUnreferencedNodes(
            resolvedParts,
            inputs.namedNodes,
            referencedIds,
        );
        parts = resolvedParts;
    }

    const { data, mimeType } = await geminiService.generateImage({
        ...inputs,
        parts,
    });

    const extension = mimeType.split("/")[1] || "png";
    const filename = `gemini-${uuidv4()}.${extension}`;

    const imageGcsUri = await storageService.uploadImage(data, filename);
    if (!imageGcsUri) {
        throw new Error("Failed to upload generated image to storage");
    }

    return { imageUrl: imageGcsUri, mimeType };
}
