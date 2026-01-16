import { NextResponse } from "next/server";
import { getSignedUrlFromGCS } from "@/lib/storage";
import { withAuth } from "@/lib/api-utils";

export const GET = withAuth(async (_req) => {
    const { searchParams } = new URL(_req.url);
    const gcsUri = searchParams.get("gcsUri");

    if (!gcsUri) {
        return NextResponse.json(
            { error: "Missing gcsUri parameter" },
            { status: 400 },
        );
    }

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
