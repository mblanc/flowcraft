import { NextResponse } from "next/server";
import { withAuth, formatZodError } from "@/lib/api-utils";
import { GenerateTextSchema } from "@/lib/schemas";
import { geminiService } from "@/lib/services/gemini.service";
import logger from "@/app/logger";

export const POST = withAuth(async (req) => {
    try {
        const body = await req.json();
        const result = GenerateTextSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: formatZodError(result.error),
                },
                { status: 400 },
            );
        }

        const text = await geminiService.generateText(result.data);

        return NextResponse.json({ text });
    } catch (error) {
        logger.error("[SERVER] Error generating text:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to generate text",
            },
            { status: 500 },
        );
    }
});
