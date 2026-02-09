import { NextResponse } from "next/server";
import { withAuth, formatZodError } from "@/lib/api-utils";
import { FlowShareSchema } from "@/lib/schemas";
import { flowService } from "@/lib/services/flow.service";
// Removed unused FlowDocument import
import logger from "@/app/logger";

export const POST = withAuth<{ params: Promise<{ id: string }> }>(
    async (req, { params }, session) => {
        try {
            const { id } = (await params) as { id: string };
            const body = await req.json();
            const result = FlowShareSchema.safeParse(body);

            if (!result.success) {
                return NextResponse.json(
                    {
                        error: "Validation failed",
                        details: formatZodError(result.error),
                    },
                    { status: 400 },
                );
            }

            // We update the flow with sharing info.
            // Note: flowService.updateFlow handles permission check (only owner or editor can update).
            // However, for sharing, only OWNER should probably be allowed to change permissions.

            const flow = await flowService.getFlow(
                id,
                session.user!.id!,
                session.user!.email!,
            );
            if (flow.userId !== session.user!.id) {
                return NextResponse.json(
                    { error: "Only the owner can share the flow" },
                    { status: 403 },
                );
            }

            const updateData: {
                visibility?: "private" | "public" | "restricted";
                sharedWith?: { email: string; role: "view" | "edit" }[];
                sharedWithEmails?: string[];
            } = {
                visibility: result.data.visibility,
            };

            if (result.data.sharedWith) {
                updateData.sharedWith = result.data.sharedWith;
                updateData.sharedWithEmails = result.data.sharedWith.map(
                    (s) => s.email,
                );
            }

            const updatedFlow = await flowService.updateFlow(
                id,
                session.user!.id!,
                updateData,
                session.user!.email!,
            );

            return NextResponse.json(updatedFlow);
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Internal server error";
            logger.error("Error sharing flow:", error);
            return NextResponse.json({ error: message }, { status: 500 });
        }
    },
);
