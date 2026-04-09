import { describe, it, expect } from "vitest";
import { calculateNodePositions } from "../lib/canvas-layout";
import type { GenerationStep, CanvasNode } from "../lib/canvas-types";

describe("calculateNodePositions", () => {
    it("should layout a simple chain horizontally", () => {
        const steps: GenerationStep[] = [
            { id: "1", type: "image", prompt: "step 1" },
            { id: "2", type: "image", prompt: "step 2", dependsOn: ["1"] },
        ];
        const existingNodes: CanvasNode[] = [];
        const viewportCenter = { x: 0, y: 0 };

        const positions = calculateNodePositions(
            steps,
            existingNodes,
            viewportCenter,
        );

        const pos1 = positions.get("1");
        const pos2 = positions.get("2");

        expect(pos1).toBeDefined();
        expect(pos2).toBeDefined();
        expect(pos2!.x).toBeGreaterThan(pos1!.x);
        expect(pos2!.y).toBe(pos1!.y); // Aligned horizontally
    });

    it("should layout branches vertically", () => {
        const steps: GenerationStep[] = [
            { id: "1", type: "image", prompt: "step 1" },
            { id: "2", type: "image", prompt: "step 2", dependsOn: ["1"] },
            { id: "3", type: "image", prompt: "step 3", dependsOn: ["1"] },
        ];
        const existingNodes: CanvasNode[] = [];
        const viewportCenter = { x: 0, y: 0 };

        const positions = calculateNodePositions(
            steps,
            existingNodes,
            viewportCenter,
        );

        const pos2 = positions.get("2");
        const pos3 = positions.get("3");

        expect(pos2).toBeDefined();
        expect(pos3).toBeDefined();
        expect(pos2!.x).toBe(pos3!.x); // Same column
        expect(Math.abs(pos2!.y - pos3!.y)).toBeGreaterThan(0); // Different row
    });

    it("should shift group down on collision", () => {
        const steps: GenerationStep[] = [
            { id: "1", type: "image", prompt: "step 1" },
        ];
        // Existing node at ideal position
        const existingNodes: CanvasNode[] = [
            {
                id: "old",
                type: "canvas-image",
                position: { x: -150, y: -150 }, // Centered around 0,0
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
        const viewportCenter = { x: 0, y: 0 };

        const positions = calculateNodePositions(
            steps,
            existingNodes,
            viewportCenter,
        );

        const pos1 = positions.get("1");
        expect(pos1).toBeDefined();
        // Since (0,0) area is occupied by 'old',
        // the new node should be shifted down.
        expect(pos1!.y).toBeGreaterThan(-150);
    });
});
