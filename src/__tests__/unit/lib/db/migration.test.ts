import { describe, it, expect } from "vitest";
import { migrateEdges } from "@/lib/db/migration";
import { MODELS } from "@/lib/constants";
import type { Edge, Node } from "@xyflow/react";

describe("migrateEdges", () => {
    it("migrates first-frame-input and last-frame-input to image-input for Omni video nodes", () => {
        const nodes: Node<Record<string, unknown>>[] = [
            {
                id: "img-1",
                type: "image",
                position: { x: 0, y: 0 },
                data: { type: "image" },
            },
            {
                id: "vid-omni",
                type: "video",
                position: { x: 200, y: 0 },
                data: {
                    type: "video",
                    model: MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH,
                },
            },
            {
                id: "vid-veo",
                type: "video",
                position: { x: 200, y: 200 },
                data: {
                    type: "video",
                    model: MODELS.VIDEO.VEO_3_1_FAST,
                },
            },
        ];

        const edges: Edge[] = [
            {
                id: "e1",
                source: "img-1",
                target: "vid-omni",
                sourceHandle: "result-output",
                targetHandle: "first-frame-input",
            },
            {
                id: "e2",
                source: "img-1",
                target: "vid-omni",
                sourceHandle: "result-output",
                targetHandle: "last-frame-input",
            },
            {
                id: "e3",
                source: "img-1",
                target: "vid-veo",
                sourceHandle: "result-output",
                targetHandle: "first-frame-input",
            },
        ];

        const migrated = migrateEdges(edges, nodes);
        expect(migrated[0].targetHandle).toBe("image-input");
        expect(migrated[1].targetHandle).toBe("image-input");
        expect(migrated[2].targetHandle).toBe("first-frame-input");
    });
});
