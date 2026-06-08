import { describe, it, expect } from "vitest";
import { planProductionTool } from "@/lib/canvas/agent/tools";

describe("planProductionTool", () => {
    it("accepts a minimal plan with one t2i node and no edges", async () => {
        const args = {
            nodes: [
                {
                    id: "n1",
                    operation: "t2i",
                    promptIntent: "A misty forest at dawn",
                },
            ],
            edges: [],
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (planProductionTool as any).runAsync({
            args,
            toolContext: undefined,
        });
        expect(result).toEqual(args);
    });

    it("accepts nodes with optional prompt, label and edges", async () => {
        const args = {
            nodes: [
                {
                    id: "n1",
                    operation: "t2i",
                    promptIntent: "Portrait",
                    prompt: "A moody portrait, golden hour, cinematic",
                    label: "Hero Portrait",
                },
                {
                    id: "n2",
                    operation: "i2v",
                    promptIntent: "Animate portrait",
                },
            ],
            edges: [{ from: "n1", to: "n2", role: "depends_on" }],
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (planProductionTool as any).runAsync({
            args,
            toolContext: undefined,
        });
        expect(result).toEqual(args);
    });

    it("accepts optional clarifications", async () => {
        const args = {
            nodes: [
                { id: "n1", operation: "t2v", promptIntent: "A stormy sea" },
            ],
            edges: [],
            clarifications: ["Should the video be realistic or stylized?"],
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (planProductionTool as any).runAsync({
            args,
            toolContext: undefined,
        });
        expect(result).toEqual(args);
    });

    it("validates operation against the MediaOperation union", async () => {
        const validOps = [
            "t2i",
            "i2i",
            "t2v",
            "i2v",
            "i2v2",
            "t2s",
            "t2m",
            "sfx",
            "concat",
            "edit",
            "upscale",
        ];
        for (const op of validOps) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await (planProductionTool as any).runAsync({
                args: {
                    nodes: [{ id: "n1", operation: op, promptIntent: "test" }],
                    edges: [],
                },
                toolContext: undefined,
            });
            expect(result.nodes[0].operation).toBe(op);
        }
    });

    it("deduplicates nodes with the same id — second becomes id-2", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (planProductionTool as any).runAsync({
            args: {
                nodes: [
                    { id: "n1", operation: "t2i", promptIntent: "A" },
                    { id: "n1", operation: "t2v", promptIntent: "B" },
                ],
                edges: [],
            },
            toolContext: undefined,
        });
        expect(result.nodes.map((n: { id: string }) => n.id)).toEqual([
            "n1",
            "n1-2",
        ]);
    });

    it("dedup skips already-taken suffix — three nodes with same id become id, id-2, id-3", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (planProductionTool as any).runAsync({
            args: {
                nodes: [
                    { id: "n1", operation: "t2i", promptIntent: "A" },
                    { id: "n1", operation: "t2v", promptIntent: "B" },
                    { id: "n1", operation: "i2v", promptIntent: "C" },
                ],
                edges: [],
            },
            toolContext: undefined,
        });
        expect(result.nodes.map((n: { id: string }) => n.id)).toEqual([
            "n1",
            "n1-2",
            "n1-3",
        ]);
    });

    it("remaps edge to when a referenced node is renamed", async () => {
        // n2 appears twice — the second becomes n2-2.
        // The edge points from n1 to the second n2 (n2-2).
        // After dedup, n2 in the edge is remapped to n2-2.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (planProductionTool as any).runAsync({
            args: {
                nodes: [
                    { id: "n1", operation: "t2i", promptIntent: "A" },
                    { id: "n2", operation: "t2i", promptIntent: "B" },
                    { id: "n2", operation: "i2v", promptIntent: "C" },
                ],
                edges: [{ from: "n1", to: "n2", role: "depends_on" }],
            },
            toolContext: undefined,
        });
        // n2 was renamed to n2-2, so the edge's to is remapped
        expect(result.edges[0].from).toBe("n1");
        expect(result.edges[0].to).toBe("n2-2");
    });

    it("validates edge role against EdgeRole union", async () => {
        const validRoles = ["depends_on", "style_ref", "subject_ref"];
        for (const role of validRoles) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await (planProductionTool as any).runAsync({
                args: {
                    nodes: [
                        {
                            id: "n1",
                            operation: "t2i",
                            promptIntent: "A",
                        },
                        {
                            id: "n2",
                            operation: "i2v",
                            promptIntent: "B",
                        },
                    ],
                    edges: [{ from: "n1", to: "n2", role }],
                },
                toolContext: undefined,
            });
            expect(result.edges[0].role).toBe(role);
        }
    });

    it("correctly remaps self-referential duplicate edges to avoid self-loops", async () => {
        // n1 appears three times — n1, n1-2, n1-3.
        // We have two edges: n1 -> n1, and n1 -> n1.
        // They should be remapped to: n1 -> n1-2, and n1-2 -> n1-3.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (planProductionTool as any).runAsync({
            args: {
                nodes: [
                    { id: "n1", operation: "t2i", promptIntent: "A" },
                    { id: "n1", operation: "i2v", promptIntent: "B" },
                    { id: "n1", operation: "upscale", promptIntent: "C" },
                ],
                edges: [
                    { from: "n1", to: "n1", role: "depends_on" },
                    { from: "n1", to: "n1", role: "depends_on" },
                ],
            },
            toolContext: undefined,
        });
        expect(result.nodes.map((n: { id: string }) => n.id)).toEqual([
            "n1",
            "n1-2",
            "n1-3",
        ]);
        expect(result.edges).toEqual([
            { from: "n1", to: "n1-2", role: "depends_on" },
            { from: "n1-2", to: "n1-3", role: "depends_on" },
        ]);
    });
});
