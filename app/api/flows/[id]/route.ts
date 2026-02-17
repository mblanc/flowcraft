import { NextResponse } from "next/server";
import { withAuth, formatZodError } from "@/lib/api-utils";
import { FlowUpdateSchema } from "@/lib/schemas";
import { flowService } from "@/lib/services/flow.service";
import logger from "@/app/logger";

export const GET = withAuth<{ params: Promise<{ id: string }> }>(
    async (_req, { params }, session) => {
        const { id: flowId } = await params;
        try {
            const flow = await flowService.getFlow(
                flowId,
                session.user!.id!,
                session.user!.email!,
            );
            return NextResponse.json(flow);
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
            }
            logger.error("Error fetching flow:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
        }
    },
);

export const PUT = withAuth<{ params: Promise<{ id: string }> }>(
    async (req, { params }, session) => {
        const { id: flowId } = await params;
        try {
            const body = await req.json();
            const result = FlowUpdateSchema.safeParse(body);

            if (!result.success) {
                return NextResponse.json(
                    {
                        error: "Validation failed",
                        details: formatZodError(result.error),
                    },
                    { status: 400 },
                );
            }

            const updatedFlow = await flowService.updateFlow(
                flowId,
                session.user!.id!,
                result.data,
                session.user!.email!,
            );
            return NextResponse.json(updatedFlow);
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
            }
            logger.error("Error updating flow:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
        }
    },
);

export const PATCH = PUT;

export const DELETE = withAuth<{ params: Promise<{ id: string }> }>(
    async (_req, { params }, session) => {
        const { id: flowId } = await params;
        try {
            const result = await flowService.deleteFlow(
                flowId,
                session.user!.id!,
                session.user!.email!,
            );
            return NextResponse.json(result);
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
            }
            logger.error("Error deleting flow:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
        }
    },
);
