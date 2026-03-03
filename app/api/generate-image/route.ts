import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { withAuth, formatZodError, handleApiError } from "@/lib/api-utils";
import { GenerateImageSchema } from "@/lib/schemas";
import { geminiService } from "@/lib/services/gemini.service";
import { storageService } from "@/lib/services/storage.service";
import logger from "@/app/logger";

export const POST = withAuth(async (req) => {
    try {
        const body = await req.json();
        const result = GenerateImageSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: formatZodError(result.error),
                },
                { status: 400 },
            );
        }

        const { prompt } = result.data;
        const { data, mimeType } = await geminiService.generateImage(
            result.data,
        );

        const extension = mimeType.split("/")[1] || "png";
        const uuid = uuidv4();
        const filename = `gemini-${uuid}.${extension}`;

        const imageGcsUri = await storageService.uploadImage(data, filename);

        if (!imageGcsUri) {
            throw new Error("Failed to upload generated image to storage");
        }

        return NextResponse.json({
            imageUrl: imageGcsUri,
            prompt,
        });
    } catch (error) {
        return handleApiError(error, "Error generating image");
    }
});
