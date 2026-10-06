import { z } from "zod";
import { parseGcsUri, extractBucketFromStorageUri } from "./utils/gcs-uri";
import { config } from "./config";

export function getAllowedStorageBucket(): string {
    const uri = config.GCS_STORAGE_URI || process.env.GCS_STORAGE_URI || "";
    return extractBucketFromStorageUri(uri);
}

export function isAuthorizedGcsBucket(bucket: string): boolean {
    const allowed = getAllowedStorageBucket();
    return Boolean(allowed && bucket === allowed);
}

export const AuthorizedGcsUriSchema = z
    .string()
    .min(1, "gcsUri is required")
    .refine(
        (uri) => {
            try {
                const { bucket } = parseGcsUri(uri);
                return isAuthorizedGcsBucket(bucket);
            } catch {
                return false;
            }
        },
        { message: "gcsUri refers to an unauthorized bucket" },
    );

export const GetSignedUrlSchema = z.object({
    gcsUri: AuthorizedGcsUriSchema,
});

export type GetSignedUrlRequest = z.infer<typeof GetSignedUrlSchema>;

export const BatchGetSignedUrlsSchema = z.object({
    gcsUris: z.array(AuthorizedGcsUriSchema).min(1).max(100),
});

export type BatchGetSignedUrlsRequest = z.infer<
    typeof BatchGetSignedUrlsSchema
>;
