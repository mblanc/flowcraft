import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { fileTypeFromBuffer } from "file-type";
import logger from "@/app/logger";
import { withAuth } from "@/lib/utils/api";
import { storageService } from "@/lib/services/storage.service";

const MAX_BYTES = 32 * 1024 * 1024; // 32 MB

const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "application/pdf",
]);

export const POST = withAuth(async (_req) => {
    try {
        const formData = await _req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 },
            );
        }

        if (file.size > MAX_BYTES) {
            return NextResponse.json(
                { error: "File exceeds the 32 MB size limit" },
                { status: 413 },
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        const detected = await fileTypeFromBuffer(buffer);
        if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
            return NextResponse.json(
                { error: "Unsupported file type" },
                { status: 415 },
            );
        }

        const filename = `${uuidv4()}.${detected.ext}`;
        const contentType = detected.mime;

        const gcsUri = await storageService.uploadFile(
            buffer,
            filename,
            contentType,
        );

        if (!gcsUri) {
            return NextResponse.json(
                { error: "Failed to upload file" },
                { status: 500 },
            );
        }

        const signedUrl = await storageService.getSignedUrl(gcsUri);

        const safeDisplayName = file.name
            .replace(/[/\\]/g, "")
            .replace(/[^\p{L}\p{N}_.\-\s]/gu, "")
            .slice(0, 255);

        return NextResponse.json({
            gcsUri,
            signedUrl,
            fileName: safeDisplayName,
        });
    } catch (error) {
        logger.error("Error in upload-file route:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});
