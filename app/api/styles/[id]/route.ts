import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import {
    styleService,
    StyleNotFoundError,
    StyleForbiddenError,
} from "@/lib/services/style.service";
import logger from "@/app/logger";

type Context = { params: Promise<{ id: string }> };

function handleStyleError(error: unknown, operation: string) {
    if (error instanceof StyleNotFoundError)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (error instanceof StyleForbiddenError)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    logger.error(`Error ${operation} style:`, error);
    return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
    );
}

export const GET = withAuth(async (_req, context: Context, session) => {
    try {
        const { id } = await context.params;
        const style = await styleService.getStyle(id, session.user!.id!);
        return NextResponse.json(style);
    } catch (error) {
        return handleStyleError(error, "fetching");
    }
});

export const PUT = withAuth(async (req, context: Context, session) => {
    try {
        const { id } = await context.params;
        const body = await req.json();

        const contentStr: string = body.content ?? "";
        if (Buffer.byteLength(contentStr, "utf8") > 800 * 1024) {
            return NextResponse.json(
                { error: "Style content exceeds maximum size (800 KB)" },
                { status: 413 },
            );
        }

        const style = await styleService.updateStyle(id, session.user!.id!, {
            name: body.name?.trim(),
            description: body.description?.trim(),
            content: body.content,
            referenceImageUris: body.referenceImageUris,
        });
        return NextResponse.json(style);
    } catch (error) {
        return handleStyleError(error, "updating");
    }
});

export const DELETE = withAuth(async (_req, context: Context, session) => {
    try {
        const { id } = await context.params;
        await styleService.deleteStyle(id, session.user!.id!);
        return NextResponse.json({ success: true });
    } catch (error) {
        return handleStyleError(error, "deleting");
    }
});
