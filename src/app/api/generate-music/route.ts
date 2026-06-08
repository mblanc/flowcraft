import { NextResponse } from "next/server";
import { withAuth, formatZodError } from "@/lib/utils/api";
import { serverRegistry as registry } from "@/primitives/server-registry";
import logger from "@/app/logger";

export const POST = withAuth(async (req, _context, session) => {
    try {
        const body = await req.json();
        const primitive = registry.get("music");
        if (!primitive || !primitive.execute) {
            return NextResponse.json(
                { error: "Music primitive not found" },
                { status: 404 },
            );
        }

        if (primitive.requestSchema) {
            const parsed = primitive.requestSchema.safeParse(body);
            if (!parsed.success) {
                return NextResponse.json(
                    {
                        error: "Validation failed",
                        details: formatZodError(parsed.error),
                    },
                    { status: 400 },
                );
            }
        }

        const userId = session.user!.id!;
        const result = await primitive.execute(body, { userId });

        return NextResponse.json({ audioUrl: result.audioUrl });
    } catch (error) {
        logger.error("[SERVER] Error generating music:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to generate music",
            },
            { status: 500 },
        );
    }
});
