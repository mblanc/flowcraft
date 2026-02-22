import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateGcsUri } from "../lib/storage";
import logger from "../app/logger";

vi.mock("../lib/config", () => ({
    config: {
        GCS_STORAGE_URI: "gs://my-authorized-bucket/",
    },
}));

vi.mock("../app/logger", () => ({
    default: {
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
    },
}));

describe("validateGcsUri Security Tests", () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        vi.clearAllMocks();
    });

    it("should allow URIs from the authorized bucket in test environment (bypass)", () => {
        expect(() => validateGcsUri("gs://any-bucket/file")).not.toThrow();
    });

    it("should throw for unauthorized buckets when in production environment", () => {
        vi.stubEnv("NODE_ENV", "production");

        const unauthorizedUri = `gs://unauthorized-bucket/file`;

        expect(() => validateGcsUri(unauthorizedUri)).toThrow(
            /Unauthorized GCS bucket/,
        );
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("Security alert"),
        );
    });

    it("should NOT throw for authorized bucket even in production environment", () => {
        vi.stubEnv("NODE_ENV", "production");

        const authorizedUri = `gs://my-authorized-bucket/some-file.png`;

        expect(() => validateGcsUri(authorizedUri)).not.toThrow();
    });

    it("should handle non-gs:// URIs gracefully (no-op)", () => {
        vi.stubEnv("NODE_ENV", "production");
        expect(() => validateGcsUri("http://example.com/file")).not.toThrow();
        expect(() => validateGcsUri("data:image/png;base64,abc")).not.toThrow();
    });

    it("should handle null/undefined gracefully", () => {
        vi.stubEnv("NODE_ENV", "production");
        expect(() => validateGcsUri(null)).not.toThrow();
        expect(() => validateGcsUri(undefined)).not.toThrow();
    });
});
