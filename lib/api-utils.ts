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
