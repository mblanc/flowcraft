import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStore = {
    addNodeWithType: vi.fn(),
    addNode: vi.fn(),
    updateNodeData: vi.fn(),
};

vi.mock("@/lib/store/use-flow-store", () => ({
    useFlowStore: (selector: (s: unknown) => unknown) => selector(mockStore),
}));

vi.mock("zustand/react/shallow", () => ({
    useShallow: (selector: (s: unknown) => unknown) => selector,
}));

vi.mock("@/app/logger", () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { useFlowDragDrop } from "../hooks/use-flow-drag-drop";

function makeDragEvent(overrides: Partial<DragEvent> = {}): React.DragEvent {
    return {
        preventDefault: vi.fn(),
        dataTransfer: {
            setData: vi.fn(),
            getData: vi.fn().mockReturnValue(""),
            effectAllowed: "none",
            dropEffect: "none",
        } as unknown as DataTransfer,
        clientX: 100,
        clientY: 100,
        ...overrides,
    } as unknown as React.DragEvent;
}

describe("useFlowDragDrop", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns the expected callback functions", () => {
        const { result } = renderHook(() => useFlowDragDrop(null));
        expect(typeof result.current.onDragStart).toBe("function");
        expect(typeof result.current.onCustomNodeDragStart).toBe("function");
        expect(typeof result.current.onDragOver).toBe("function");
        expect(typeof result.current.onDrop).toBe("function");
    });

    it("onDragStart sets dataTransfer data", () => {
        const { result } = renderHook(() => useFlowDragDrop(null));
        const event = makeDragEvent();

        act(() => {
            result.current.onDragStart(event, "llm");
        });

        expect(event.dataTransfer.setData).toHaveBeenCalledWith(
            "application/reactflow",
            "llm",
        );
    });

    it("onCustomNodeDragStart sets dataTransfer for custom-workflow", () => {
        const { result } = renderHook(() => useFlowDragDrop(null));
        const event = makeDragEvent();
        const customNode = {
            id: "wf-1",
            name: "My Flow",
            inputs: [],
            outputs: [],
        };

        act(() => {
            result.current.onCustomNodeDragStart(event, customNode);
        });

        expect(event.dataTransfer.setData).toHaveBeenCalledWith(
            "application/reactflow",
            "custom-workflow",
        );
        expect(event.dataTransfer.setData).toHaveBeenCalledWith(
            "application/custom-node",
            JSON.stringify(customNode),
        );
    });

    it("onDragOver prevents default", () => {
        const { result } = renderHook(() => useFlowDragDrop(null));
        const event = makeDragEvent();

        act(() => {
            result.current.onDragOver(event);
        });

        expect(event.preventDefault).toHaveBeenCalled();
    });

    it("onDrop returns early when rfInstance is null", () => {
        const { result } = renderHook(() => useFlowDragDrop(null));
        const event = makeDragEvent();

        act(() => {
            result.current.onDrop(event);
        });

        expect(mockStore.addNodeWithType).not.toHaveBeenCalled();
    });
});
