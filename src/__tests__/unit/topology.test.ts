import { describe, it, expect } from "vitest";
import { topoSort } from "../../lib/canvas/adk/topology";
import type { PlanEdge, PlanNode } from "../../lib/canvas/types";

function makeNode(id: string): PlanNode {
    return { id, operation: "t2i", promptIntent: `intent-${id}` };
}

describe("topoSort", () => {
    it("returns all nodes in a single level when there are no edges", () => {
        const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
        const levels = topoSort(nodes, []);
        expect(levels).toHaveLength(1);
        expect(levels[0].map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
    });

    it("produces a linear chain across levels", () => {
        const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
        const edges: PlanEdge[] = [
            { from: "a", to: "b", role: "depends_on" },
            { from: "b", to: "c", role: "depends_on" },
        ];
        const levels = topoSort(nodes, edges);
        expect(levels).toHaveLength(3);
        expect(levels[0][0].id).toBe("a");
        expect(levels[1][0].id).toBe("b");
        expect(levels[2][0].id).toBe("c");
    });

    it("groups independent nodes in the same level (parallel)", () => {
        // a and b are independent; both feed into c
        const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
        const edges: PlanEdge[] = [
            { from: "a", to: "c", role: "depends_on" },
            { from: "b", to: "c", role: "depends_on" },
        ];
        const levels = topoSort(nodes, edges);
        expect(levels).toHaveLength(2);
        expect(levels[0].map((n) => n.id).sort()).toEqual(["a", "b"]);
        expect(levels[1][0].id).toBe("c");
    });

    it("handles diamond dependency correctly", () => {
        // a → b, a → c, b → d, c → d
        const nodes = [
            makeNode("a"),
            makeNode("b"),
            makeNode("c"),
            makeNode("d"),
        ];
        const edges: PlanEdge[] = [
            { from: "a", to: "b", role: "depends_on" },
            { from: "a", to: "c", role: "depends_on" },
            { from: "b", to: "d", role: "depends_on" },
            { from: "c", to: "d", role: "depends_on" },
        ];
        const levels = topoSort(nodes, edges);
        expect(levels).toHaveLength(3);
        expect(levels[0][0].id).toBe("a");
        expect(levels[1].map((n) => n.id).sort()).toEqual(["b", "c"]);
        expect(levels[2][0].id).toBe("d");
    });

    it("throws on cycle detection", () => {
        const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
        const edges: PlanEdge[] = [
            { from: "a", to: "b", role: "depends_on" },
            { from: "b", to: "c", role: "depends_on" },
            { from: "c", to: "a", role: "depends_on" }, // cycle
        ];
        expect(() => topoSort(nodes, edges)).toThrow(/cycle/i);
    });

    it("handles disconnected subgraphs", () => {
        // a → b (one subgraph), c → d (another), e (isolated)
        const nodes = [
            makeNode("a"),
            makeNode("b"),
            makeNode("c"),
            makeNode("d"),
            makeNode("e"),
        ];
        const edges: PlanEdge[] = [
            { from: "a", to: "b", role: "depends_on" },
            { from: "c", to: "d", role: "depends_on" },
        ];
        const levels = topoSort(nodes, edges);
        expect(levels).toHaveLength(2);
        const level0Ids = levels[0].map((n) => n.id).sort();
        const level1Ids = levels[1].map((n) => n.id).sort();
        expect(level0Ids).toEqual(["a", "c", "e"]);
        expect(level1Ids).toEqual(["b", "d"]);
    });

    it("ignores non-depends_on edges in the DAG", () => {
        // style_ref edges should not create ordering constraints
        const nodes = [makeNode("a"), makeNode("b")];
        const edges: PlanEdge[] = [{ from: "a", to: "b", role: "style_ref" }];
        const levels = topoSort(nodes, edges);
        // Both nodes are independent — no ordering constraint from style_ref
        expect(levels).toHaveLength(1);
        expect(levels[0].map((n) => n.id).sort()).toEqual(["a", "b"]);
    });
});
