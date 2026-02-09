import { describe, it, expect } from "vitest";
import {
    detectCycle,
    detectRecursiveCycle,
    GraphNode,
    GraphEdge,
} from "../lib/graph-utils";

describe("Graph Utils - Cycle Detection", () => {
    it("should return false for an empty graph", () => {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        expect(detectCycle(nodes, edges)).toBe(false);
    });

    it("should return false for a single node with no edges", () => {
        const nodes: GraphNode[] = [{ id: "1" }];
        const edges: GraphEdge[] = [];
        expect(detectCycle(nodes, edges)).toBe(false);
    });

    it("should return false for a simple linear graph (A -> B)", () => {
        const nodes: GraphNode[] = [{ id: "1" }, { id: "2" }];
        const edges: GraphEdge[] = [{ source: "1", target: "2" }];
        expect(detectCycle(nodes, edges)).toBe(false);
    });

    it("should return true for a simple cycle (A -> B -> A)", () => {
        const nodes = [{ id: "1" }, { id: "2" }];
        const edges = [
            { source: "1", target: "2" },
            { source: "2", target: "1" },
        ];
        expect(detectCycle(nodes, edges)).toBe(true);
    });

    it("should return false for a longer linear chain (A -> B -> C)", () => {
        const nodes = [{ id: "1" }, { id: "2" }, { id: "3" }];
        const edges = [
            { source: "1", target: "2" },
            { source: "2", target: "3" },
        ];
        expect(detectCycle(nodes, edges)).toBe(false);
    });

    it("should return true for a longer cycle (A -> B -> C -> A)", () => {
        const nodes = [{ id: "1" }, { id: "2" }, { id: "3" }];
        const edges = [
            { source: "1", target: "2" },
            { source: "2", target: "3" },
            { source: "3", target: "1" },
        ];
        expect(detectCycle(nodes, edges)).toBe(true);
    });

    it("should return true for a self-loop (A -> A)", () => {
        const nodes = [{ id: "1" }];
        const edges = [{ source: "1", target: "1" }];
        expect(detectCycle(nodes, edges)).toBe(true);
    });

    it("should return true when a cycle exists in a disconnected component", () => {
        const nodes = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];
        const edges = [
            // Component 1: 1 -> 2 (No cycle)
            { source: "1", target: "2" },
            // Component 2: 3 -> 4 -> 3 (Cycle)
            { source: "3", target: "4" },
            { source: "4", target: "3" },
        ];
        expect(detectCycle(nodes, edges)).toBe(true);
    });

    it("should return true for a complex cycle", () => {
        // 1 -> 2 -> 3
        //      ^    |
        //      |    v
        //      5 <- 4
        const nodes = [
            { id: "1" },
            { id: "2" },
            { id: "3" },
            { id: "4" },
            { id: "5" },
        ];
        const edges = [
            { source: "1", target: "2" },
            { source: "2", target: "3" },
            { source: "3", target: "4" },
            { source: "4", target: "5" },
            { source: "5", target: "2" },
        ];
        expect(detectCycle(nodes, edges)).toBe(true);
    });
});

describe("Graph Utils - Recursive Cycle Detection", () => {
    // Mock flow structure
    interface MockFlow {
        id: string;
        nodes: GraphNode[];
    }

    const mockDB: Record<string, MockFlow> = {
        "flow-a": {
            id: "flow-a",
            nodes: [], // Base flow
        },
        "flow-b": {
            id: "flow-b",
            nodes: [], // Will be configured in tests
        },
        "flow-c": {
            id: "flow-c",
            nodes: [
                {
                    id: "node-1",
                    type: "custom-workflow",
                    data: { subWorkflowId: "flow-a" },
                },
            ],
        },
        "flow-d": {
            id: "flow-d",
            nodes: [
                {
                    id: "node-1",
                    type: "custom-workflow",
                    data: { subWorkflowId: "flow-c" },
                },
            ],
        },
    };

    const fetchFlow = async (id: string) => {
        return mockDB[id] ? { nodes: mockDB[id].nodes } : null;
    };

    it("should return false when adding a flow with no sub-workflows", async () => {
        // Adding flow-a (empty) to flow-b
        const result = await detectRecursiveCycle(
            "flow-b",
            "flow-a",
            fetchFlow,
        );
        expect(result).toBe(false);
    });

    it("should return true when adding a flow that contains the target flow (Direct Cycle)", async () => {
        // flow-c contains flow-a.
        // If we add flow-c to flow-a, it's a cycle: flow-a -> flow-c -> flow-a
        const result = await detectRecursiveCycle(
            "flow-a",
            "flow-c",
            fetchFlow,
        );
        expect(result).toBe(true);
    });

    it("should return true when adding a flow that indirectly contains the target flow (Indirect Cycle)", async () => {
        // flow-d contains flow-c, which contains flow-a.
        // If we add flow-d to flow-a: flow-a -> flow-d -> flow-c -> flow-a
        const result = await detectRecursiveCycle(
            "flow-a",
            "flow-d",
            fetchFlow,
        );
        expect(result).toBe(true);
    });

    it("should return false when dependencies do not form a cycle", async () => {
        // flow-c contains flow-a.
        // Adding flow-c to flow-d (which is new/empty logic wise for this test, let's assume flow-e)
        // Let's check if adding flow-c to flow-b creates a cycle. flow-b is empty.
        // flow-b -> flow-c -> flow-a. No cycle.
        const result = await detectRecursiveCycle(
            "flow-b",
            "flow-c",
            fetchFlow,
        );
        expect(result).toBe(false);
    });

    it("should handle cases where fetch returns null (graceful failure)", async () => {
        const result = await detectRecursiveCycle(
            "flow-a",
            "non-existent-flow",
            fetchFlow,
        );
        expect(result).toBe(false);
    });
});
