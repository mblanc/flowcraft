import { NextResponse } from "next/server";
import { withAuth, formatZodError, handleApiError } from "@/lib/api-utils";
import { GenerateVideoSchema } from "@/lib/schemas";
import { geminiService } from "@/lib/services/gemini.service";
import logger from "@/app/logger";

export const POST = withAuth(async (req) => {
    try {
        const body = await req.json();
        const result = GenerateVideoSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: formatZodError(result.error),
                },
                { status: 400 },
            );
        }

        const videoUrl = await geminiService.generateVideo(result.data);

        return NextResponse.json({ videoUrl });
    } catch (error) {
        return handleApiError(error, "Error generating video");
    }
});
