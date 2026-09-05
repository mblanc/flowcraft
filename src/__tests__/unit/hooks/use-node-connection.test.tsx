import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactFlowInstance, Node, OnConnectEnd } from "@xyflow/react";
import type { NodeData, VideoData, NodeType } from "@/lib/types";

const mockStoreState = {
    setEdges: vi.fn(),
    addNodeWithType: vi.fn(),
    addNode: vi.fn(),
    onConnect: vi.fn(),
    nodes: [] as Node<NodeData>[],
};

vi.mock("@/lib/store/use-flow-store", () => ({
    useFlowStore: Object.assign(
        (selector: (s: unknown) => unknown) => selector(mockStoreState),
        { getState: () => mockStoreState },
    ),
}));

const mockGetSourcePortType = vi.fn().mockReturnValue("image");
const mockGetTargetPortType = vi.fn().mockReturnValue("image");
const mockGetNodeDefinition = vi.fn().mockReturnValue({
    type: "image",
    outputs: { "result-output": "image" },
    inputs: { "image-input": "image" },
});

vi.mock("@/lib/flow/node-registry", () => ({
    getSourcePortType: (node: Node<NodeData>, handleId?: string | null) =>
        mockGetSourcePortType(node, handleId),
    getTargetPortType: (node: Node<NodeData>, handleId?: string | null) =>
        mockGetTargetPortType(node, handleId),
    getNodeDefinition: (type: NodeType) => mockGetNodeDefinition(type),
}));

vi.mock("@/lib/utils", () => ({
    isTypeCompatible: vi.fn((a, b) => a === b || a === "any" || b === "any"),
}));

vi.mock("@/components/flow/flow-constants", () => ({
    nativeItems: [],
}));

vi.mock("uuid", () => ({ v4: () => "mock-uuid" }));

import { useNodeConnection } from "@/hooks/use-node-connection";

describe("useNodeConnection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStoreState.nodes = [];
        mockGetSourcePortType.mockReturnValue("image");
        mockGetTargetPortType.mockReturnValue("image");
        mockGetNodeDefinition.mockReturnValue({
            type: "image",
            outputs: { "result-output": "image" },
            inputs: { "image-input": "image" },
        });
    });

    const defaultArgs = {
        rfInstance: {
            screenToFlowPosition: vi.fn((pos) => pos),
        } as unknown as ReactFlowInstance,
        nodeDataMap: {
            "node-1": {
                type: "video",
                name: "Video 1",
            } as unknown as VideoData,
        },
        edges: [],
        customNodes: [],
    };

    it("initialises without throwing", () => {
        expect(() => {
            renderHook(() =>
                useNodeConnection(
                    defaultArgs.rfInstance,
                    defaultArgs.nodeDataMap,
                    defaultArgs.edges,
                    defaultArgs.customNodes,
                ),
            );
        }).not.toThrow();
    });

    it("returns expected shape", () => {
        const { result } = renderHook(() =>
            useNodeConnection(
                defaultArgs.rfInstance,
                defaultArgs.nodeDataMap,
                defaultArgs.edges,
                defaultArgs.customNodes,
            ),
        );

        expect(typeof result.current.onConnectStart).toBe("function");
        expect(typeof result.current.onConnectEnd).toBe("function");
        expect(typeof result.current.clearConnectionParams).toBe("function");
        expect(typeof result.current.handleSelectDropdownNode).toBe("function");
        expect(result.current.dropdownOpen).toBe(false);
        expect(result.current.connectionStartParams).toBeNull();
    });

    it("onConnectStart stores connection params", () => {
        const { result } = renderHook(() =>
            useNodeConnection(
                defaultArgs.rfInstance,
                defaultArgs.nodeDataMap,
                defaultArgs.edges,
                defaultArgs.customNodes,
            ),
        );

        const params = {
            nodeId: "node-1",
            handleId: "output",
            handleType: "source" as const,
        };

        act(() => {
            result.current.onConnectStart({} as MouseEvent, params);
        });

        expect(result.current.connectionStartParams).toEqual(params);
    });

    it("clearConnectionParams resets connection state", () => {
        const { result } = renderHook(() =>
            useNodeConnection(
                defaultArgs.rfInstance,
                defaultArgs.nodeDataMap,
                defaultArgs.edges,
                defaultArgs.customNodes,
            ),
        );

        act(() => {
            result.current.onConnectStart({} as MouseEvent, {
                nodeId: "n1",
                handleId: "h1",
                handleType: "source" as const,
            });
        });

        act(() => {
            result.current.clearConnectionParams();
        });

        expect(result.current.connectionStartParams).toBeNull();
    });

    it("compatibleNodes is empty when connectionStartParams is null", () => {
        const { result } = renderHook(() =>
            useNodeConnection(
                defaultArgs.rfInstance,
                defaultArgs.nodeDataMap,
                defaultArgs.edges,
                defaultArgs.customNodes,
            ),
        );

        expect(result.current.compatibleNodes).toEqual({
            native: [],
            custom: [],
        });
    });

    it("connects new node when dragging from a target handle (input)", () => {
        const { result } = renderHook(() =>
            useNodeConnection(
                defaultArgs.rfInstance,
                defaultArgs.nodeDataMap,
                defaultArgs.edges,
                defaultArgs.customNodes,
            ),
        );

        // Start drag on target handle "image-input" of Video node
        act(() => {
            result.current.onConnectStart({} as MouseEvent, {
                nodeId: "node-1",
                handleId: "image-input",
                handleType: "target",
            });
        });

        // Drop on canvas
        act(() => {
            result.current.onConnectEnd(
                { clientX: 300, clientY: 300 } as unknown as MouseEvent,
                {
                    isValid: false,
                    connection: null,
                } as unknown as Parameters<OnConnectEnd>[1],
            );
        });

        // Select Image node
        act(() => {
            result.current.handleSelectDropdownNode("image");
        });

        expect(mockStoreState.addNode).toHaveBeenCalledTimes(1);
        expect(mockStoreState.onConnect).toHaveBeenCalledWith(
            expect.objectContaining({
                target: "node-1",
                targetHandle: "image-input",
                sourceHandle: "result-output",
            }),
        );
    });

    it("connects new node with empty default handle key when dragging from target handle", () => {
        mockGetNodeDefinition.mockReturnValue({
            type: "file",
            outputs: { "": "any" },
            inputs: {},
        });

        const { result } = renderHook(() =>
            useNodeConnection(
                defaultArgs.rfInstance,
                defaultArgs.nodeDataMap,
                defaultArgs.edges,
                defaultArgs.customNodes,
            ),
        );

        act(() => {
            result.current.onConnectStart({} as MouseEvent, {
                nodeId: "node-1",
                handleId: "image-input",
                handleType: "target",
            });
        });

        act(() => {
            result.current.onConnectEnd(
                { clientX: 300, clientY: 300 } as unknown as MouseEvent,
                {
                    isValid: false,
                    connection: null,
                } as unknown as Parameters<OnConnectEnd>[1],
            );
        });

        act(() => {
            result.current.handleSelectDropdownNode("file");
        });

        expect(mockStoreState.addNode).toHaveBeenCalledTimes(1);
        expect(mockStoreState.onConnect).toHaveBeenCalledWith(
            expect.objectContaining({
                target: "node-1",
                targetHandle: "image-input",
                sourceHandle: null,
            }),
        );
    });

    it("connects new node when dragging from a source handle (output)", () => {
        const { result } = renderHook(() =>
            useNodeConnection(
                defaultArgs.rfInstance,
                defaultArgs.nodeDataMap,
                defaultArgs.edges,
                defaultArgs.customNodes,
            ),
        );

        act(() => {
            result.current.onConnectStart({} as MouseEvent, {
                nodeId: "node-1",
                handleId: "result-output",
                handleType: "source",
            });
        });

        act(() => {
            result.current.onConnectEnd(
                { clientX: 300, clientY: 300 } as unknown as MouseEvent,
                {
                    isValid: false,
                    connection: null,
                } as unknown as Parameters<OnConnectEnd>[1],
            );
        });

        act(() => {
            result.current.handleSelectDropdownNode("image");
        });

        expect(mockStoreState.addNode).toHaveBeenCalledTimes(1);
        expect(mockStoreState.onConnect).toHaveBeenCalledWith(
            expect.objectContaining({
                source: "node-1",
                sourceHandle: "result-output",
                targetHandle: "image-input",
            }),
        );
    });
});
