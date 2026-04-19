/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { WorkflowEngine } from "../lib/workflow-engine";
import { Node, Edge } from "@xyflow/react";
import {
    NodeData,
    TextData,
    LLMData,
    ImageData as FlowImageData,
    CustomWorkflowData,
    NodeInputs,
} from "../lib/types";
import { getNodeDefinition, NodeDefinition } from "../lib/node-registry";
import { routerNodeDefinition } from "../lib/nodes/router-node";
import { imageNodeDefinition } from "../lib/nodes/image-node";

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
                        groundingGoogleSearch: false,
                        groundingImageSearch: false,
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
                {
                    id: "input-node",
                    type: "text",
                    data: { type: "text", text: "hello", name: "Text" },
                },
                {
                    id: "sub-workflow-node",
                    type: "custom-workflow",
                    data: {
                        type: "custom-workflow",
                        subWorkflowId: "flow-b",
                        subWorkflowVersion: "1.0.1",
                        name: "Sub",
                    },
                },
                {
                    id: "output-node",
                    type: "text",
                    data: { type: "text", text: "", name: "Text" },
                },
            ] as unknown as Node<NodeData>[];

            const edges = [
                {
                    id: "e1",
                    source: "input-node",
                    target: "sub-workflow-node",
                    targetHandle: "sub-in-1",
                },
                {
                    id: "e2",
                    source: "sub-workflow-node",
                    sourceHandle: "sub-out-1",
                    target: "output-node",
                },
            ];

            // Sub-workflow definition
            const subFlow = {
                nodes: [
                    {
                        id: "sub-in-1",
                        type: "workflow-input",
                        data: {
                            type: "workflow-input",
                            portName: "in",
                            name: "In",
                        },
                    },
                    {
                        id: "sub-out-1",
                        type: "workflow-output",
                        data: {
                            type: "workflow-output",
                            portName: "out",
                            name: "Out",
                        },
                    },
                ],
                edges: [{ id: "se1", source: "sub-in-1", target: "sub-out-1" }],
            };

            // Mock fetch for sub-workflow
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => subFlow,
            });

            // Mock node definitions
            vi.mocked(getNodeDefinition).mockImplementation((type) => {
                if (type === "text")
                    return {
                        type: "text",
                        gatherInputs: () => ({}),
                        execute: async (
                            node: Node<NodeData>,
                            inputs: unknown,
                        ) => ({
                            ...node.data,
                            ...(inputs as object),
                        }),
                    } as unknown as NodeDefinition<NodeData, NodeInputs>;
                if (type === "workflow-input")
                    return {
                        type: "workflow-input",
                        gatherInputs: () => ({}),
                        execute: async (node: Node<NodeData>) => ({
                            ...node.data,
                        }),
                    } as unknown as NodeDefinition<NodeData, NodeInputs>;
                if (type === "workflow-output")
                    return {
                        type: "workflow-output",
                        gatherInputs: (
                            node: Node<NodeData>,
                            edges: Edge[],
                            getSourceData: (id: string) => NodeData | null,
                        ) => ({
                            value: getSourceData(
                                edges.find((e) => e.target === node.id)
                                    ?.source || "",
                            ),
                        }),
                        execute: async (
                            node: Node<NodeData>,
                            inputs: unknown,
                        ) => ({
                            ...node.data,
                            ...(inputs as object),
                        }),
                    } as unknown as NodeDefinition<NodeData, NodeInputs>;
                if (type === "custom-workflow")
                    return {
                        type: "custom-workflow",
                        gatherInputs: (
                            node: Node<NodeData>,
                            edges: Edge[],
                            getSourceData: (id: string) => NodeData | null,
                        ) => {
                            const inputs: Record<string, unknown> = {};
                            edges
                                .filter((e) => e.target === node.id)
                                .forEach((e) => {
                                    inputs[e.targetHandle!] = getSourceData(
                                        e.source,
                                    );
                                });
                            return inputs;
                        },
                        execute: async () => ({}),
                    } as unknown as NodeDefinition<NodeData, NodeInputs>;
                return undefined;
            });

            const engine = new WorkflowEngine(nodes, edges, mockOnNodeUpdate, {
                fetch: mockFetch,
            });
            await engine.run();

            // Verify fetch was called
            expect(mockFetch).toHaveBeenCalled();

            // Verify results
            const subWorkflowResult = engine.executionResults.get(
                "sub-workflow-node",
            ) as CustomWorkflowData;
            expect(subWorkflowResult).toBeDefined();
            // In our implementation, the result of custom-workflow is { results: { outputNodeId: data } }
            expect(subWorkflowResult.results?.["sub-out-1"]).toBeDefined();
            expect(
                (
                    subWorkflowResult.results?.["sub-out-1"] as {
                        value: TextData;
                    }
                ).value.text,
            ).toBe("hello");
        });
    });

    describe("Batching & mergeResults", () => {
        it("should detect batch plan and execute in batches", async () => {
            const nodes = [
                {
                    id: "batch-node",
                    data: { type: "llm", name: "LLM" },
                },
            ] as unknown as Node<NodeData>[];
            const edges: Edge[] = [];

            const mockExecute = vi
                .fn()
                .mockImplementation(async (n, inputs) => {
                    // Return something that can be merged by mergeResults
                    return {
                        output: `result-${inputs.namedNodes[0].textValue}`,
                    };
                });

            vi.mocked(getNodeDefinition).mockReturnValue({
                gatherInputs: () => ({
                    namedNodes: [{ nodeId: "1", textValues: ["a", "b"] }],
                }),
                execute: mockExecute,
            } as any);

            const engine = new WorkflowEngine(nodes, edges, mockOnNodeUpdate);
            await engine.executeNode("batch-node");

            const result = engine.executionResults.get("batch-node") as any;
            expect(result.outputs).toEqual(["result-a", "result-b"]);
            expect(result.batchTotal).toBe(2);
            expect(mockExecute).toHaveBeenCalledTimes(2);
        });

        it("should handle batch inputs slicing for files", async () => {
            const nodes = [
                {
                    id: "batch-img",
                    data: { type: "image", name: "Image Node" },
                },
            ] as unknown as Node<NodeData>[];

            const mockExecute = vi
                .fn()
                .mockResolvedValue({ images: ["out.png"] });
            vi.mocked(getNodeDefinition).mockReturnValue({
                gatherInputs: () => ({
                    namedNodes: [
                        {
                            nodeId: "1",
                            fileValuesList: [
                                [{ url: "img1.png" }],
                                [{ url: "img2.png" }],
                            ],
                        },
                    ],
                }),
                execute: mockExecute,
            } as any);

            const engine = new WorkflowEngine(nodes, [], mockOnNodeUpdate);
            await engine.executeNode("batch-img");

            const result = engine.executionResults.get("batch-img") as any;
            expect(result.images).toEqual(["out.png", "out.png"]); // two iterations
            expect(mockExecute).toHaveBeenCalledTimes(2);
        });
    });

    describe("executeNode upstream router auto-execution", () => {
        it("should auto-execute upstream router before target node so image passes through", async () => {
            const nodes = [
                {
                    id: "img1",
                    data: {
                        type: "image",
                        name: "Image1",
                        images: ["gs://bucket/uuid-no-extension"],
                        prompt: "p",
                        aspectRatio: "1:1",
                        model: "gemini-2.5-flash-image",
                        resolution: "1K",
                        groundingGoogleSearch: false,
                        groundingImageSearch: false,
                    },
                },
                {
                    id: "router1",
                    data: { type: "router", name: "Router" },
                },
                {
                    id: "img2",
                    data: {
                        type: "image",
                        name: "Image2",
                        images: [],
                        prompt: "q",
                        aspectRatio: "1:1",
                        model: "gemini-2.5-flash-image",
                        resolution: "1K",
                        groundingGoogleSearch: false,
                        groundingImageSearch: false,
                    },
                },
            ] as unknown as Node<NodeData>[];

            const edges = [
                {
                    id: "e1",
                    source: "img1",
                    target: "router1",
                    targetHandle: "input",
                    sourceHandle: null,
                },
                {
                    id: "e2",
                    source: "router1",
                    target: "img2",
                    targetHandle: "image-input",
                    sourceHandle: "output",
                },
            ] as Edge[];

            const capturedInputs: Record<string, unknown> = {};
            vi.mocked(getNodeDefinition).mockImplementation((type) => {
                if (type === "router")
                    return routerNodeDefinition as unknown as NodeDefinition<
                        NodeData,
                        NodeInputs
                    >;
                if (type === "image")
                    return {
                        type: "image",
                        gatherInputs: imageNodeDefinition.gatherInputs,
                        execute: vi
                            .fn()
                            .mockImplementation(async (node, inputs) => {
                                capturedInputs[node.id] = inputs;
                                return { images: ["gs://result.png"] };
                            }),
                    } as unknown as NodeDefinition<NodeData, NodeInputs>;
                return undefined;
            });

            const engine = new WorkflowEngine(nodes, edges, mockOnNodeUpdate);
            await engine.executeNode("img2");

            const img2Inputs = capturedInputs["img2"] as Record<
                string,
                unknown
            >;
            expect(img2Inputs).toBeDefined();
            const namedNodes = img2Inputs.namedNodes as Array<{
                fileValues: { url: string; type: string }[];
            }>;
            expect(namedNodes).toBeDefined();
            const routerEntry = namedNodes.find(
                (n) => n.fileValues && n.fileValues.length > 0,
            );
            expect(routerEntry).toBeDefined();
            expect(routerEntry!.fileValues[0]).toEqual({
                url: "gs://bucket/uuid-no-extension",
                type: "image/png",
            });
        });
    });

    describe("runFromNode", () => {
        it("should only run nodes downstream of the given node", async () => {
            const nodes = [
                { id: "1", data: { type: "text" } },
                { id: "2", data: { type: "text" } },
                { id: "3", data: { type: "text" } },
            ] as unknown as Node<NodeData>[];
            const edges = [
                { id: "e1", source: "1", target: "2" },
                { id: "e2", source: "2", target: "3" },
            ] as Edge[];

            const mockExecute = vi.fn().mockResolvedValue({});
            vi.mocked(getNodeDefinition).mockReturnValue({
                gatherInputs: () => ({}),
                execute: mockExecute,
            } as any);

            const engine = new WorkflowEngine(nodes, edges, mockOnNodeUpdate);
            await engine.runFromNode("2");

            expect(mockExecute).toHaveBeenCalledTimes(2); // node 2 and 3, but not 1
            expect(engine.executionResults.has("2")).toBe(true);
            expect(engine.executionResults.has("3")).toBe(true);
            expect(engine.executionResults.has("1")).toBe(false);
        });
    });
});
