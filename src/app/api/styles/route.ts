import { NextResponse } from "next/server";
import { withAuth } from "@/lib/utils/api";
import { styleService, type StyleListTab } from "@/lib/services/style.service";
import { StyleCreateSchema } from "@/lib/schemas";

const STYLE_TABS: StyleListTab[] = ["my", "shared", "community"];
import { STYLE_TEMPLATES } from "@/lib/styles/style-templates";
import logger from "@/app/logger";

export const GET = withAuth(async (req, _context, session) => {
    try {
        const { searchParams } = new URL(req.url);
        const tabParam = searchParams.get("tab") ?? "my";
        if (!STYLE_TABS.includes(tabParam as StyleListTab)) {
            return NextResponse.json(
                {
                    error: `Invalid tab. Must be one of: ${STYLE_TABS.join(", ")}`,
                },
                { status: 400 },
            );
        }
        const tab = tabParam as StyleListTab;
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
        const parsed = StyleCreateSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }

        const { name, description, content } = parsed.data;
        const contentStr = content ?? "";
        if (Buffer.byteLength(contentStr, "utf8") > 800 * 1024) {
            return NextResponse.json(
                { error: "Style content exceeds maximum size (800 KB)" },
                { status: 413 },
            );
        }

        const style = await styleService.createStyle(session.user!.id!, {
            name: name.trim(),
            description: description?.trim() ?? "",
            content: contentStr,
            referenceImageUris: parsed.data.referenceImageUris ?? [],
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
