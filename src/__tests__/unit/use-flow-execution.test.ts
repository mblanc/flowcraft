/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFlowExecution } from "../hooks/use-flow-execution";
import { useFlowStore } from "../lib/store/use-flow-store";

vi.mock("../lib/store/use-flow-store", () => ({
    useFlowStore: Object.assign(vi.fn(), {
        getState: vi.fn(() => ({
            nodes: [{ id: "1", selected: true }],
            edges: [],
            updateNodeData: vi.fn(),
        })),
    }),
}));

// Mock the WorkflowEngine
vi.mock("../lib/workflow-engine", () => ({
    WorkflowEngine: vi.fn().mockImplementation(() => ({
        run: vi.fn().mockResolvedValue(undefined),
        executeNode: vi.fn().mockResolvedValue(undefined),
        runFromNode: vi.fn().mockResolvedValue(undefined),
    })),
}));

describe("useFlowExecution", () => {
    it("should return and execute functions", async () => {
        const setIsRunning = vi.fn();
        vi.mocked(useFlowStore).mockImplementation((selector: any) =>
            selector({ setIsRunning }),
        );
        const { result } = renderHook(() => useFlowExecution());
        expect(result.current.runFlow).toBeDefined();

        await act(async () => {
            await result.current.runFlow();
            await result.current.runSelectedNodes();
            await result.current.runFromNode("1");
            await result.current.executeNode("1");
        });

        expect(setIsRunning).toHaveBeenCalled();
    });
});
