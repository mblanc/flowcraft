import logger from "@/app/logger";
import { auth } from "@/auth";
import { NextResponse, NextRequest } from "next/server";
import { Session } from "next-auth";
import { ZodError } from "zod";

export type AuthenticatedHandler<T = unknown> = (
    req: NextRequest,
    context: T,
    session: Session,
) => Promise<NextResponse> | NextResponse;

export function withAuth<T = unknown>(handler: AuthenticatedHandler<T>) {
    return async (req: NextRequest, context: T) => {
        try {
            const session = await auth();
            if (!session?.user?.id) {
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 401 },
                );
            }
            return handler(req, context, session);
        } catch (error) {
            logger.error("Auth error:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
        }
    };
}

export function formatZodError(error: ZodError) {
    return error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
    }));
}

export function handleApiError(error: unknown, fallbackMessage: string) {
    logger.error(`[SERVER] ${fallbackMessage}:`, error);

    let status = 500;
    let errorMessage = fallbackMessage;

    if (error instanceof Error) {
        errorMessage = error.message;
        if (
            errorMessage.includes("429") ||
            errorMessage.includes("Quota") ||
            ("status" in error && (error as { status: number }).status === 429)
        ) {
            status = 429;
        }
    } else if (
        typeof error === "object" &&
        error !== null &&
        "status" in error
    ) {
        if ((error as { status: number }).status === 429) {
            status = 429;
        }
    }

    return NextResponse.json(
        {
            error: errorMessage,
            details: error instanceof Error ? error.message : String(error),
        },
        { status },
    );
}
