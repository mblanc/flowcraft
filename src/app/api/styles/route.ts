import { NextResponse } from "next/server";
import { withAuth } from "@/lib/utils/api";
import { styleService } from "@/lib/services/style.service";
import { STYLE_TEMPLATES } from "@/lib/styles/style-templates";
import logger from "@/app/logger";

export const GET = withAuth(async (req, _context, session) => {
    try {
        const { searchParams } = new URL(req.url);
        const tab = searchParams.get("tab") ?? "my";
        const userStyles = await styleService.listStyles(
            session.user!.id!,
            session.user!.email ?? undefined,
            tab,
        );
        return NextResponse.json({
            styles: userStyles,
            templates: STYLE_TEMPLATES,
        });
    } catch (error) {
        logger.error("Error fetching styles:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});

export const POST = withAuth(async (req, _context, session) => {
    try {
        const body = await req.json();
        const { name, description, content, referenceImageUris } = body;

        if (!name?.trim()) {
            return NextResponse.json(
                { error: "Name is required" },
                { status: 400 },
            );
        }

        const contentStr: string = content ?? "";
        if (Buffer.byteLength(contentStr, "utf8") > 800 * 1024) {
            return NextResponse.json(
                { error: "Style content exceeds maximum size (800 KB)" },
                { status: 413 },
            );
        }

        const style = await styleService.createStyle(session.user!.id!, {
            name: name.trim(),
            description: description?.trim() ?? "",
            content: content ?? "",
            referenceImageUris: referenceImageUris ?? [],
        });

        return NextResponse.json(style);
    } catch (error) {
        logger.error("Error creating style:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});
