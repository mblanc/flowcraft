import { z } from "zod";
import { parseGcsUri, extractBucketFromStorageUri } from "./utils/gcs-uri";
import { config } from "./config";

export const GetSignedUrlSchema = z.object({
    gcsUri: z
        .string()
        .min(1, "gcsUri is required")
        .refine(
            (uri) => {
                try {
                    const allowedBucket = extractBucketFromStorageUri(
                        config.GCS_STORAGE_URI,
                    );
                    return parseGcsUri(uri).bucket === allowedBucket;
                } catch {
                    return false;
                }
            },
            { message: "gcsUri refers to an unauthorized bucket" },
        ),
});

export type GetSignedUrlRequest = z.infer<typeof GetSignedUrlSchema>;
