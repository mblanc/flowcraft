import { NextResponse } from "next/server";
import { withAuth } from "@/lib/utils/api";
import { skillService, type SkillListTab } from "@/lib/services/skill.service";
import { CreateSkillSchema } from "@/lib/schemas";
import logger from "@/app/logger";

const SKILL_TABS: SkillListTab[] = ["my", "community"];

export const GET = withAuth(async (req, _context, session) => {
    try {
        const { searchParams } = new URL(req.url);
        const tabParam = searchParams.get("tab") ?? "my";
        if (!SKILL_TABS.includes(tabParam as SkillListTab)) {
            return NextResponse.json(
                {
                    error: `Invalid tab. Must be one of: ${SKILL_TABS.join(", ")}`,
                },
                { status: 400 },
            );
        }
        const tab = tabParam as SkillListTab;
        const userSkills = await skillService.listSkills(
            session.user!.id!,
            session.user!.email ?? undefined,
            tab,
        );
        return NextResponse.json({ skills: userSkills });
    } catch (error) {
        logger.error("Error fetching skills:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});

export const POST = withAuth(async (req, _context, session) => {
    try {
        const parsed = CreateSkillSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }

        const { name, description, instructions } = parsed.data;

        const skill = await skillService.createSkill(session.user!.id!, {
            name: name.trim(),
            description: description.trim(),
            instructions: instructions.trim(),
        });

        return NextResponse.json(skill);
    } catch (error) {
        logger.error("Error creating skill:", error);
        if (
            error instanceof Error &&
            error.message.includes("already exists")
        ) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});
