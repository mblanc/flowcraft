import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-utils";
import { libraryService } from "@/lib/services/library.service";
import logger from "@/app/logger";
import type { LibraryAssetType } from "@/lib/library-types";

const createAssetSchema = z.object({
    gcsUri: z.string().min(1),
    type: z.enum(["image", "video"]),
    mimeType: z.string().min(1),
    width: z.number().optional(),
    height: z.number().optional(),
    duration: z.number().optional(),
    aspectRatio: z.string().optional(),
    model: z.string().optional(),
    tags: z.array(z.string()).default([]),
    provenance: z.object({
        sourceType: z.enum(["flow", "canvas"]),
        sourceId: z.string().min(1),
        sourceName: z.string().min(1),
        nodeId: z.string().optional(),
        nodeLabel: z.string().optional(),
        prompt: z.string().optional(),
        mediaInputs: z
            .array(
                z.object({
                    url: z.string(),
                    mimeType: z.string().optional(),
                }),
            )
            .optional(),
    }),
});

export const GET = withAuth(async (req, _context, session) => {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type") as LibraryAssetType | null;
        const beforeParam = searchParams.get("before");
        const limitParam = searchParams.get("limit");
        let before: Date | undefined;
        if (beforeParam) {
            const parsed = new Date(beforeParam);
            if (isNaN(parsed.getTime())) {
                return NextResponse.json(
                    { error: "Invalid 'before' date parameter" },
                    { status: 400 },
                );
            }
            before = parsed;
        }
        const limitRaw = limitParam ? parseInt(limitParam, 10) : undefined;
        const limit =
            limitRaw !== undefined && isNaN(limitRaw) ? undefined : limitRaw;
        const search = searchParams.get("search") ?? undefined;
        const assets = await libraryService.listAssets(
            session.user!.id!,
            type ?? undefined,
            { before, limit, search },
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
        const parseResult = createAssetSchema.safeParse(await req.json());
        if (!parseResult.success) {
            return NextResponse.json(
                { error: parseResult.error.flatten() },
                { status: 400 },
            );
        }
        const body = parseResult.data;

        const asset = await libraryService.createAsset({
            userId: session.user!.id!,
            ...body,
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
