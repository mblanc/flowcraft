import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @google-cloud/storage
vi.mock("@google-cloud/storage", () => {
    const mockFile = {
        getSignedUrl: vi.fn().mockResolvedValue(["https://signed-url.com"]),
        download: vi.fn().mockResolvedValue([Buffer.from("fake-image-data")]),
        getMetadata: vi.fn().mockResolvedValue([{ contentType: "image/png" }]),
    };
    const mockBucket = {
        file: vi.fn().mockReturnValue(mockFile),
    };
    return {
        Storage: vi.fn().mockImplementation(function(this: any) {
            this.bucket = vi.fn().mockReturnValue(mockBucket);
        })
    };
});

vi.mock("../lib/config", () => ({
    config: {
        GCS_STORAGE_URI: "gs://authorized-bucket/",
        PROJECT_ID: "test-project",
    },
}));

// Import after mocks
import { getSignedUrlFromGCS } from "../lib/storage";

describe("GCS URI Security", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("STRICT_GCS_VALIDATION", "true");
    });

    it("should allow access to authorized bucket", async () => {
        const url = await getSignedUrlFromGCS("gs://authorized-bucket/file.png");
        expect(url).toBe("https://signed-url.com");
    });

    it("should NOT allow access to unauthorized bucket", async () => {
        await expect(
            getSignedUrlFromGCS("gs://unauthorized-bucket/file.png"),
        ).rejects.toThrow("Unauthorized GCS bucket access: unauthorized-bucket");
    });
});
