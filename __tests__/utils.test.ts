import { describe, it, expect } from "vitest";
import { cn, shallowEqual } from "../lib/utils";
import { isTypeCompatible } from "../lib/utils";

describe("cn", () => {
    it("merges class names", () => {
        expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("handles conditional classes", () => {
        expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
    });

    it("resolves tailwind conflicts via tailwind-merge", () => {
        expect(cn("p-2", "p-4")).toBe("p-4");
    });

    it("handles undefined and null inputs", () => {
        expect(cn(undefined, null as unknown as string, "foo")).toBe("foo");
    });

    it("returns empty string for no valid inputs", () => {
        expect(cn()).toBe("");
    });
});

describe("shallowEqual", () => {
    it("returns true for identical reference", () => {
        const obj = { a: 1 };
        expect(shallowEqual(obj, obj)).toBe(true);
    });

    it("returns true for objects with equal shallow properties", () => {
        expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    });

    it("returns false when property values differ", () => {
        expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    });

    it("returns false when keys differ", () => {
        expect(shallowEqual({ a: 1 }, { b: 1 })).toBe(false);
    });

    it("returns false for different key counts", () => {
        expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    it("returns false when one side is null", () => {
        expect(shallowEqual(null, {})).toBe(false);
        expect(shallowEqual({}, null)).toBe(false);
    });

    it("returns false for non-object primitives", () => {
        expect(shallowEqual(1, 2)).toBe(false);
    });

    it("returns true for equal primitives via Object.is", () => {
        expect(shallowEqual(42, 42)).toBe(true);
    });
});

describe("isTypeCompatible - collection types", () => {
    it("allows collection source to match its inner type as target", () => {
        expect(isTypeCompatible("collection:image", "image")).toBe(true);
    });

    it("rejects collection source when inner type differs", () => {
        expect(isTypeCompatible("collection:image", "video")).toBe(false);
    });

    it("allows target collection to match its inner type as source", () => {
        expect(isTypeCompatible("image", "collection:image")).toBe(true);
    });

    it("rejects target collection when inner type differs", () => {
        expect(isTypeCompatible("video", "collection:image")).toBe(false);
    });

    it("allows any source with collection target", () => {
        expect(isTypeCompatible("any", "collection:image")).toBe(true);
    });

    it("allows collection source with any target", () => {
        expect(isTypeCompatible("collection:image", "any")).toBe(true);
    });
});
