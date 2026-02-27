import { describe, it, expect, vi } from "vitest";
import { getSignedUrlFromGCS } from "../lib/storage";

// Mock the storage client
vi.mock("@google-cloud/storage", () => {
    return {
        Storage: vi.fn().mockImplementation(function () {
            return {
                bucket: vi.fn().mockReturnValue({
                    file: vi.fn().mockReturnValue({
                        getSignedUrl: vi
                            .fn()
                            .mockResolvedValue(["http://signed-url"]),
                        download: vi
                            .fn()
                            .mockResolvedValue([Buffer.from("test")]),
                        getMetadata: vi
                            .fn()
                            .mockResolvedValue([{ contentType: "image/png" }]),
                    }),
                }),
            };
        }),
    };
});

// Mock the config
vi.mock("../lib/config", () => ({
    config: {
        GCS_STORAGE_URI: "gs://my-app-bucket/",
        PROJECT_ID: "test-project",
    },
}));

describe("GCS Storage Security", () => {
    it("should allow access to the configured bucket", async () => {
        const gcsUri = "gs://my-app-bucket/some-file.png";
        const url = await getSignedUrlFromGCS(gcsUri);
        expect(url).toBe("http://signed-url");
    });

    it("should NOT allow access to a different bucket (Security Fixed)", async () => {
        const maliciousGcsUri = "gs://attacker-bucket/secret-file.txt";

        // After fix, this should throw an "Unauthorized bucket access" error
        await expect(getSignedUrlFromGCS(maliciousGcsUri)).rejects.toThrow(
            "Unauthorized bucket access",
        );
    });

    it("should NOT allow invalid GCS URIs", async () => {
        const invalidGcsUri = "https://example.com/file.png";
        await expect(getSignedUrlFromGCS(invalidGcsUri)).rejects.toThrow(
            "Invalid GCS URI format",
        );
    });
});
