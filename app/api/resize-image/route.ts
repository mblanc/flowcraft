import { NextResponse } from "next/server";
import { gcsUriToSharp, uploadFile } from "@/lib/storage";
import { v4 as uuidv4 } from "uuid";
import { withAuth, formatZodError } from "@/lib/api-utils";
import { ResizeImageSchema } from "@/lib/schemas";

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

        // Download and create sharp instance
        const sharpInstance = await gcsUriToSharp(image);

        // Resize using fill method
        const resizedBuffer = await sharpInstance
            .resize(width, height, { fit: "cover", position: "center" })
            .png()
            .toBuffer();

        // Upload to GCS
        const filename = `resized-${uuidv4()}.png`;
        const gcsUri = await uploadFile(resizedBuffer, filename, "image/png");

        if (!gcsUri) {
            return NextResponse.json(
                { error: "Failed to upload resized image" },
                { status: 500 },
            );
        }

        return NextResponse.json({ imageUrl: gcsUri });
    } catch (error) {
        console.error("Error resizing image:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});
