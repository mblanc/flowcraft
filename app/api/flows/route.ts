import { NextResponse } from "next/server";
import { withAuth, formatZodError } from "@/lib/api-utils";
import { FlowCreateSchema } from "@/lib/schemas";
import { flowService } from "@/lib/services/flow.service";
import logger from "@/app/logger";

export const GET = withAuth(async (req, context, session) => {
    try {
        const { searchParams } = new URL(req.url);
        const tab = searchParams.get("tab") || "my";
        const flows = await flowService.listFlows(
            session.user!.id!,
            session.user!.email!,
            tab,
        );
        return NextResponse.json({ flows });
    } catch (error) {
        logger.error("Error fetching flows:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});

export const POST = withAuth(async (req, context, session) => {
    try {
        const body = await req.json();
        const result = FlowCreateSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: formatZodError(result.error),
                },
                { status: 400 },
            );
        }

        const flow = await flowService.createFlow(
            session.user!.id!,
            result.data,
        );

        return NextResponse.json(flow);
    } catch (error) {
        logger.error("Error creating flow:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});
