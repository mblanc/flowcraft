import { describe, it, expect, vi } from "vitest";
import { validateAndParseGcsUri } from "@/lib/storage";

// Mock config to have a predictable allowed bucket
vi.mock("@/lib/config", () => ({
    config: {
        GCS_STORAGE_URI: "gs://allowed-bucket/",
    },
}));

describe("validateAndParseGcsUri", () => {
    it("should correctly parse a valid GCS URI in the allowed bucket", () => {
        const uri = "gs://allowed-bucket/path/to/file.png";
        const result = validateAndParseGcsUri(uri);
        expect(result).toEqual({
            bucketName: "allowed-bucket",
            fileName: "path/to/file.png",
        });
    });

    it("should throw an error for an invalid GCS URI format", () => {
        const uri = "https://example.com/file.png";
        expect(() => validateAndParseGcsUri(uri)).toThrow(
            "Invalid GCS URI format",
        );
    });

    it("should throw an error for a URI with missing bucket or file", () => {
        const uri = "gs://onlybucket";
        expect(() => validateAndParseGcsUri(uri)).toThrow(
            "Invalid GCS URI format",
        );
    });

    it("should throw an error for an unauthorized bucket", () => {
        const uri = "gs://malicious-bucket/file.png";
        expect(() => validateAndParseGcsUri(uri)).toThrow(
            "Unauthorized: GCS bucket not allowed",
        );
    });
});
