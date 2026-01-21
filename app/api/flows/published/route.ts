import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { flowService } from "@/lib/services/flow.service";
import logger from "@/app/logger";

export const GET = withAuth(async (req, context, session) => {
    try {
        const { searchParams } = new URL(req.url);
        const filter = (searchParams.get("filter") || "all") as "mine" | "public" | "all";
        
        const flows = await flowService.listPublishedFlows(session.user!.id!, filter);
        return NextResponse.json({ flows });
    } catch (error) {
        logger.error("Error fetching published flows:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});
