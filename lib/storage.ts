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

/**
 * Validates a GCS URI and ensures it belongs to the allowed bucket.
 * Extracts the bucket name and file path if valid.
 *
 * @param gcsUri The GCS URI to validate (e.g., "gs://bucket/path/to/file").
 * @returns An object containing the bucket name and file path.
 * @throws Error if the URI is invalid or the bucket is not allowed.
 */
export function validateAndParseGcsUri(gcsUri: string): {
    bucketName: string;
    filePath: string;
} {
    const match = gcsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/);
    if (!match) {
        throw new Error(`Invalid GCS URI format: ${gcsUri}`);
    }

    const bucketName = match[1];
    const filePath = match[2];

    // Get the allowed bucket name from the storage URI config
    const allowedBucket = config.GCS_STORAGE_URI.startsWith("gs://")
        ? config.GCS_STORAGE_URI.substring(5).split("/")[0]
        : config.GCS_STORAGE_URI.split("/")[0];

    if (bucketName !== allowedBucket) {
        logger.warn(
            `Unauthorized bucket access attempt: ${bucketName} (expected ${allowedBucket})`,
        );
        throw new Error(`Unauthorized bucket: ${bucketName}`);
    }

    return { bucketName, filePath };
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

        const bucketName = storageUri.startsWith("gs://")
            ? storageUri.substring(5).split("/")[0]
            : storageUri.split("/")[0];

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
            metadata: {
                contentType: contentType,
            },
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
    const { bucketName, filePath } = validateAndParseGcsUri(gcsUri);

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
        .file(filePath)
        .getSignedUrl(options);
    return url;
}

/**
 * Downloads an image from a GCS URI and returns a sharp object.
 */
export async function gcsUriToSharp(gcsUri: string): Promise<sharp.Sharp> {
    try {
        const { bucketName, filePath } = validateAndParseGcsUri(gcsUri);

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

/**
 * Downloads an image from a GCS URI and returns its base64 encoded string.
 */
export async function gcsUriToBase64(gcsUri: string): Promise<string> {
    try {
        const { bucketName, filePath } = validateAndParseGcsUri(gcsUri);

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
    const { bucketName, filePath } = validateAndParseGcsUri(gcsUri);

    const [metadata] = await storage
        .bucket(bucketName)
        .file(filePath)
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
        const bucketName = storageUri.startsWith("gs://")
            ? storageUri.substring(5).split("/")[0]
            : storageUri.split("/")[0];

        if (!bucketName) {
            logger.error(
                `Could not extract bucket name from STORAGE_URI: ${storageUri}`,
            );
            return null;
        }

        const bucket = storage.bucket(bucketName);
        const file = bucket.file(filename);

        await file.save(buffer, {
            metadata: {
                contentType: contentType,
            },
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
