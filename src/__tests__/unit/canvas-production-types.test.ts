import { describe, it, expect } from "vitest";
import type {
    MediaOperation,
    EdgeRole,
    PlanNode,
    PlanEdge,
    ProductionPlan,
    ResolvedPlanNode,
} from "../../lib/canvas/types";

describe("ProductionPlan types", () => {
    it("PlanNode accepts all required and optional fields", () => {
        const node: PlanNode = {
            id: "n1",
            operation: "t2i",
            promptIntent: "A moody portrait in golden hour light",
        };
        expect(node.id).toBe("n1");
        expect(node.operation).toBe("t2i");
        expect(node.promptIntent).toBe("A moody portrait in golden hour light");
        expect(node.prompt).toBeUndefined();
    });

    it("PlanNode accepts optional prompt and label", () => {
        const node: PlanNode = {
            id: "n2",
            operation: "i2v",
            promptIntent: "Animate the portrait",
            prompt: "Slow dolly in on a moody portrait, golden hour, cinematic",
            label: "Animated Portrait",
        };
        expect(node.prompt).toBe(
            "Slow dolly in on a moody portrait, golden hour, cinematic",
        );
        expect(node.label).toBe("Animated Portrait");
    });

    it("PlanEdge has from, to, and role", () => {
        const edge: PlanEdge = {
            from: "n1",
            to: "n2",
            role: "depends_on",
        };
        expect(edge.from).toBe("n1");
        expect(edge.to).toBe("n2");
        expect(edge.role).toBe("depends_on");
    });

    it("ProductionPlan has nodes, edges, and optional clarifications", () => {
        const plan: ProductionPlan = {
            nodes: [
                { id: "n1", operation: "t2i", promptIntent: "A forest" },
                { id: "n2", operation: "i2v", promptIntent: "Animate it" },
            ],
            edges: [{ from: "n1", to: "n2", role: "depends_on" }],
            clarifications: ["What visual style should be used?"],
        };
        expect(plan.nodes).toHaveLength(2);
        expect(plan.edges).toHaveLength(1);
        expect(plan.clarifications).toHaveLength(1);
    });

    it("ProductionPlan works without clarifications", () => {
        const plan: ProductionPlan = {
            nodes: [{ id: "n1", operation: "t2s", promptIntent: "Narrate" }],
            edges: [],
        };
        expect(plan.clarifications).toBeUndefined();
    });

    it("ResolvedPlanNode requires a non-optional prompt", () => {
        const resolved: ResolvedPlanNode = {
            id: "n1",
            operation: "t2i",
            promptIntent: "A cat in a field",
            prompt: "A fluffy orange cat sitting in a sunlit meadow, shallow DOF",
        };
        expect(resolved.prompt).toBe(
            "A fluffy orange cat sitting in a sunlit meadow, shallow DOF",
        );
    });

    it("MediaOperation union covers all expected operations", () => {
        const ops: MediaOperation[] = [
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
        expect(ops).toHaveLength(11);
    });

    it("EdgeRole covers expected roles", () => {
        const roles: EdgeRole[] = ["depends_on", "style_ref", "subject_ref"];
        expect(roles).toHaveLength(3);
    });
});
