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
    });
});
