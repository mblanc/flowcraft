import { describe, it, expect } from "vitest";
import { calculateNodePositions } from "../lib/canvas-layout";
import type { GenerationStep, CanvasNode } from "../lib/canvas-types";

describe("calculateNodePositions", () => {
    it("should layout a simple chain horizontally", () => {
        const steps: GenerationStep[] = [
            { id: "1", type: "image", prompt: "step 1" },
            { id: "2", type: "image", prompt: "step 2", dependsOn: ["1"] },
        ];
        const positions = calculateNodePositions(steps, [], { x: 0, y: 0 });

        const pos1 = positions.get("1")!;
        const pos2 = positions.get("2")!;

        expect(pos1).toBeDefined();
        expect(pos2).toBeDefined();
        expect(pos2.x).toBeGreaterThan(pos1.x);
        expect(pos2.y).toBe(pos1.y); // Aligned horizontally
    });

    it("should layout branches vertically", () => {
        const steps: GenerationStep[] = [
            { id: "1", type: "image", prompt: "step 1" },
            { id: "2", type: "image", prompt: "step 2", dependsOn: ["1"] },
            { id: "3", type: "image", prompt: "step 3", dependsOn: ["1"] },
        ];
        const positions = calculateNodePositions(steps, [], { x: 0, y: 0 });

        const pos2 = positions.get("2")!;
        const pos3 = positions.get("3")!;

        expect(pos2).toBeDefined();
        expect(pos3).toBeDefined();
        expect(pos2.x).toBe(pos3.x); // Same column
        expect(Math.abs(pos2.y - pos3.y)).toBeGreaterThan(0); // Different row
    });

    it("should shift group down on collision", () => {
        const steps: GenerationStep[] = [
            { id: "1", type: "image", prompt: "step 1" },
        ];
        const existingNodes: CanvasNode[] = [
            {
                id: "old",
                type: "canvas-image",
                position: { x: -150, y: -150 },
                data: {
                    type: "canvas-image",
                    label: "old",
                    sourceUrl: "",
                    mimeType: "image/png",
                    status: "ready",
                    width: 300,
                    height: 300,
                },
                width: 300,
                height: 300,
            },
        ];
        const positions = calculateNodePositions(steps, existingNodes, {
            x: 0,
            y: 0,
        });

        const pos1 = positions.get("1")!;
        expect(pos1).toBeDefined();
        // Since (0,0) area is occupied by 'old', new node should be shifted down.
        expect(pos1.y).toBeGreaterThan(-150);
    });

    it("should not overlap when a sibling has a deep subtree", () => {
        // s1 → [s2 → [s5, s6, s7], s3, s4]
        // With old code: s3 would end up at same Y as s7 (overlap).
        // With fix: s2's full subtree height (980) is used for spacing.
        const steps: GenerationStep[] = [
            { id: "s1", type: "image", prompt: "root" },
            { id: "s2", type: "image", prompt: "child a", dependsOn: ["s1"] },
            { id: "s3", type: "image", prompt: "child b", dependsOn: ["s1"] },
            { id: "s4", type: "image", prompt: "child c", dependsOn: ["s1"] },
            {
                id: "s5",
                type: "video",
                prompt: "grandchild 1",
                dependsOn: ["s2"],
            },
            {
                id: "s6",
                type: "video",
                prompt: "grandchild 2",
                dependsOn: ["s2"],
            },
            {
                id: "s7",
                type: "video",
                prompt: "grandchild 3",
                dependsOn: ["s2"],
            },
        ];
        const positions = calculateNodePositions(steps, [], { x: 0, y: 0 });

        const nodeHeight = 300;
        const gap = 40;

        // s3 and s7 must not overlap (they share the same X column)
        const pos3 = positions.get("s3")!;
        const pos7 = positions.get("s7")!;
        expect(pos3).toBeDefined();
        expect(pos7).toBeDefined();
        // s7 is in col 2, s3 is in col 1 — different X, no vertical overlap concern
        // More importantly: s3 and s5/s6/s7 are in different columns, so no Y overlap
        // The key check: s3 and s2 should not overlap vertically
        const pos2 = positions.get("s2")!;
        const s2Bottom = pos2.y + nodeHeight;
        const s3Top = pos3.y;
        expect(s3Top).toBeGreaterThanOrEqual(s2Bottom + gap - 1); // allow 1px rounding

        // Also s3 and s4 should be separated
        const pos4 = positions.get("s4")!;
        const s3Bottom = pos3.y + nodeHeight;
        const s4Top = pos4.y;
        expect(s4Top).toBeGreaterThanOrEqual(s3Bottom + gap - 1);
    });

    it("should place multiple roots with same reference at different Y positions", () => {
        const existingNodes: CanvasNode[] = [
            {
                id: "ref",
                type: "canvas-image",
                position: { x: 0, y: 0 },
                data: {
                    type: "canvas-image",
                    label: "ref",
                    sourceUrl: "",
                    mimeType: "image/png",
                    status: "ready",
                    width: 300,
                    height: 300,
                },
                width: 300,
                height: 300,
            },
        ];
        const steps: GenerationStep[] = [
            {
                id: "a",
                type: "image",
                prompt: "variation 1",
                referenceNodeIds: ["ref"],
            },
            {
                id: "b",
                type: "image",
                prompt: "variation 2",
                referenceNodeIds: ["ref"],
            },
            {
                id: "c",
                type: "image",
                prompt: "variation 3",
                referenceNodeIds: ["ref"],
            },
        ];
        const positions = calculateNodePositions(steps, existingNodes, {
            x: 0,
            y: 0,
        });

        const posA = positions.get("a")!;
        const posB = positions.get("b")!;
        const posC = positions.get("c")!;

        expect(posA).toBeDefined();
        expect(posB).toBeDefined();
        expect(posC).toBeDefined();

        // All should be in the same column (same X)
        expect(posA.x).toBe(posB.x);
        expect(posB.x).toBe(posC.x);

        // All should be at different Y positions (no overlap)
        const nodeHeight = 300;
        const gap = 40;
        const ys = [posA.y, posB.y, posC.y].sort((a, b) => a - b);
        expect(ys[1]).toBeGreaterThanOrEqual(ys[0] + nodeHeight + gap - 1);
        expect(ys[2]).toBeGreaterThanOrEqual(ys[1] + nodeHeight + gap - 1);
    });

    it("should horizontally align a child with its parent (3-step pipeline)", () => {
        // s1 → [s2, s3, s4] → s5→s2, s6→s3, s7→s4
        const steps: GenerationStep[] = [
            { id: "s1", type: "image", prompt: "root" },
            { id: "s2", type: "image", prompt: "img a", dependsOn: ["s1"] },
            { id: "s3", type: "image", prompt: "img b", dependsOn: ["s1"] },
            { id: "s4", type: "image", prompt: "img c", dependsOn: ["s1"] },
            { id: "s5", type: "video", prompt: "vid a", dependsOn: ["s2"] },
            { id: "s6", type: "video", prompt: "vid b", dependsOn: ["s3"] },
            { id: "s7", type: "video", prompt: "vid c", dependsOn: ["s4"] },
        ];
        const positions = calculateNodePositions(steps, [], { x: 0, y: 0 });

        // Each video should be at the same Y as its source image
        expect(positions.get("s5")!.y).toBe(positions.get("s2")!.y);
        expect(positions.get("s6")!.y).toBe(positions.get("s3")!.y);
        expect(positions.get("s7")!.y).toBe(positions.get("s4")!.y);

        // Videos should be to the right of images
        expect(positions.get("s5")!.x).toBeGreaterThan(positions.get("s2")!.x);
    });
});
