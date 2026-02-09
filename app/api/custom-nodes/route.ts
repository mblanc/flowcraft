import { NextResponse } from "next/server";
import { withAuth, formatZodError } from "@/lib/api-utils";
import { CustomNodeCreateSchema } from "@/lib/schemas";
import { customNodeService } from "@/lib/services/custom-node.service";
import logger from "@/app/logger";

export const GET = withAuth(async (_req, _context, session) => {
    try {
        const customNodes = await customNodeService.listCustomNodes(
            session.user!.id!,
        );
        return NextResponse.json({ customNodes });
    } catch (error) {
        logger.error("Error fetching custom nodes:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});

export const POST = withAuth(async (req, _context, session) => {
    try {
        const body = await req.json();
        const result = CustomNodeCreateSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: formatZodError(result.error),
                },
                { status: 400 },
            );
        }

        const customNode = await customNodeService.createCustomNode(
            session.user!.id!,
            result.data,
        );

        return NextResponse.json(customNode);
    } catch (error) {
        logger.error("Error creating custom node:", error);
        const message =
            error instanceof Error ? error.message : "Internal server error";
        const status = message.includes("must have at least one") ? 400 : 500;
        return NextResponse.json({ error: message }, { status });
    }
});
