import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { flowService } from "@/lib/services/flow.service";
import logger from "@/app/logger";

export const POST = withAuth<{ params: Promise<{ id: string }> }>(
    async (_req, { params }, session) => {
        const { id: flowId } = await params;
        try {
            const publishedFlow = await flowService.publishFlow(
                flowId,
                session.user!.id!,
            );
            return NextResponse.json(publishedFlow);
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === "Flow not found") {
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
                // Handle validation errors from service as 400
                if (
                    error.message.includes("Flow must have") ||
                    error.message.includes("cycle")
                ) {
                    return NextResponse.json(
                        { error: error.message },
                        { status: 400 },
                    );
                }
            }
            logger.error("Error publishing flow:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
        }
    },
);
