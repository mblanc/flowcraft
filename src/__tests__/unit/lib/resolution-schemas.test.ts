import { describe, it, expect } from "vitest";
import { GenerateImageSchema, GenerateVideoSchema } from "@/lib/schemas";

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

        it("should default to gemini-omni-flash-preview", () => {
            const result = GenerateVideoSchema.safeParse({
                prompt: "test",
            });
            expect(result.success).toBe(true);
            expect(result.data?.model).toBe("gemini-omni-flash-preview");
        });

        it("should accept gemini-omni-flash-preview as model", () => {
            const result = GenerateVideoSchema.safeParse({
                prompt: "test",
                model: "gemini-omni-flash-preview",
            });
            expect(result.success).toBe(true);
        });
    });
});
