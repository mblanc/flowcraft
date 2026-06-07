import { describe, it, expect } from "vitest";
import { planProductionTool } from "../../lib/canvas/adk/tools";

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
});
