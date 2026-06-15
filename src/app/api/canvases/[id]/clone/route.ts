import { NextResponse } from "next/server";
import { withAuth } from "@/lib/utils/api";
import { canvasService } from "@/lib/services/canvas.service";
import logger from "@/app/logger";

export const POST = withAuth<{ params: Promise<{ id: string }> }>(
    async (_req, { params }, session) => {
        const { id: canvasId } = await params;
        try {
            const cloned = await canvasService.cloneCanvas(
                canvasId,
                session.user!.id!,
                session.user!.email ?? undefined,
            );
            return NextResponse.json(cloned);
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === "Canvas not found") {
                    return NextResponse.json(
                        { error: error.message },
                        { status: 404 },
                    );
                }
                if (error.message === "Unauthorized") {
                    return NextResponse.json(
                        { error: error.message },
                        { status: 403 },
                    );
                }
            }
            logger.error(`Error cloning canvas ${canvasId}:`, error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
        }
    },
);
