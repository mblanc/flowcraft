import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateGcsUri } from "../lib/storage";
import { GetSignedUrlSchema } from "../lib/schemas";

// Mock config
vi.mock("../lib/config", () => ({
    config: {
        GCS_STORAGE_URI: "gs://my-allowed-bucket/",
    },
}));

describe("GCS URI Validation", () => {
    beforeEach(() => {
        vi.stubEnv("NODE_ENV", "production");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("should allow URIs from the configured bucket", () => {
        expect(validateGcsUri("gs://my-allowed-bucket/file.png")).toBe(true);
        expect(
            validateGcsUri("gs://my-allowed-bucket/sub/folder/file.png"),
        ).toBe(true);
    });

    it("should reject URIs from a different bucket", () => {
        expect(validateGcsUri("gs://other-bucket/file.png")).toBe(false);
    });

    it("should reject malformed URIs", () => {
        expect(validateGcsUri("http://example.com/file.png")).toBe(false);
        expect(validateGcsUri("s3://bucket/file.png")).toBe(false);
        expect(validateGcsUri("gs://")).toBe(false);
        expect(validateGcsUri("")).toBe(false);
        expect(validateGcsUri(null as unknown as string)).toBe(false);
    });

    it("should allow anything when NODE_ENV is test", () => {
        vi.stubEnv("NODE_ENV", "test");
        expect(validateGcsUri("gs://any-bucket/file.png")).toBe(true);
    });
});

describe("GetSignedUrlSchema Validation", () => {
    beforeEach(() => {
        vi.stubEnv("NODE_ENV", "production");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("should validate a valid GCS URI", () => {
        const result = GetSignedUrlSchema.safeParse({
            gcsUri: "gs://my-allowed-bucket/file.png",
        });
        expect(result.success).toBe(true);
    });

    it("should fail for an unauthorized GCS URI", () => {
        const result = GetSignedUrlSchema.safeParse({
            gcsUri: "gs://evil-bucket/file.png",
        });
        if (result.success) {
            throw new Error("Validation should have failed");
        }
        expect(result.error.issues[0].message).toBe(
            "Unauthorized or invalid GCS URI",
        );
    });
});
