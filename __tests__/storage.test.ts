import { describe, it, expect, vi } from "vitest";
import { validateAndParseGcsUri } from "../lib/storage";

// Mock dependencies
vi.mock("../lib/config", () => ({
    config: {
        GCS_STORAGE_URI: "gs://allowed-bucket/",
        PROJECT_ID: "test-project",
    },
}));

vi.mock("@/app/logger", () => ({
    default: {
        error: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

// Mock @google-cloud/storage to prevent initialization errors
vi.mock("@google-cloud/storage", () => ({
    Storage: class {
        bucket = vi.fn();
    },
}));

describe("GCS URI Validation", () => {
    it("should allow URIs from the configured bucket", () => {
        const gcsUri = "gs://allowed-bucket/file.png";
        const result = validateAndParseGcsUri(gcsUri);
        expect(result).toEqual({
            bucketName: "allowed-bucket",
            filePath: "file.png",
        });
    });

    it("should allow URIs with nested paths from the configured bucket", () => {
        const gcsUri = "gs://allowed-bucket/nested/path/file.png";
        const result = validateAndParseGcsUri(gcsUri);
        expect(result).toEqual({
            bucketName: "allowed-bucket",
            filePath: "nested/path/file.png",
        });
    });

    it("should reject URIs from a different bucket", () => {
        const gcsUri = "gs://malicious-bucket/file.png";
        expect(() => validateAndParseGcsUri(gcsUri)).toThrow(
            "Unauthorized bucket access.",
        );
    });

    it("should reject malformed URIs", () => {
        const gcsUri = "https://storage.googleapis.com/allowed-bucket/file.png";
        expect(() => validateAndParseGcsUri(gcsUri)).toThrow(
            /Invalid GCS URI format/i,
        );
    });

    it("should reject URIs with empty paths", () => {
        const gcsUri = "gs://allowed-bucket/";
        expect(() => validateAndParseGcsUri(gcsUri)).toThrow(
            /Invalid GCS URI format/i,
        );
    });
});
