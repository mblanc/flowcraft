import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @google-cloud/storage using vi.hoisted to ensure mocks are defined before imports
const { mockBucket, mockFile, mockGetSignedUrl } = vi.hoisted(() => ({
    mockGetSignedUrl: vi.fn(),
    mockFile: vi.fn(() => ({
        getSignedUrl: vi.fn(),
    })),
    mockBucket: vi.fn(() => ({
        file: vi.fn(),
    })),
}));

vi.mock("@google-cloud/storage", () => {
    return {
        Storage: vi.fn().mockImplementation(function () {
            return {
                bucket: mockBucket,
            };
        }),
    };
});

// Mock config
vi.mock("@/lib/config", () => ({
    config: {
        PROJECT_ID: "test-project",
        GCS_STORAGE_URI: "gs://allowed-bucket",
    },
}));

import { getSignedUrlFromGCS, validateAndParseGcsUri } from "../lib/storage";

describe("GCS Storage Security", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Setup the mock chain
        mockBucket.mockImplementation(() => ({
            file: mockFile,
        }));
        mockFile.mockImplementation(() => ({
            getSignedUrl: mockGetSignedUrl,
        }));
    });

    it("should allow URIs from the allowed bucket", async () => {
        const validGcsUri = "gs://allowed-bucket/image.png";
        mockGetSignedUrl.mockResolvedValue([
            "https://signed-url.com/image.png",
        ]);

        const url = await getSignedUrlFromGCS(validGcsUri);

        expect(url).toBe("https://signed-url.com/image.png");
        expect(mockBucket).toHaveBeenCalledWith("allowed-bucket");
        expect(mockFile).toHaveBeenCalledWith("image.png");
    });

    it("should reject URIs from unauthorized buckets", async () => {
        const unauthorizedGcsUri = "gs://attacker-bucket/secret.json";

        await expect(getSignedUrlFromGCS(unauthorizedGcsUri)).rejects.toThrow(
            "Unauthorized bucket: attacker-bucket",
        );
        expect(mockBucket).not.toHaveBeenCalled();
    });

    it("should reject invalid GCS URI formats", async () => {
        const invalidUri =
            "https://storage.googleapis.com/allowed-bucket/image.png";

        await expect(getSignedUrlFromGCS(invalidUri)).rejects.toThrow(
            "Invalid GCS URI format",
        );
    });

    describe("validateAndParseGcsUri", () => {
        it("should parse valid URIs correctly", () => {
            const result = validateAndParseGcsUri(
                "gs://allowed-bucket/path/to/file.txt",
            );
            expect(result).toEqual({
                bucketName: "allowed-bucket",
                filePath: "path/to/file.txt",
            });
        });

        it("should throw for unauthorized buckets", () => {
            expect(() =>
                validateAndParseGcsUri("gs://other-bucket/file.txt"),
            ).toThrow("Unauthorized bucket");
        });

        it("should throw for invalid formats", () => {
            expect(() => validateAndParseGcsUri("not-a-gcs-uri")).toThrow(
                "Invalid GCS URI format",
            );
        });
    });
});
