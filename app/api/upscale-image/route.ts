import { NextResponse } from "next/server";
import { withAuth, formatZodError } from "@/lib/api-utils";
import { UpscaleImageSchema } from "@/lib/schemas";
import { geminiService } from "@/lib/services/gemini.service";
import logger from "@/app/logger";

export const POST = withAuth(async (req) => {
    try {
        const body = await req.json();
        const result = UpscaleImageSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: formatZodError(result.error),
                },
                { status: 400 },
            );
        }

        const { upscaleFactor } = result.data;
        const imageGcsUri = await geminiService.upscaleImage(result.data);

        return NextResponse.json({
            imageUrl: imageGcsUri,
            upscaleFactor,
        });
    } catch (error) {
        logger.error("[SERVER] Error upscaling image:", error);
        return NextResponse.json(
            {
                error: "Failed to upscale image",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
});
