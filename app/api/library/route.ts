import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { libraryService } from "@/lib/services/library.service";
import logger from "@/app/logger";
import type { LibraryAssetType } from "@/lib/library-types";

export const GET = withAuth(async (req, _context, session) => {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type") as LibraryAssetType | null;
        const beforeParam = searchParams.get("before");
        const limitParam = searchParams.get("limit");
        const before = beforeParam ? new Date(beforeParam) : undefined;
        const limit = limitParam ? parseInt(limitParam, 10) : undefined;
        const assets = await libraryService.listAssets(
            session.user!.id!,
            type ?? undefined,
            { before, limit },
        );
        return NextResponse.json({ assets });
    } catch (error) {
        logger.error("Error fetching library assets:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});

export const POST = withAuth(async (req, _context, session) => {
    try {
        const body = await req.json();

        if (!body.gcsUri || !body.type || !body.mimeType || !body.provenance) {
            return NextResponse.json(
                {
                    error: "gcsUri, type, mimeType, and provenance are required",
                },
                { status: 400 },
            );
        }

        const asset = await libraryService.createAsset({
            userId: session.user!.id!,
            type: body.type,
            gcsUri: body.gcsUri,
            mimeType: body.mimeType,
            width: body.width,
            height: body.height,
            duration: body.duration,
            aspectRatio: body.aspectRatio,
            model: body.model,
            tags: body.tags ?? [],
            provenance: body.provenance,
        });

        return NextResponse.json(asset);
    } catch (error) {
        logger.error("Error creating library asset:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});
