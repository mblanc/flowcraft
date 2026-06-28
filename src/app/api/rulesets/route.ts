import { NextResponse } from "next/server";
import { withAuth } from "@/lib/utils/api";
import {
    rulesetService,
    type RulesetListTab,
} from "@/lib/services/ruleset.service";
import { CreateRulesetSchema } from "@/lib/schemas";
import logger from "@/app/logger";

const RULESET_TABS: RulesetListTab[] = ["my", "shared", "community"];

export const GET = withAuth(async (req, _context, session) => {
    try {
        const { searchParams } = new URL(req.url);
        const tabParam = searchParams.get("tab") ?? "my";
        if (!RULESET_TABS.includes(tabParam as RulesetListTab)) {
            return NextResponse.json(
                {
                    error: `Invalid tab. Must be one of: ${RULESET_TABS.join(", ")}`,
                },
                { status: 400 },
            );
        }
        const rulesets = await rulesetService.listRulesets(
            session.user!.id!,
            session.user!.email ?? undefined,
            tabParam as RulesetListTab,
        );
        return NextResponse.json({ rulesets });
    } catch (error) {
        logger.error("Error fetching rulesets:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});

export const POST = withAuth(async (req, _context, session) => {
    try {
        const parsed = CreateRulesetSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }

        const ruleset = await rulesetService.createRuleset(session.user!.id!, {
            name: parsed.data.name.trim(),
            description: parsed.data.description?.trim(),
            rules: parsed.data.rules,
            visibility: parsed.data.visibility,
            sharedWith: parsed.data.sharedWith,
        });

        return NextResponse.json(ruleset);
    } catch (error) {
        logger.error("Error creating ruleset:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});
