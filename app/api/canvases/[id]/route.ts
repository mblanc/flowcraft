import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { canvasService } from "@/lib/services/canvas.service";
import logger from "@/app/logger";

export const GET = withAuth<{ params: Promise<{ id: string }> }>(
    async (_req, { params }, session) => {
        const { id: canvasId } = await params;
        try {
            const canvas = await canvasService.getCanvas(
                canvasId,
                session.user!.id!,
            );
            return NextResponse.json(canvas);
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
            logger.error("Error fetching canvas:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
        }
    },
);

export const PATCH = withAuth<{ params: Promise<{ id: string }> }>(
    async (req, { params }, session) => {
        const { id: canvasId } = await params;
        try {
            const body = await req.json();

            const updatedCanvas = await canvasService.updateCanvas(
                canvasId,
                session.user!.id!,
                body,
            );
            return NextResponse.json(updatedCanvas);
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
            logger.error("Error updating canvas:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
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
            logger.error("Error deleting canvas:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
        }
    },
);
