import { NextResponse } from "next/server";
import { withAuth } from "@/lib/utils/api";
import {
    rulesetService,
    RulesetNotFoundError,
    RulesetForbiddenError,
} from "@/lib/services/ruleset.service";
import { UpdateRulesetSchema } from "@/lib/schemas";
import logger from "@/app/logger";

type Context = { params: Promise<{ id: string }> };

function handleRulesetError(error: unknown, operation: string) {
    if (error instanceof RulesetNotFoundError)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (error instanceof RulesetForbiddenError)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    logger.error(`Error ${operation} ruleset:`, error);
    return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
    );
}

export const GET = withAuth(async (_req, context: Context, session) => {
    try {
        const { id } = await context.params;
        const ruleset = await rulesetService.getRuleset(
            id,
            session.user!.id!,
            session.user!.email ?? undefined,
        );
        return NextResponse.json(ruleset);
    } catch (error) {
        return handleRulesetError(error, "fetching");
    }
});

export const PATCH = withAuth(async (req, context: Context, session) => {
    try {
        const { id } = await context.params;
        const parsed = UpdateRulesetSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }

        const { name, description, ...rest } = parsed.data;
        const ruleset = await rulesetService.updateRuleset(
            id,
            session.user!.id!,
            {
                name: name?.trim(),
                description: description?.trim(),
                ...rest,
            },
        );
        return NextResponse.json(ruleset);
    } catch (error) {
        return handleRulesetError(error, "updating");
    }
});

export const DELETE = withAuth(async (_req, context: Context, session) => {
    try {
        const { id } = await context.params;
        await rulesetService.deleteRuleset(id, session.user!.id!);
        return NextResponse.json({ success: true });
    } catch (error) {
        return handleRulesetError(error, "deleting");
    }
});
