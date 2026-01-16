import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import logger from "@/app/logger";
import { withAuth } from "@/lib/api-utils";
import { storageService } from "@/lib/services/storage.service";

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

        const buffer = Buffer.from(await file.arrayBuffer());
        const extension = file.name.split(".").pop();
        const filename = `${uuidv4()}.${extension}`;
        const contentType = file.type;

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

        return NextResponse.json({ gcsUri, signedUrl, fileName: file.name });
    } catch (error) {
        logger.error("Error in upload-file route:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});
