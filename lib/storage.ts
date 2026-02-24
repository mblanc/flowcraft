import { GetSignedUrlConfig, Storage } from "@google-cloud/storage";
import sharp from "sharp";
import logger from "@/app/logger";
import { config } from "./config";

// Initialize storage
const storage = new Storage({
    projectId: config.PROJECT_ID,
    // keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS, // Uncomment if needed
});

const storageUri = config.GCS_STORAGE_URI; // Make sure this env var is set
const authorizedBucketName = storageUri?.startsWith("gs://")
    ? storageUri.substring(5).split("/")[0]
    : storageUri?.split("/")[0];

/**
 * Validates that a GCS URI belongs to the authorized bucket.
 * Throws an error if validation fails.
 */
export function validateGcsUri(gcsUri: string): void {
    validateAndParseGcsUri(gcsUri);
}

/**
 * Validates that a GCS URI belongs to the authorized bucket and returns the parsed bucket and path.
 */
export function validateAndParseGcsUri(gcsUri: string): {
    bucket: string;
    path: string;
} {
    const match = gcsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/);
    if (!match) {
        throw new Error(`Invalid GCS URI format: ${gcsUri}`);
    }
    const requestedBucket = match[1];
    const path = match[2];

    if (!authorizedBucketName) {
        if (process.env.NODE_ENV === "test") {
            return { bucket: requestedBucket, path };
        }
        throw new Error("GCS_STORAGE_URI is not configured");
    }

    if (authorizedBucketName !== requestedBucket) {
        if (
            process.env.NODE_ENV === "test" &&
            process.env.STRICT_GCS_VALIDATION !== "true"
        ) {
            logger.warn(
                `[SECURITY] Bypassing strict GCS validation in test mode for bucket: ${requestedBucket}`,
            );
            return { bucket: requestedBucket, path };
        }
        logger.error(
            `[SECURITY] Unauthorized GCS bucket access attempt: ${requestedBucket}. Authorized: ${authorizedBucketName}`,
        );
        throw new Error(`Unauthorized GCS bucket access: ${requestedBucket}`);
    }

    return { bucket: requestedBucket, path };
}

export async function uploadImage(
    base64: string,
    filename: string,
): Promise<string | null> {
    if (!storageUri) {
        logger.error("GCS_STORAGE_URI environment variable is not set.");
        return null;
    }
    if (!base64) {
        logger.warn("Attempted to upload an empty base64 string.");
        return null;
    }

    try {
        const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
        const buffer = Buffer.from(base64Data, "base64");
        const bucketName = authorizedBucketName;

        if (!bucketName) {
            logger.error(
                `Could not extract bucket name from STORAGE_URI: ${storageUri}`,
            );
            return null;
        }

        const bucket = storage.bucket(bucketName);
        const file = bucket.file(filename);
        const contentType = "data:image/png";

        await file.save(buffer, {
            metadata: { contentType: contentType },
            public: false,
        });

        const gcsUri = `gs://${bucketName}/${filename}`;
        logger.debug(`Successfully uploaded ${filename} to ${gcsUri}`);
        return gcsUri;
    } catch (error) {
        logger.error(`Failed to upload image ${filename} to GCS:`, error);
        return null;
    }
}

export async function getSignedUrlFromGCS(
    gcsUri: string,
    download: boolean = false,
) {
    const { bucket: bucketName, path: fileName } =
        validateAndParseGcsUri(gcsUri);
    const options: GetSignedUrlConfig = {
        version: "v4",
        action: "read",
        expires: Date.now() + 60 * 60 * 1000,
    };

    if (download) {
        options.responseDisposition = "attachment";
    }

    const [url] = await storage
        .bucket(bucketName)
        .file(fileName)
        .getSignedUrl(options);
    return url;
}

export async function gcsUriToSharp(gcsUri: string): Promise<sharp.Sharp> {
    try {
        const { bucket: bucketName, path: filePath } =
            validateAndParseGcsUri(gcsUri);

        logger.debug(`Downloading image from gs://${bucketName}/${filePath}`);
        const [buffer] = await storage
            .bucket(bucketName)
            .file(filePath)
            .download();
        logger.debug(`Image downloaded successfully (${buffer.length} bytes)`);

        return sharp(buffer);
    } catch (error) {
        logger.error(`Error processing image from GCS URI ${gcsUri}:`, error);
        throw error;
    }
}

export async function gcsUriToBase64(gcsUri: string): Promise<string> {
    try {
        const { bucket: bucketName, path: filePath } =
            validateAndParseGcsUri(gcsUri);

        logger.debug(
            `Downloading image for base64 conversion from gs://${bucketName}/${filePath}`,
        );
        const [buffer] = await storage
            .bucket(bucketName)
            .file(filePath)
            .download();
        logger.debug(`Image downloaded successfully (${buffer.length} bytes)`);

        const base64Data = buffer.toString("base64");
        return base64Data;
    } catch (error) {
        logger.error(`Error converting GCS URI ${gcsUri} to base64:`, error);
        throw error;
    }
}

export async function getMimeTypeFromGCS(
    gcsUri: string,
): Promise<string | null> {
    const { bucket: bucketName, path: fileName } =
        validateAndParseGcsUri(gcsUri);
    const [metadata] = await storage
        .bucket(bucketName)
        .file(fileName)
        .getMetadata();
    return metadata.contentType || null;
}

export async function uploadFile(
    buffer: Buffer,
    filename: string,
    contentType: string,
): Promise<string | null> {
    if (!storageUri) {
        logger.error("GCS_STORAGE_URI environment variable is not set.");
        return null;
    }

    try {
        const bucketName = authorizedBucketName;
        if (!bucketName) {
            logger.error(
                `Could not extract bucket name from STORAGE_URI: ${storageUri}`,
            );
            return null;
        }

        const bucket = storage.bucket(bucketName);
        const file = bucket.file(filename);

        await file.save(buffer, {
            metadata: { contentType: contentType },
            public: false,
        });

        const gcsUri = `gs://${bucketName}/${filename}`;
        logger.debug(`Successfully uploaded ${filename} to ${gcsUri}`);
        return gcsUri;
    } catch (error) {
        logger.error(`Failed to upload file ${filename} to GCS:`, error);
        return null;
    }
}
