export interface ParsedGcsUri {
    bucket: string;
    path: string;
}

export function isGcsUri(value: string | null | undefined): value is string {
    return typeof value === "string" && value.startsWith("gs://");
}

export function parseGcsUri(gcsUri: string): ParsedGcsUri {
    const match = gcsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/);
    if (!match) {
        throw new Error(`Invalid GCS URI format: ${gcsUri}`);
    }

    return {
        bucket: match[1],
        path: match[2],
    };
}

export function extractBucketFromStorageUri(storageUri: string): string {
    if (storageUri.startsWith("gs://")) {
        const withoutScheme = storageUri.slice(5);
        return withoutScheme.split("/")[0] ?? "";
    }
    return storageUri.split("/")[0] ?? "";
}

export function isAuthorizedBucket(
    bucket: string,
    allowedStorageUri: string,
): boolean {
    const allowedBucket = extractBucketFromStorageUri(allowedStorageUri);
    return Boolean(allowedBucket && bucket === allowedBucket);
}

export function isAuthorizedGcsUri(
    gcsUri: string,
    allowedStorageUri: string,
): boolean {
    try {
        const { bucket } = parseGcsUri(gcsUri);
        return isAuthorizedBucket(bucket, allowedStorageUri);
    } catch {
        return false;
    }
}
