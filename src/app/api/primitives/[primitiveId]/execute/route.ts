import { NextResponse } from "next/server";
import { withAuth } from "@/lib/utils/api";
import { serverRegistry as registry } from "@/primitives/server-registry";

export const POST = withAuth<{ params: Promise<{ primitiveId: string }> }>(
    async (req, context, session) => {
        const params = await context.params;
        const { primitiveId } = params;

        const primitive = registry.get(primitiveId);
        if (!primitive || !primitive.execute) {
            return NextResponse.json(
                { error: "Primitive not found or not executable" },
                { status: 404 },
            );
        }

        let body;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON body" },
                { status: 400 },
            );
        }

        if (primitive.requestSchema) {
            const parsed = primitive.requestSchema.safeParse(body);
            if (!parsed.success) {
                return NextResponse.json(
                    {
                        error: "Validation failed",
                        details: parsed.error.format(),
                    },
                    { status: 400 },
                );
            }
            body = parsed.data;
        }

        try {
            const userId = session.user!.id!;
            const result = await primitive.execute(body, { userId });
            return NextResponse.json(result);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Execution failed";
            return NextResponse.json({ error: message }, { status: 500 });
        }
    },
);
