import { z } from "zod";
import {
    extractBucketFromStorageUri,
    isAuthorizedBucket,
    isAuthorizedGcsUri,
} from "./utils/gcs-uri";
import { config } from "./config";

function getAllowedStorageUri(): string {
    return config.GCS_STORAGE_URI || process.env.GCS_STORAGE_URI || "";
}

export function getAllowedStorageBucket(): string {
    return extractBucketFromStorageUri(getAllowedStorageUri());
}

export function isAuthorizedGcsBucket(bucket: string): boolean {
    return isAuthorizedBucket(bucket, getAllowedStorageUri());
}

export const AuthorizedGcsUriSchema = z
    .string()
    .min(1, "gcsUri is required")
    .refine((uri) => isAuthorizedGcsUri(uri, getAllowedStorageUri()), {
        message: "gcsUri refers to an unauthorized bucket",
    });

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
