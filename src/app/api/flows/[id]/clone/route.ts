import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { flowService } from "@/lib/services/flow.service";
import logger from "@/app/logger";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const clonedFlow = await flowService.cloneFlow(
            id,
            session.user.id,
            session.user.email || undefined,
        );
        return NextResponse.json(clonedFlow);
    } catch (error) {
        logger.error(`Error cloning flow ${id}:`, error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to clone flow",
            },
            { status: 500 },
        );
    }
}
