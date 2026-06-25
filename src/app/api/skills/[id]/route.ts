import { NextResponse } from "next/server";
import { withAuth } from "@/lib/utils/api";
import {
    skillService,
    SkillNotFoundError,
    SkillForbiddenError,
} from "@/lib/services/skill.service";
import { UpdateSkillSchema } from "@/lib/schemas";
import logger from "@/app/logger";

type Context = { params: Promise<{ id: string }> };

function handleSkillError(error: unknown, operation: string) {
    if (error instanceof SkillNotFoundError)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (error instanceof SkillForbiddenError)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    logger.error(`Error ${operation} skill:`, error);
    return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
    );
}

export const GET = withAuth(async (_req, context: Context, session) => {
    try {
        const { id } = await context.params;
        const skill = await skillService.getSkill(
            id,
            session.user!.id!,
            session.user!.email ?? undefined,
        );
        return NextResponse.json(skill);
    } catch (error) {
        return handleSkillError(error, "fetching");
    }
});

export const PATCH = withAuth(async (req, context: Context, session) => {
    try {
        const { id } = await context.params;
        const parsed = UpdateSkillSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }

        const {
            name,
            description,
            triggerHints,
            phases,
            visibility,
            isTemplate,
        } = parsed.data;

        const skill = await skillService.updateSkill(
            id,
            session.user!.id!,
            {
                name: name?.trim(),
                description: description?.trim(),
                triggerHints: triggerHints?.map((h) => h.trim()),
                phases: phases?.map((p) => ({
                    title: p.title.trim(),
                    rules: p.rules.trim(),
                })),
                visibility,
                isTemplate,
            },
            session.user!.email ?? undefined,
        );
        return NextResponse.json(skill);
    } catch (error) {
        return handleSkillError(error, "updating");
    }
});

export const DELETE = withAuth(async (_req, context: Context, session) => {
    try {
        const { id } = await context.params;
        await skillService.deleteSkill(id, session.user!.id!);
        return NextResponse.json({ success: true });
    } catch (error) {
        return handleSkillError(error, "deleting");
    }
});
