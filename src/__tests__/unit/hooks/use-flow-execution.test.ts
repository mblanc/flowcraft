/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFlowExecution } from "@/hooks/use-flow-execution";
import { WorkflowEngine } from "@/lib/flow/workflow-engine";

vi.mock("next-auth/react", () => ({
    useSession: vi.fn(() => ({ data: { user: { id: "session-user-id" } } })),
}));

vi.mock("@/lib/store/use-flow-store", () => ({
    useFlowStore: Object.assign(vi.fn(), {
        getState: vi.fn(() => ({
            nodes: [{ id: "1", selected: true }],
            edges: [],
            updateNodeData: vi.fn(),
            flowId: undefined,
            flowName: undefined,
        })),
    }),
}));

vi.mock("@/lib/flow/workflow-engine", () => ({
    WorkflowEngine: vi.fn().mockImplementation(function (this: any) {
        this.executeNodeWithRouterResolution = vi
            .fn()
            .mockResolvedValue(undefined);
        this.runFromNode = vi.fn().mockResolvedValue(undefined);
        this.runToNode = vi.fn().mockResolvedValue(undefined);
    }),
}));

const mockLoggerError = vi.fn();
vi.mock("@/app/logger", () => ({
    default: { error: (...args: unknown[]) => mockLoggerError(...args) },
}));

describe("useFlowExecution", () => {
    beforeEach(() => {
        vi.mocked(WorkflowEngine).mockClear();
        mockLoggerError.mockClear();
    });

    it("should expose executeNode, runFromNode, and runToNode", () => {
        const { result } = renderHook(() => useFlowExecution());

        expect(result.current.executeNode).toBeDefined();
        expect(result.current.runFromNode).toBeDefined();
        expect(result.current.runToNode).toBeDefined();
    });

    it("runFromNode calls engine.runFromNode with the given nodeId", async () => {
        const { result } = renderHook(() => useFlowExecution());
        await act(async () => {
            await result.current.runFromNode("node-1");
        });

        const instance = vi.mocked(WorkflowEngine).mock.instances[0] as any;
        expect(instance.runFromNode).toHaveBeenCalledWith("node-1");
    });

    it("executeNode calls engine.executeNodeWithRouterResolution with the given nodeId", async () => {
        const { result } = renderHook(() => useFlowExecution());
        await act(async () => {
            await result.current.executeNode("node-2");
        });

        const instance = vi.mocked(WorkflowEngine).mock.instances[0] as any;
        expect(instance.executeNodeWithRouterResolution).toHaveBeenCalledWith(
            "node-2",
        );
    });

    it("runToNode calls engine.runToNode with the given nodeId", async () => {
        const { result } = renderHook(() => useFlowExecution());
        await act(async () => {
            await result.current.runToNode("node-3");
        });

        const instance = vi.mocked(WorkflowEngine).mock.instances[0] as any;
        expect(instance.runToNode).toHaveBeenCalledWith("node-3");
    });

    it("executeNode swallows engine errors and logs them", async () => {
        vi.mocked(WorkflowEngine).mockImplementationOnce(function (this: any) {
            this.executeNodeWithRouterResolution = vi
                .fn()
                .mockRejectedValue(new Error("exec failed"));
        });
        const { result } = renderHook(() => useFlowExecution());
        await expect(
            act(async () => {
                await result.current.executeNode("node-x");
            }),
        ).resolves.toBeUndefined();
        expect(mockLoggerError).toHaveBeenCalledWith(
            "Error executing node:",
            expect.any(Error),
        );
    });

    it("runFromNode swallows engine errors and logs them", async () => {
        vi.mocked(WorkflowEngine).mockImplementationOnce(function (this: any) {
            this.runFromNode = vi
                .fn()
                .mockRejectedValue(new Error("run-from failed"));
        });
        const { result } = renderHook(() => useFlowExecution());
        await expect(
            act(async () => {
                await result.current.runFromNode("node-x");
            }),
        ).resolves.toBeUndefined();
        expect(mockLoggerError).toHaveBeenCalledWith(
            "Error running from node:",
            expect.any(Error),
        );
    });

    it("runToNode swallows engine errors and logs them", async () => {
        vi.mocked(WorkflowEngine).mockImplementationOnce(function (this: any) {
            this.runToNode = vi
                .fn()
                .mockRejectedValue(new Error("run-to failed"));
        });
        const { result } = renderHook(() => useFlowExecution());
        await expect(
            act(async () => {
                await result.current.runToNode("node-x");
            }),
        ).resolves.toBeUndefined();
        expect(mockLoggerError).toHaveBeenCalledWith(
            "Error running to node:",
            expect.any(Error),
        );
    });
});
