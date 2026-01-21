
import { describe, it, expect } from "vitest";
import { detectCycle } from "../lib/graph-utils";

describe("Graph Utils - Cycle Detection", () => {
    it("should return false for an empty graph", () => {
        const nodes: any[] = [];
        const edges: any[] = [];
        expect(detectCycle(nodes, edges)).toBe(false);
    });

    it("should return false for a single node with no edges", () => {
        const nodes = [{ id: "1" }];
        const edges: any[] = [];
        expect(detectCycle(nodes, edges)).toBe(false);
    });

    it("should return false for a simple linear graph (A -> B)", () => {
        const nodes = [{ id: "1" }, { id: "2" }];
        const edges = [{ source: "1", target: "2" }];
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
        const nodes = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }];
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
