/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useFlowStore } from "@/lib/store/use-flow-store";
import type { Node } from "@xyflow/react";
import type { NodeData } from "@/lib/types";
import { createNode } from "@/lib/node-factory";

// Mock createNode to avoid issues with ID generation in tests
vi.mock("@/lib/node-factory", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/node-factory")>();
    return {
        ...actual,
        createNode: vi.fn((type, position) => {
            const node = actual.createNode(type, position);
            node.id = `mock-${type}-id`;
            return node;
        }),
    };
});

describe("useFlowStore (GraphSlice + UISlice)", () => {
    beforeEach(() => {
        useFlowStore.setState({
            nodes: [],
            nodesById: {},
            edges: [],
            selectedNodeId: null,
            selectedNode: null,
            flowId: null,
            flowName: "Untitled Flow",
            entityType: "flow",
            visibility: null,
            sharedWith: [],
            isTemplate: false,
            ownerId: null,
            lastModified: 0,
            isRunning: false,
        });
    });

    it("should initialize with default state", () => {
        const state = useFlowStore.getState();
        expect(state.nodes).toEqual([]);
        expect(state.edges).toEqual([]);
        expect(state.flowName).toBe("Untitled Flow");
    });

    it("should set nodes and update nodesById", () => {
        const mockNode: Node<NodeData> = {
            id: "node-1",
            type: "text",
            position: { x: 0, y: 0 },
            data: { name: "Text Node" } as NodeData,
        };

        useFlowStore.getState().setNodes([mockNode]);
        const state = useFlowStore.getState();

        expect(state.nodes.length).toBe(1);
        expect(state.nodesById["node-1"]).toBeDefined();
        expect(state.nodesById["node-1"].id).toBe("node-1");
    });

    it("should add a node and update corresponding records", () => {
        const mockNode: Node<NodeData> = {
            id: "node-1",
            type: "text",
            position: { x: 0, y: 0 },
            data: { name: "Text Node" } as NodeData,
        };

        useFlowStore.getState().addNode(mockNode);
        const state = useFlowStore.getState();

        expect(state.nodes).toContain(mockNode);
        expect(state.nodesById["node-1"]).toBe(mockNode);
    });

    it("should add a node with type and handle name collisions", () => {
        useFlowStore.getState().addNodeWithType("text", { x: 0, y: 0 });
        const state1 = useFlowStore.getState();
        expect(state1.nodes.length).toBe(1);
        const name1 = state1.nodes[0].data.name;

        // Add second node of same type to trigger name collision resolution
        useFlowStore.getState().addNodeWithType("text", { x: 0, y: 0 });
        const state2 = useFlowStore.getState();
        expect(state2.nodes.length).toBe(2);

        // Assuming base name is derived from type, and candidate increment applies
        expect(state2.nodes[1].data.name).not.toBe(name1);
    });

    it("should update node data correctly and maintain immutability", () => {
        const mockNode: Node<NodeData> = {
            id: "n2",
            type: "text",
            position: { x: 0, y: 0 },
            data: { name: "Old Name" } as NodeData,
        };

        useFlowStore.getState().setNodes([mockNode]);

        useFlowStore.getState().updateNodeData("n2", { name: "New Name" });
        const state = useFlowStore.getState();

        expect(state.nodesById["n2"].data.name).toBe("New Name");
        expect(state.nodes[0].data.name).toBe("New Name");
    });

    it("should unselect node if it is currently executing when updated", () => {
        const mockNode: Node<NodeData> = {
            id: "n1",
            type: "text",
            position: { x: 0, y: 0 },
            data: { name: "Node 1" } as NodeData,
            selected: true,
        };

        useFlowStore.getState().setNodes([mockNode]);
        useFlowStore.getState().selectNode("n1");

        expect(useFlowStore.getState().selectedNodeId).toBe("n1");

        useFlowStore.getState().updateNodeData("n1", { executing: true });

        const state = useFlowStore.getState();
        expect(state.nodesById["n1"].selected).toBe(false);
        expect(state.selectedNodeId).toBe(null);
    });

    it("should set and select a node", () => {
        const n1: Node<NodeData> = {
            id: "n1",
            type: "text",
            position: { x: 0, y: 0 },
            data: {} as NodeData,
        };
        const n2: Node<NodeData> = {
            id: "n2",
            type: "text",
            position: { x: 0, y: 0 },
            data: {} as NodeData,
        };

        useFlowStore.getState().setNodes([n1, n2]);
        useFlowStore.getState().selectNode("n2");

        const state = useFlowStore.getState();
        expect(state.selectedNodeId).toBe("n2");
        expect(state.selectedNode?.id).toBe("n2");
        expect(state.nodesById["n2"].selected).toBe(true);
        expect(state.nodesById["n1"].selected).toBe(false);
    });

    it("should load flow correctly and update timestamp", () => {
        const n1: Node<NodeData> = {
            id: "n1",
            type: "text",
            position: { x: 0, y: 0 },
            data: {} as NodeData,
        };
        useFlowStore.getState().loadFlow(
            "flow-123",
            [n1],
            [],
            "Loaded Flow",
            "flow",
            {
                visibility: "public",
                sharedWith: [],
                isTemplate: false,
                ownerId: "user-1",
            },
            new Date("2024-01-01").toISOString(),
        );

        const state = useFlowStore.getState();
        expect(state.flowId).toBe("flow-123");
        expect(state.flowName).toBe("Loaded Flow");
        expect(state.nodes.length).toBe(1);
        expect(state.visibility).toBe("public");
    });

    it("should not overwrite local draft if local is newer than remote during loadFlow", () => {
        // First set a flow with a newer timestamp
        const n1: Node<NodeData> = {
            id: "n1",
            type: "text",
            position: { x: 0, y: 0 },
            data: {} as NodeData,
            selected: false,
        };
        useFlowStore.getState().loadFlow(
            "flow-123",
            [n1],
            [],
            "Local Name",
            "flow",
            {
                visibility: "private",
                sharedWith: [],
                isTemplate: false,
                ownerId: "user-1",
            },
            new Date("2024-02-01").toISOString(),
        ); // Local timestamp is Feb

        // Try load flow with an older timestamp
        const consoleWarnSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => {});
        useFlowStore.getState().loadFlow(
            "flow-123",
            [],
            [],
            "Old Name",
            "flow",
            {
                visibility: "private",
                sharedWith: [],
                isTemplate: false,
                ownerId: "user-1",
            },
            new Date("2024-01-01").toISOString(),
        ); // Remote timestamp is Jan

        const state = useFlowStore.getState();
        expect(state.flowName).toBe("Local Name"); // Should not have been overwritten
        expect(state.nodes.length).toBe(1);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining("Preserve local draft"),
        );

        consoleWarnSpy.mockRestore();
    });
});
