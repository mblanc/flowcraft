import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isAuthorizedBucket, isAuthorizedGcsUri } from "@/lib/utils/gcs-uri";
import {
    AuthorizedGcsUriSchema,
    GetSignedUrlSchema,
} from "@/lib/schemas.server";
import {
    assertAuthorizedGcsUri,
    getSignedUrlFromGCS,
    gcsUriToSharp,
    gcsUriToBase64,
    getMimeTypeFromGCS,
    deleteFileByUri,
} from "@/lib/db/storage";
import { config } from "@/lib/config";

const { mockDownload, mockGetMetadata, mockDelete, mockBucket } = vi.hoisted(
    () => {
        const mockDownload = vi.fn();
        const mockGetSignedUrl = vi.fn();
        const mockGetMetadata = vi.fn();
        const mockDelete = vi.fn();
        const mockFile = vi.fn(() => ({
            download: mockDownload,
            getSignedUrl: mockGetSignedUrl,
            getMetadata: mockGetMetadata,
            delete: mockDelete,
        }));
        const mockBucket = vi.fn(() => ({
            file: mockFile,
        }));
        return {
            mockDownload,
            mockGetMetadata,
            mockDelete,
            mockBucket,
        };
    },
);

vi.mock("@google-cloud/storage", () => {
    return {
        Storage: vi.fn().mockImplementation(function () {
            return {
                bucket: mockBucket,
            };
        }),
    };
});

describe("GCS Bucket Authorization & SSRF Prevention", () => {
    const originalEnvBucket = process.env.GCS_STORAGE_URI;
    const originalConfigBucket = config.GCS_STORAGE_URI;
    const ALLOWED_BUCKET = "flowcraft-assets-demo";
    const ALLOWED_STORAGE_URI = `gs://${ALLOWED_BUCKET}/`;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.GCS_STORAGE_URI = ALLOWED_STORAGE_URI;
        (config as { GCS_STORAGE_URI?: string }).GCS_STORAGE_URI =
            ALLOWED_STORAGE_URI;
    });

    afterEach(() => {
        process.env.GCS_STORAGE_URI = originalEnvBucket;
        (config as { GCS_STORAGE_URI?: string }).GCS_STORAGE_URI =
            originalConfigBucket;
    });

    describe("gcs-uri utilities", () => {
        it("identifies authorized buckets correctly", () => {
            expect(
                isAuthorizedBucket(ALLOWED_BUCKET, ALLOWED_STORAGE_URI),
            ).toBe(true);
            expect(
                isAuthorizedBucket("other-bucket", ALLOWED_STORAGE_URI),
            ).toBe(false);
            expect(isAuthorizedBucket(ALLOWED_BUCKET, "")).toBe(false);
        });

        it("identifies authorized GCS URIs correctly", () => {
            expect(
                isAuthorizedGcsUri(
                    `gs://${ALLOWED_BUCKET}/user/file.png`,
                    ALLOWED_STORAGE_URI,
                ),
            ).toBe(true);
            expect(
                isAuthorizedGcsUri(
                    "gs://secret-backups/database.dump",
                    ALLOWED_STORAGE_URI,
                ),
            ).toBe(false);
            expect(
                isAuthorizedGcsUri("invalid-format", ALLOWED_STORAGE_URI),
            ).toBe(false);
        });
    });

    describe("schemas.server authorization validation", () => {
        it("accepts URIs pointing to the allowed bucket", () => {
            const validUri = `gs://${ALLOWED_BUCKET}/assets/img1.png`;
            const result = AuthorizedGcsUriSchema.safeParse(validUri);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe(validUri);
            }
        });

        it("rejects URIs pointing to unauthorized buckets", () => {
            const maliciousUri = "gs://corp-private-bucket/secrets.json";
            const result = AuthorizedGcsUriSchema.safeParse(maliciousUri);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain(
                    "unauthorized bucket",
                );
            }
        });

        it("GetSignedUrlSchema rejects unauthorized buckets", () => {
            const malicious = {
                gcsUri: "gs://corp-private-bucket/passwords.txt",
            };
            const result = GetSignedUrlSchema.safeParse(malicious);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain(
                    "unauthorized bucket",
                );
            }
        });
    });

    describe("storage.ts assertAuthorizedGcsUri defense-in-depth", () => {
        it("allows access to the authorized bucket", () => {
            const parsed = assertAuthorizedGcsUri(
                `gs://${ALLOWED_BUCKET}/file.png`,
            );
            expect(parsed.bucket).toBe(ALLOWED_BUCKET);
            expect(parsed.path).toBe("file.png");
        });

        it("throws an error when accessing an unauthorized bucket", () => {
            expect(() =>
                assertAuthorizedGcsUri("gs://unauthorized-bucket/file.png"),
            ).toThrow(/Unauthorized GCS bucket access/);
        });

        it("blocks getSignedUrlFromGCS for unauthorized buckets", async () => {
            await expect(
                getSignedUrlFromGCS("gs://unauthorized-bucket/file.png"),
            ).rejects.toThrow(/Unauthorized GCS bucket access/);
            expect(mockBucket).not.toHaveBeenCalled();
        });

        it("blocks gcsUriToSharp for unauthorized buckets", async () => {
            await expect(
                gcsUriToSharp("gs://unauthorized-bucket/image.png"),
            ).rejects.toThrow(/Unauthorized GCS bucket access/);
            expect(mockDownload).not.toHaveBeenCalled();
        });

        it("blocks gcsUriToBase64 for unauthorized buckets", async () => {
            await expect(
                gcsUriToBase64("gs://unauthorized-bucket/image.png"),
            ).rejects.toThrow(/Unauthorized GCS bucket access/);
            expect(mockDownload).not.toHaveBeenCalled();
        });

        it("blocks getMimeTypeFromGCS for unauthorized buckets", async () => {
            await expect(
                getMimeTypeFromGCS("gs://unauthorized-bucket/file.mp4"),
            ).rejects.toThrow(/Unauthorized GCS bucket access/);
            expect(mockGetMetadata).not.toHaveBeenCalled();
        });

        it("blocks deleteFileByUri for unauthorized buckets", async () => {
            await expect(
                deleteFileByUri("gs://unauthorized-bucket/file.mp4"),
            ).rejects.toThrow(/Unauthorized GCS bucket access/);
            expect(mockDelete).not.toHaveBeenCalled();
        });
    });
});
