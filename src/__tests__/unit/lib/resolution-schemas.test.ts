import { describe, it, expect } from "vitest";
import {
    GenerateImageSchema,
    GenerateVideoSchema,
    VideoDataSchema,
} from "@/lib/schemas";

describe("Resolution Schemas", () => {
    describe("GenerateImageSchema", () => {
        it("should accept valid image sizes", () => {
            const result = GenerateImageSchema.safeParse({
                prompt: "test",
                imageSize: "1K",
            });
            expect(result.success).toBe(true);
        });

        it("should reject video resolution values as image size", () => {
            const result = GenerateImageSchema.safeParse({
                prompt: "test",
                imageSize: "720p",
            });
            expect(result.success).toBe(false);
        });

        it("should accept 4K image size", () => {
            const result = GenerateImageSchema.safeParse({
                prompt: "test",
                imageSize: "4K",
            });
            expect(result.success).toBe(true);
        });
    });

    describe("GenerateVideoSchema", () => {
        it("should accept valid video resolutions", () => {
            const result = GenerateVideoSchema.safeParse({
                prompt: "test",
                resolution: "1080p",
            });
            expect(result.success).toBe(true);
        });

        it("should accept 4K video resolution", () => {
            const result = GenerateVideoSchema.safeParse({
                prompt: "test",
                resolution: "4K",
            });
            expect(result.success).toBe(true);
        });

        it("should reject invalid video resolutions", () => {
            const result = GenerateVideoSchema.safeParse({
                prompt: "test",
                resolution: "512",
            });
            expect(result.success).toBe(false);
        });

        it("should accept 360p video resolution", () => {
            const result = GenerateVideoSchema.safeParse({
                prompt: "test",
                resolution: "360p",
            });
            expect(result.success).toBe(true);
        });

        it("should default to gemini-omni-1.1-flash-preview", () => {
            const result = GenerateVideoSchema.safeParse({
                prompt: "test",
            });
            expect(result.success).toBe(true);
            expect(result.data?.model).toBe("gemini-omni-1.1-flash-preview");
        });

        it("should accept gemini-omni-flash-preview as model", () => {
            const result = GenerateVideoSchema.safeParse({
                prompt: "test",
                model: "gemini-omni-flash-preview",
            });
            expect(result.success).toBe(true);
        });

        it("should accept gemini-omni-1.1-flash-preview as model", () => {
            const result = GenerateVideoSchema.safeParse({
                prompt: "test",
                model: "gemini-omni-1.1-flash-preview",
            });
            expect(result.success).toBe(true);
        });

        it("should migrate gemini-omni-1.1-flash alias to gemini-omni-1.1-flash-preview", () => {
            const result = GenerateVideoSchema.safeParse({
                prompt: "test",
                model: "gemini-omni-1.1-flash",
            });
            expect(result.success).toBe(true);
            expect(result.data?.model).toBe("gemini-omni-1.1-flash-preview");
        });

        it("should migrate gemini-omni-flash alias to gemini-omni-flash-preview", () => {
            const result = GenerateVideoSchema.safeParse({
                prompt: "test",
                model: "gemini-omni-flash",
            });
            expect(result.success).toBe(true);
            expect(result.data?.model).toBe("gemini-omni-flash-preview");
        });
    });

    describe("VideoDataSchema resolution handling", () => {
        const baseData = {
            type: "video",
            name: "Test Video",
            prompt: "test",
            images: [],
            aspectRatio: "16:9",
            duration: 6,
            model: "gemini-omni-1.1-flash-preview",
            generateAudio: true,
        };

        it("should accept valid video resolutions (360p, 720p, 1080p, 4K)", () => {
            for (const res of ["360p", "720p", "1080p", "4K"]) {
                const result = VideoDataSchema.safeParse({
                    ...baseData,
                    resolution: res,
                });
                expect(result.success).toBe(true);
                expect(result.data?.resolution).toBe(res);
            }
        });

        it("should normalize lowercase 4k to uppercase 4K", () => {
            const result = VideoDataSchema.safeParse({
                ...baseData,
                resolution: "4k",
            });
            expect(result.success).toBe(true);
            expect(result.data?.resolution).toBe("4K");
        });

        it("should default to 720p when resolution is missing", () => {
            const result = VideoDataSchema.safeParse(baseData);
            expect(result.success).toBe(true);
            expect(result.data?.resolution).toBe("720p");
        });
    });
});
