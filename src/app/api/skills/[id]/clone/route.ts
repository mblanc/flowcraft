import { NextResponse } from "next/server";
import { withAuth } from "@/lib/utils/api";
import {
    skillService,
    SkillNotFoundError,
    SkillForbiddenError,
} from "@/lib/services/skill.service";
import logger from "@/app/logger";

type Context = { params: Promise<{ id: string }> };

export const POST = withAuth(async (_req, context: Context, session) => {
    try {
        const { id } = await context.params;
        const cloned = await skillService.cloneSkill(
            id,
            session.user!.id!,
            session.user!.email ?? undefined,
        );
        return NextResponse.json(cloned);
    } catch (error) {
        if (error instanceof SkillNotFoundError) {
            return NextResponse.json(
                { error: "Original skill not found" },
                { status: 404 },
            );
        }
        if (error instanceof SkillForbiddenError) {
            return NextResponse.json(
                { error: "Forbidden to clone this skill" },
                { status: 403 },
            );
        }
        logger.error("Error cloning skill:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});
