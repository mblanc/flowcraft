import { describe, it, expect } from "vitest";
import { buildCanvasContext } from "@/lib/canvas/agent/prompts";
import type { CanvasNode } from "@/lib/canvas/types";

function makeImageNode(id: string, label: string, prompt?: string): CanvasNode {
    return {
        id,
        type: "canvas-image",
        position: { x: 0, y: 0 },
        data: {
            type: "canvas-image",
            label,
            sourceUrl: "gs://bucket/img.png",
            mimeType: "image/png",
            width: 512,
            height: 512,
            status: "ready",
            prompt,
        },
    };
}

function makeTextNode(
    id: string,
    label: string,
    content: string,
    format?: "scenario" | "synopsis" | "brief" | "notes",
): CanvasNode {
    return {
        id,
        type: "canvas-text",
        position: { x: 0, y: 0 },
        data: {
            type: "canvas-text",
            label,
            content,
            format,
            width: 480,
            height: 600,
        },
    };
}

describe("buildCanvasContext", () => {
    it("returns empty string when no nodes", () => {
        expect(buildCanvasContext([])).toBe("");
    });

    it("lists image nodes with id and type", () => {
        const ctx = buildCanvasContext([makeImageNode("img_1", "Portrait")]);
        expect(ctx).toContain("img_1");
        expect(ctx).toContain("type: image");
        expect(ctx).toContain("Portrait");
    });

    it("includes prompt for image nodes that have one", () => {
        const ctx = buildCanvasContext([
            makeImageNode("img_1", "Portrait", "cinematic portrait"),
        ]);
        expect(ctx).toContain('prompt: "cinematic portrait"');
    });

    it("includes full content for short text nodes", () => {
        const content = "# Lumino\n\nShot 01 — The Watcher\nDuration: 2.5s";
        const ctx = buildCanvasContext([
            makeTextNode("txt_1", "Trailer Scenario", content),
        ]);
        expect(ctx).toContain(content);
        expect(ctx).not.toContain("[… truncated]");
    });

    it("truncates text node content at 800 chars with marker", () => {
        const longContent = "A".repeat(1000);
        const ctx = buildCanvasContext([
            makeTextNode("txt_1", "Long Doc", longContent),
        ]);
        expect(ctx).toContain("A".repeat(800));
        expect(ctx).toContain("[… truncated]");
        expect(ctx).not.toContain("A".repeat(801));
    });

    it("includes format tag for text nodes that have one", () => {
        const ctx = buildCanvasContext([
            makeTextNode("txt_1", "Trailer", "content", "scenario"),
        ]);
        expect(ctx).toContain("[format: scenario]");
    });

    it("does not add format tag when format is absent", () => {
        const ctx = buildCanvasContext([
            makeTextNode("txt_1", "Notes", "some notes"),
        ]);
        expect(ctx).not.toContain("[format:");
    });

    it("includes IMPORTANT guard at the end", () => {
        const ctx = buildCanvasContext([makeImageNode("img_1", "Portrait")]);
        expect(ctx).toContain(
            "IMPORTANT: Only use node IDs that appear in this list.",
        );
    });
});
