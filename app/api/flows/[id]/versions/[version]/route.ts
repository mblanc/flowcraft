import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { flowService } from "@/lib/services/flow.service";
import logger from "@/app/logger";

export const GET = withAuth<{ params: Promise<{ id: string, version: string }> }>(
    async (_req, { params }, session) => {
        const { id: flowId, version } = await params;
        try {
            const flowVersion = await flowService.getFlowVersion(flowId, version, session.user!.id!);
            return NextResponse.json(flowVersion);
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === "Version not found") {
                    return NextResponse.json(
                        { error: error.message },
                        { status: 404 },
                    );
                }
                if (error.message === "Unauthorized") {
                    return NextResponse.json(
                        { error: error.message },
                        { status: 403 },
                    );
                }
            }
            logger.error("Error fetching flow version:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
        }
    },
);
