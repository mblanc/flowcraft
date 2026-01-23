import { NextResponse, NextRequest } from "next/server";
import { withAuth, formatZodError } from "@/lib/api-utils";
import { CustomNodeUpdateSchema } from "@/lib/schemas";
import { customNodeService } from "@/lib/services/custom-node.service";
import logger from "@/app/logger";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withAuth(async (_req, context, session) => {
    try {
        const { id } = await (context as RouteContext).params;
        const customNode = await customNodeService.getCustomNode(
            id,
            session.user!.id!,
        );
        return NextResponse.json(customNode);
    } catch (error) {
        logger.error("Error fetching custom node:", error);
        const message =
            error instanceof Error ? error.message : "Internal server error";
        const status =
            message === "Custom node not found"
                ? 404
                : message === "Unauthorized"
                  ? 403
                  : 500;
        return NextResponse.json({ error: message }, { status });
    }
});

export const PUT = withAuth(async (req: NextRequest, context, session) => {
    try {
        const { id } = await (context as RouteContext).params;
        const body = await req.json();
        const result = CustomNodeUpdateSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: formatZodError(result.error),
                },
                { status: 400 },
            );
        }

        const customNode = await customNodeService.updateCustomNode(
            id,
            session.user!.id!,
            result.data,
        );

        return NextResponse.json(customNode);
    } catch (error) {
        logger.error("Error updating custom node:", error);
        const message =
            error instanceof Error ? error.message : "Internal server error";
        const status =
            message === "Custom node not found"
                ? 404
                : message === "Unauthorized"
                  ? 403
                  : message.includes("must have at least one") ||
                      message.includes("cycle")
                    ? 400
                    : 500;
        return NextResponse.json({ error: message }, { status });
    }
});

export const DELETE = withAuth(async (_req, context, session) => {
    try {
        const { id } = await (context as RouteContext).params;
        await customNodeService.deleteCustomNode(id, session.user!.id!);
        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error deleting custom node:", error);
        const message =
            error instanceof Error ? error.message : "Internal server error";
        const status =
            message === "Custom node not found"
                ? 404
                : message === "Unauthorized"
                  ? 403
                  : 500;
        return NextResponse.json({ error: message }, { status });
    }
});
