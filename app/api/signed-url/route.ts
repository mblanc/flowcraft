import { NextResponse } from "next/server";
import { getSignedUrlFromGCS } from "@/lib/storage";
import { withAuth, formatZodError } from "@/lib/api-utils";
import { GetSignedUrlSchema } from "@/lib/schemas";

export const GET = withAuth(async (_req) => {
    const { searchParams } = new URL(_req.url);
    const params = Object.fromEntries(searchParams.entries());
    const result = GetSignedUrlSchema.safeParse(params);

    if (!result.success) {
        return NextResponse.json(
            {
                error: "Validation failed",
                details: formatZodError(result.error),
            },
            { status: 400 },
        );
    }

    const { gcsUri } = result.data;

    try {
        const signedUrl = await getSignedUrlFromGCS(gcsUri);
        return NextResponse.json({ signedUrl });
    } catch (error) {
        console.error("Error generating signed URL:", error);
        return NextResponse.json(
            { error: "Failed to generate signed URL" },
            { status: 500 },
        );
    }
});
