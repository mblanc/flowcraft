import { NextResponse } from "next/server";
import { withAuth } from "@/lib/utils/api";
import {
    canvasService,
    CanvasNotFoundError,
    CanvasForbiddenError,
} from "@/lib/services/canvas.service";
import { z } from "zod";
import logger from "@/app/logger";

type Context = { params: Promise<{ id: string }> };

const ToggleSkillSchema = z.object({
    skillName: z.string().min(1),
    enabled: z.boolean(),
});

export const POST = withAuth(async (req, context: Context, session) => {
    try {
        const { id: canvasId } = await context.params;
        const parsed = ToggleSkillSchema.safeParse(await req.json());

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }

        const { skillName, enabled } = parsed.data;

        // Fetch the canvas first to verify existence and user access
        const canvas = await canvasService.getCanvas(
            canvasId,
            session.user!.id!,
            session.user!.email ?? undefined,
        );

        const disabledSkills = new Set(canvas.disabledSkills ?? []);

        if (enabled) {
            disabledSkills.delete(skillName);
        } else {
            disabledSkills.add(skillName);
        }

        const updatedCanvas = await canvasService.updateCanvas(
            canvasId,
            session.user!.id!,
            {
                disabledSkills: Array.from(disabledSkills),
            },
            session.user!.email ?? undefined,
        );

        return NextResponse.json({
            success: true,
            disabledSkills: updatedCanvas.disabledSkills,
        });
    } catch (error) {
        if (error instanceof CanvasNotFoundError) {
            return NextResponse.json(
                { error: "Canvas not found" },
                { status: 404 },
            );
        }
        if (error instanceof CanvasForbiddenError) {
            return NextResponse.json(
                { error: "Forbidden to modify this canvas" },
                { status: 403 },
            );
        }
        logger.error("Error toggling skill for canvas:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});
