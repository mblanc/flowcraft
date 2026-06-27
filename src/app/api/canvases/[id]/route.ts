import { NextResponse } from "next/server";
import { withAuth } from "@/lib/utils/api";
import {
    canvasService,
    CanvasNotFoundError,
    CanvasForbiddenError,
} from "@/lib/services/canvas.service";
import { CanvasUpdateSchema } from "@/lib/schemas";
import logger from "@/app/logger";

function handleCanvasError(error: unknown, operation: string) {
    if (error instanceof CanvasNotFoundError)
        return NextResponse.json(
            { error: "Canvas not found" },
            { status: 404 },
        );
    if (error instanceof CanvasForbiddenError)
        return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof SyntaxError) {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 },
        );
    }
    logger.error(`Error ${operation} canvas:`, error);
    return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
    );
}

export const GET = withAuth<{ params: Promise<{ id: string }> }>(
    async (_req, { params }, session) => {
        const { id: canvasId } = await params;
        try {
            const canvas = await canvasService.getCanvas(
                canvasId,
                session.user!.id!,
                session.user!.email ?? undefined,
            );
            return NextResponse.json(canvas);
        } catch (error) {
            return handleCanvasError(error, "fetching");
        }
    },
);

export const PATCH = withAuth<{ params: Promise<{ id: string }> }>(
    async (req, { params }, session) => {
        const { id: canvasId } = await params;
        try {
            const parsed = CanvasUpdateSchema.safeParse(await req.json());
            if (!parsed.success) {
                return NextResponse.json(
                    { error: parsed.error.flatten().fieldErrors },
                    { status: 400 },
                );
            }

            const updatedCanvas = await canvasService.updateCanvas(
                canvasId,
                session.user!.id!,
                parsed.data,
                session.user!.email ?? undefined,
            );
            return NextResponse.json(updatedCanvas);
        } catch (error) {
            return handleCanvasError(error, "updating");
        }
    },
);

export const DELETE = withAuth<{ params: Promise<{ id: string }> }>(
    async (_req, { params }, session) => {
        const { id: canvasId } = await params;
        try {
            const result = await canvasService.deleteCanvas(
                canvasId,
                session.user!.id!,
            );
            return NextResponse.json(result);
        } catch (error) {
            return handleCanvasError(error, "deleting");
        }
    },
);
