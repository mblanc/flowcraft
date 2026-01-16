import { NextResponse } from "next/server";
import { withAuth, formatZodError } from "@/lib/api-utils";
import { ResizeImageSchema } from "@/lib/schemas";
import { storageService } from "@/lib/services/storage.service";
import logger from "@/app/logger";

export const POST = withAuth(async (_req) => {
    try {
        const body = await _req.json();
        const result = ResizeImageSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: formatZodError(result.error),
                },
                { status: 400 },
            );
        }

        const { image, aspectRatio } = result.data;

        let width, height;
        if (aspectRatio === "16:9") {
            width = 1920;
            height = 1080;
        } else if (aspectRatio === "9:16") {
            width = 1080;
            height = 1920;
        } else {
            return NextResponse.json(
                { error: "Invalid aspect ratio" },
                { status: 400 },
            );
        }

        const gcsUri = await storageService.resizeImage(image, width, height);

        if (!gcsUri) {
            return NextResponse.json(
                { error: "Failed to upload resized image" },
                { status: 500 },
            );
        }

        return NextResponse.json({ imageUrl: gcsUri });
    } catch (error) {
        logger.error("Error resizing image:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});
