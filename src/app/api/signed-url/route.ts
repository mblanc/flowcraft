import { NextResponse } from "next/server";
import { withAuth, formatZodError } from "@/lib/utils/api";
import {
    GetSignedUrlSchema,
    BatchGetSignedUrlsSchema,
} from "@/lib/schemas.server";
import { storageService } from "@/lib/services/storage.service";
import logger from "@/app/logger";

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
        const signedUrl = await storageService.getSignedUrl(gcsUri);
        return NextResponse.json(
            { signedUrl },
            {
                headers: {
                    "Cache-Control": "no-store, private",
                },
            },
        );
    } catch (error) {
        logger.error("Error generating signed URL:", error);
        return NextResponse.json(
            { error: "Failed to generate signed URL" },
            { status: 500 },
        );
    }
});

export const POST = withAuth(async (req) => {
    let body;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 },
        );
    }

    const result = BatchGetSignedUrlsSchema.safeParse(body);
    if (!result.success) {
        return NextResponse.json(
            {
                error: "Validation failed",
                details: formatZodError(result.error),
            },
            { status: 400 },
        );
    }

    const { gcsUris } = result.data;

    try {
        const uniqueUris = Array.from(new Set(gcsUris));
        const entries = await Promise.all(
            uniqueUris.map(async (uri) => {
                const url = await storageService.getSignedUrl(uri);
                return [uri, url] as const;
            }),
        );
        const signedUrls: Record<string, string> = Object.fromEntries(entries);
        return NextResponse.json(
            { signedUrls },
            {
                headers: {
                    "Cache-Control": "no-store, private",
                },
            },
        );
    } catch (error) {
        logger.error("Error generating batch signed URLs:", error);
        return NextResponse.json(
            { error: "Failed to generate batch signed URLs" },
            { status: 500 },
        );
    }
});
