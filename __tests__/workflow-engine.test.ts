import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { WorkflowEngine } from "../lib/workflow-engine";
import { Node, Edge } from "@xyflow/react";
import {
    NodeData,
    TextData,
    LLMData,
    ImageData as FlowImageData,
} from "../lib/types";
import { getNodeDefinition } from "../lib/node-registry";

// Mock node-registry
vi.mock("../lib/node-registry", async (importOriginal) => {
    const original =
        await importOriginal<typeof import("../lib/node-registry")>();
    return {
        ...original,
        getNodeDefinition: vi.fn(),
    };
});

// Mock logger
vi.mock("../app/logger", () => ({
    default: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

describe("WorkflowEngine", () => {
    let mockOnNodeUpdate: Mock<
        (nodeId: string, data: Partial<NodeData>) => void
    >;

    beforeEach(() => {
        mockOnNodeUpdate = vi.fn();
        vi.clearAllMocks();
    });

    describe("getExecutionLevels", () => {
        it("should group nodes into levels based on dependencies", () => {
            const nodes: Node<NodeData>[] = [
                {
                    id: "1",
                    data: {
                        type: "text",
                        text: "hi",
                        name: "Text",
                    } as TextData,
                    position: { x: 0, y: 0 },
                } as Node<TextData>,
                {
                    id: "2",
                    data: {
                        type: "llm",
                        model: "m",
                        instructions: "i",
                        name: "LLM",
                    } as LLMData,
                    position: { x: 0, y: 0 },
                } as Node<LLMData>,
                {
                    id: "3",
                    data: {
                        type: "image",
                        prompt: "p",
                        images: [],
                        aspectRatio: "16:9",
                        model: "gemini-2.5-flash-image",
                        resolution: "1K",
                        name: "Image",
                    } as FlowImageData,
                    position: { x: 0, y: 0 },
                } as Node<FlowImageData>,
            ];
            const edges: Edge[] = [
                { id: "e1-2", source: "1", target: "2" },
                { id: "e2-3", source: "2", target: "3" },
            ];

            const engine = new WorkflowEngine(
                nodes as Node<NodeData>[],
                edges,
                mockOnNodeUpdate,
            );
            const levels = (
                engine as unknown as { getExecutionLevels: () => string[][] }
            ).getExecutionLevels();

            expect(levels).toEqual([["1"], ["2"], ["3"]]);
        });
    });

    describe("gatherInputs", () => {
        it("should call the node definition's gatherInputs", () => {
            const nodes: Node<NodeData>[] = [
                {
                    id: "1",
                    data: {
                        type: "llm",
                        model: "m",
                        instructions: "i",
                        name: "LLM",
                    } as LLMData,
                    position: { x: 0, y: 0 },
                } as Node<LLMData> as unknown as Node<NodeData>,
            ];
            const edges: Edge[] = [];

            const mockGatherInputs = vi
                .fn()
                .mockReturnValue({ prompt: "hello" });
            (getNodeDefinition as Mock).mockReturnValue({
                gatherInputs: mockGatherInputs,
            });

            const engine = new WorkflowEngine(nodes, edges, mockOnNodeUpdate);
            const inputs = (
                engine as unknown as {
                    gatherInputs: (node: Node<NodeData>) => unknown;
                }
            ).gatherInputs(nodes[0]);

            expect(mockGatherInputs).toHaveBeenCalledWith(
                nodes[0],
                edges,
                expect.any(Function),
            );
            expect(inputs).toEqual({ prompt: "hello" });
        });
    });

    describe("executeNodeSync", () => {
        it("should execute a node and store its results", async () => {
            const nodes: Node<NodeData>[] = [
                {
                    id: "1",
                    data: {
                        type: "llm",
                        model: "m",
                        instructions: "i",
                        name: "LLM",
                    } as LLMData,
                    position: { x: 0, y: 0 },
                } as Node<LLMData> as unknown as Node<NodeData>,
            ];
            const edges: Edge[] = [];

            const mockExecute = vi.fn().mockResolvedValue({ output: "result" });
            const mockGatherInputs = vi
                .fn()
                .mockReturnValue({ prompt: "input" });

            (getNodeDefinition as Mock).mockReturnValue({
                gatherInputs: mockGatherInputs,
                execute: mockExecute,
            });

            const engine = new WorkflowEngine(nodes, edges, mockOnNodeUpdate);
            await (
                engine as unknown as {
                    executeNodeSync: (id: string) => Promise<void>;
                }
            ).executeNodeSync("1");

            expect(mockExecute).toHaveBeenCalled();
            expect(mockOnNodeUpdate).toHaveBeenCalledWith("1", {
                executing: true,
            });
            expect(mockOnNodeUpdate).toHaveBeenCalledWith(
                "1",
                expect.objectContaining({
                    output: "result",
                    executing: false,
                }),
            );

            expect(
                (
                    engine as unknown as {
                        executionResults: Map<string, unknown>;
                    }
                ).executionResults.get("1"),
            ).toEqual({
                output: "result",
            });
        });

        it("should capture and store error on execution failure", async () => {
            const nodes: Node<NodeData>[] = [
                {
                    id: "error-node",
                    data: {
                        type: "llm",
                        model: "m",
                        instructions: "i",
                        name: "LLM",
                    } as LLMData,
                    position: { x: 0, y: 0 },
                } as Node<LLMData> as unknown as Node<NodeData>,
            ];
            const edges: Edge[] = [];

            const mockError = new Error("Execution failed");
            const mockExecute = vi.fn().mockRejectedValue(mockError);
            const mockGatherInputs = vi.fn().mockReturnValue({});

            (getNodeDefinition as Mock).mockReturnValue({
                gatherInputs: mockGatherInputs,
                execute: mockExecute,
            });

            const engine = new WorkflowEngine(nodes, edges, mockOnNodeUpdate);
            await expect(
                (
                    engine as unknown as {
                        executeNodeSync: (id: string) => Promise<void>;
                    }
                ).executeNodeSync("error-node"),
            ).rejects.toThrow("Execution failed");

            expect(mockOnNodeUpdate).toHaveBeenCalledWith("error-node", {
                executing: false,
                error: "Execution failed",
            });
        });
    });

    describe("Recursive Execution (Sub-graphs)", () => {
        it("should execute a custom-workflow node by running its sub-graph", async () => {
            const nodes = [
                { id: "input-node", type: "text", data: { type: "text", text: "hello", name: "Text" } },
                { 
                    id: "sub-workflow-node", 
                    type: "custom-workflow", 
                    data: { 
                        type: "custom-workflow", 
                        subWorkflowId: "flow-b", 
                        subWorkflowVersion: "1.0.1",
                        name: "Sub"
                    } 
                },
                { id: "output-node", type: "text", data: { type: "text", text: "", name: "Text" } }
            ] as unknown as Node<NodeData>[];

            const edges = [
                { id: "e1", source: "input-node", target: "sub-workflow-node", targetHandle: "sub-in-1" },
                { id: "e2", source: "sub-workflow-node", sourceHandle: "sub-out-1", target: "output-node" }
            ];

            // Sub-workflow definition
            const subFlow = {
                nodes: [
                    { id: "sub-in-1", type: "workflow-input", data: { type: "workflow-input", portName: "in", name: "In" } },
                    { id: "sub-out-1", type: "workflow-output", data: { type: "workflow-output", portName: "out", name: "Out" } }
                ],
                edges: [
                    { id: "se1", source: "sub-in-1", target: "sub-out-1" }
                ]
            };

            // Mock fetch for sub-workflow
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => subFlow
            });

            // Mock node definitions
            vi.mocked(getNodeDefinition).mockImplementation((type) => {
                if (type === 'text') return {
                    type: 'text',
                    gatherInputs: () => ({}),
                    execute: async (node: any, inputs: any) => ({ ...node.data, ...inputs })
                } as any;
                if (type === 'workflow-input') return {
                    type: 'workflow-input',
                    gatherInputs: () => ({}),
                    execute: async (node: any) => ({ ...node.data })
                } as any;
                if (type === 'workflow-output') return {
                    type: 'workflow-output',
                    gatherInputs: (node: any, edges: any, getSourceData: any) => ({ value: getSourceData(edges.find((e: any) => e.target === node.id)?.source || "") }),
                    execute: async (node: any, inputs: any) => ({ ...node.data, ...inputs })
                } as any;
                if (type === 'custom-workflow') return {
                    type: 'custom-workflow',
                    gatherInputs: (node: any, edges: any, getSourceData: any) => {
                        const inputs: any = {};
                        edges.filter((e: any) => e.target === node.id).forEach((e: any) => {
                            inputs[e.targetHandle!] = getSourceData(e.source);
                        });
                        return inputs;
                    },
                    execute: async () => ({})
                } as any;
                return undefined;
            });

            const engine = new WorkflowEngine(nodes, edges, mockOnNodeUpdate, { fetch: mockFetch });
            await engine.run();

            // Verify fetch was called
            expect(mockFetch).toHaveBeenCalled();

            // Verify results
            const subWorkflowResult = engine.executionResults.get("sub-workflow-node");
            expect(subWorkflowResult).toBeDefined();
            // In our implementation, the result of custom-workflow is a map of outputNodeId -> data
            expect((subWorkflowResult as any)["sub-out-1"]).toBeDefined();
            expect((subWorkflowResult as any)["sub-out-1"].value.text).toBe("hello");
        });
    });
});
