import { NextResponse } from "next/server";
import { withAuth } from "@/lib/utils/api";
import {
    canvasService,
    type CanvasListTab,
} from "@/lib/services/canvas.service";
import { CanvasCreateSchema } from "@/lib/schemas";
import logger from "@/app/logger";

const CANVAS_TABS: CanvasListTab[] = ["my", "shared", "community"];

export const GET = withAuth(async (req, _context, session) => {
    try {
        const { searchParams } = new URL(req.url);
        const tabParam = searchParams.get("tab") ?? "my";
        if (!CANVAS_TABS.includes(tabParam as CanvasListTab)) {
            return NextResponse.json(
                {
                    error: `Invalid tab. Must be one of: ${CANVAS_TABS.join(", ")}`,
                },
                { status: 400 },
            );
        }
        const tab = tabParam as CanvasListTab;
        const canvases = await canvasService.listCanvases(
            session.user!.id!,
            session.user!.email ?? undefined,
            tab,
        );
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
        const parsed = CanvasCreateSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }

        const canvas = await canvasService.createCanvas(session.user!.id!, {
            name: parsed.data.name.trim(),
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
