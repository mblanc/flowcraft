import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStoreState = {
    setEdges: vi.fn(),
    addNodeWithType: vi.fn(),
    addNode: vi.fn(),
};

vi.mock("@/lib/store/use-flow-store", () => ({
    useFlowStore: Object.assign(
        (selector: (s: unknown) => unknown) => selector(mockStoreState),
        { getState: () => mockStoreState },
    ),
}));

vi.mock("@/lib/node-registry", () => ({
    getSourcePortType: vi.fn().mockReturnValue("image"),
    getTargetPortType: vi.fn().mockReturnValue("image"),
    getNodeDefinition: vi.fn().mockReturnValue({ type: "image" }),
}));

vi.mock("@/lib/utils", () => ({
    isTypeCompatible: vi.fn().mockReturnValue(true),
}));

vi.mock("@/components/flow-canvas/flow-constants", () => ({
    nativeItems: [],
}));

vi.mock("uuid", () => ({ v4: () => "mock-uuid" }));

import { useNodeConnection } from "../hooks/use-node-connection";

describe("useNodeConnection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const defaultArgs = {
        rfInstance: null,
        nodeDataMap: {},
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
});
