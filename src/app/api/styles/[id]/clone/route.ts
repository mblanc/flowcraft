import { NextResponse } from "next/server";
import { withAuth } from "@/lib/utils/api";
import {
    styleService,
    StyleNotFoundError,
    StyleForbiddenError,
} from "@/lib/services/style.service";
import logger from "@/app/logger";

type Context = { params: Promise<{ id: string }> };

export const POST = withAuth(async (_req, context: Context, session) => {
    try {
        const { id } = await context.params;
        const cloned = await styleService.cloneStyle(
            id,
            session.user!.id!,
            session.user!.email ?? undefined,
        );
        return NextResponse.json(cloned);
    } catch (error) {
        if (error instanceof StyleNotFoundError)
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (error instanceof StyleForbiddenError)
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        logger.error("Error cloning style:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});
