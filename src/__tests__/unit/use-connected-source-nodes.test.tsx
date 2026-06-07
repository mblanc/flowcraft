import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const mockUseFlowStore = vi.fn();

vi.mock("@/lib/store/use-flow-store", () => ({
    useFlowStore: (selector: (state: unknown) => unknown) =>
        mockUseFlowStore(selector),
}));

import { useConnectedSourceNodes } from "../hooks/use-connected-source-nodes";

type MockState = {
    edges: Array<{
        id: string;
        source: string;
        target: string;
        targetHandle?: string;
    }>;
    nodes: Array<{ id: string; data: { name: string; type: string } }>;
};

function setupStore(state: MockState) {
    mockUseFlowStore.mockImplementation((selector: (s: MockState) => unknown) =>
        selector(state),
    );
}

describe("useConnectedSourceNodes", () => {
    it("returns empty array when there are no edges", () => {
        setupStore({ edges: [], nodes: [] });

        const { result } = renderHook(() => useConnectedSourceNodes("node-1"));
        expect(result.current).toEqual([]);
    });

    it("returns connected source nodes for a target node", () => {
        setupStore({
            nodes: [{ id: "src-1", data: { name: "Source", type: "image" } }],
            edges: [
                {
                    id: "e1",
                    source: "src-1",
                    target: "node-1",
                    targetHandle: "input",
                },
            ],
        });

        const { result } = renderHook(() => useConnectedSourceNodes("node-1"));
        expect(result.current).toEqual([{ id: "src-1", name: "Source" }]);
    });

    it("excludes edges targeting other nodes", () => {
        setupStore({
            nodes: [
                { id: "src-1", data: { name: "A", type: "image" } },
                { id: "src-2", data: { name: "B", type: "text" } },
            ],
            edges: [
                { id: "e1", source: "src-1", target: "node-1" },
                { id: "e2", source: "src-2", target: "node-99" },
            ],
        });

        const { result } = renderHook(() => useConnectedSourceNodes("node-1"));
        expect(result.current).toEqual([{ id: "src-1", name: "A" }]);
    });

    it("filters by targetHandle when specified", () => {
        setupStore({
            nodes: [
                { id: "src-1", data: { name: "A", type: "image" } },
                { id: "src-2", data: { name: "B", type: "text" } },
            ],
            edges: [
                {
                    id: "e1",
                    source: "src-1",
                    target: "node-1",
                    targetHandle: "handle-a",
                },
                {
                    id: "e2",
                    source: "src-2",
                    target: "node-1",
                    targetHandle: "handle-b",
                },
            ],
        });

        const { result } = renderHook(() =>
            useConnectedSourceNodes("node-1", "handle-a"),
        );
        expect(result.current).toEqual([{ id: "src-1", name: "A" }]);
    });

    it("omits edges whose source node is not found", () => {
        setupStore({
            nodes: [],
            edges: [{ id: "e1", source: "ghost", target: "node-1" }],
        });

        const { result } = renderHook(() => useConnectedSourceNodes("node-1"));
        expect(result.current).toEqual([]);
    });
});
