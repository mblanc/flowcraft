import { describe, it, expect } from "vitest";
import { isTypeCompatible } from "../lib/utils";

describe("Type Compatibility Utility", () => {
    it("should allow same types", () => {
        expect(isTypeCompatible("string", "string")).toBe(true);
        expect(isTypeCompatible("image", "image")).toBe(true);
        expect(isTypeCompatible("video", "video")).toBe(true);
        expect(isTypeCompatible("json", "json")).toBe(true);
    });

    it("should reject incompatible types", () => {
        expect(isTypeCompatible("image", "string")).toBe(false);
        expect(isTypeCompatible("video", "image")).toBe(false);
        expect(isTypeCompatible("string", "video")).toBe(false);
        expect(isTypeCompatible("json", "string")).toBe(false);
    });

    it("should handle any/unknown types gracefully", () => {
        // If we decide to support 'any' in the future
        expect(isTypeCompatible("any" as any, "string")).toBe(true);
        expect(isTypeCompatible("string", "any" as any)).toBe(true);
    });
});
