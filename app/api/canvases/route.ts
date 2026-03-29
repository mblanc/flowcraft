import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { canvasService } from "@/lib/services/canvas.service";
import logger from "@/app/logger";

export const GET = withAuth(async (_req, _context, session) => {
    try {
        const canvases = await canvasService.listCanvases(session.user!.id!);
        return NextResponse.json({ canvases });
    } catch (error) {
        logger.error("Error fetching canvases:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});

export const POST = withAuth(async (req, _context, session) => {
    try {
        const body = await req.json();
        const name = body.name?.trim();

        if (!name) {
            return NextResponse.json(
                { error: "Name is required" },
                { status: 400 },
            );
        }

        const canvas = await canvasService.createCanvas(session.user!.id!, {
            name,
        });
        return NextResponse.json(canvas);
    } catch (error) {
        logger.error("Error creating canvas:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});
