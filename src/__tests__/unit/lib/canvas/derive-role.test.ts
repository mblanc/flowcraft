import { describe, it, expect } from "vitest";
import { deriveCanvasRole } from "@/lib/canvas/derive-role";
import type { CanvasDocument } from "@/lib/canvas/types";

const baseCanvas: CanvasDocument = {
    id: "canvas-1",
    userId: "owner-uid",
    name: "Test Canvas",
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    messages: [],
    visibility: "private",
    sharedWith: [],
    sharedWithEmails: [],
    isTemplate: false,
    createdAt: "",
    updatedAt: "",
};

describe("deriveCanvasRole", () => {
    it("returns owner when userId matches", () => {
        expect(deriveCanvasRole(baseCanvas, "owner-uid", null)).toBe("owner");
    });

    it("returns editor when email has edit role in sharedWith", () => {
        const canvas: CanvasDocument = {
            ...baseCanvas,
            sharedWith: [{ email: "ed@example.com", role: "edit" }],
            sharedWithEmails: ["ed@example.com"],
        };
        expect(deriveCanvasRole(canvas, "other-uid", "ed@example.com")).toBe(
            "editor",
        );
    });

    it("returns viewer when email has view role in sharedWith", () => {
        const canvas: CanvasDocument = {
            ...baseCanvas,
            sharedWith: [{ email: "viewer@example.com", role: "view" }],
            sharedWithEmails: ["viewer@example.com"],
        };
        expect(
            deriveCanvasRole(canvas, "other-uid", "viewer@example.com"),
        ).toBe("viewer");
    });

    it("returns viewer when email is not in sharedWith and not owner", () => {
        expect(
            deriveCanvasRole(
                baseCanvas,
                "stranger-uid",
                "stranger@example.com",
            ),
        ).toBe("viewer");
    });

    it("returns viewer when userId and email are both undefined", () => {
        expect(deriveCanvasRole(baseCanvas, undefined, undefined)).toBe(
            "viewer",
        );
    });

    it("owner check takes priority over sharedWith", () => {
        const canvas: CanvasDocument = {
            ...baseCanvas,
            sharedWith: [{ email: "owner@example.com", role: "view" }],
            sharedWithEmails: ["owner@example.com"],
        };
        expect(deriveCanvasRole(canvas, "owner-uid", "owner@example.com")).toBe(
            "owner",
        );
    });
});
