import { describe, it, expect } from "vitest";
import { GenerateImageSchema, GenerateVideoSchema } from "../lib/schemas";

describe("Resolution Schemas", () => {
    describe("GenerateImageSchema", () => {
        it("should accept valid image resolutions", () => {
            const result = GenerateImageSchema.safeParse({
                prompt: "test",
                resolution: "1K",
            });
            expect(result.success).toBe(true);
        });

        it("should reject invalid image resolutions", () => {
            const result = GenerateImageSchema.safeParse({
                prompt: "test",
                resolution: "720p",
            });
            expect(result.success).toBe(false);
        });

        it("should accept 4K image resolution", () => {
            const result = GenerateImageSchema.safeParse({
                prompt: "test",
                resolution: "4K",
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
    });
});
