import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { libraryService } from "@/lib/services/library.service";
import logger from "@/app/logger";

export const GET = withAuth<{ params: Promise<{ id: string }> }>(
    async (_req, { params }, session) => {
        const { id } = await params;
        try {
            const asset = await libraryService.getAsset(id, session.user!.id!);
            if (!asset) {
                return NextResponse.json(
                    { error: "Not found" },
                    { status: 404 },
                );
            }
            return NextResponse.json(asset);
        } catch (error) {
            logger.error("Error fetching library asset:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
        }
    },
);

export const PATCH = withAuth<{ params: Promise<{ id: string }> }>(
    async (req, { params }, session) => {
        const { id } = await params;
        try {
            const body = await req.json();

            if (!Array.isArray(body.tags)) {
                return NextResponse.json(
                    { error: "tags must be an array" },
                    { status: 400 },
                );
            }

            await libraryService.updateTags(id, session.user!.id!, body.tags);
            return NextResponse.json({ success: true });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === "Asset not found") {
                    return NextResponse.json(
                        { error: error.message },
                        { status: 404 },
                    );
                }
                if (error.message === "Unauthorized") {
                    return NextResponse.json(
                        { error: error.message },
                        { status: 403 },
                    );
                }
            }
            logger.error("Error updating library asset tags:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
        }
    },
);

export const DELETE = withAuth<{ params: Promise<{ id: string }> }>(
    async (_req, { params }, session) => {
        const { id } = await params;
        try {
            await libraryService.deleteAsset(id, session.user!.id!);
            return NextResponse.json({ success: true });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === "Asset not found") {
                    return NextResponse.json(
                        { error: error.message },
                        { status: 404 },
                    );
                }
                if (error.message === "Unauthorized") {
                    return NextResponse.json(
                        { error: error.message },
                        { status: 403 },
                    );
                }
            }
            logger.error("Error deleting library asset:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
        }
    },
);
