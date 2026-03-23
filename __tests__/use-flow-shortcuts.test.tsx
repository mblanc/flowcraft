import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStore = {
    nodes: [],
    edges: [],
    onNodesChange: vi.fn(),
    onEdgesChange: vi.fn(),
    addNode: vi.fn(),
    setEdges: vi.fn(),
    getState: vi.fn(),
};

vi.mock("@/lib/store/use-flow-store", () => ({
    useFlowStore: Object.assign(
        (selector: (s: unknown) => unknown) => selector(mockStore),
        { getState: () => mockStore },
    ),
}));

vi.mock("@/app/logger", () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("uuid", () => ({ v4: () => "mock-uuid" }));

import { useFlowShortcuts } from "../hooks/use-flow-shortcuts";

describe("useFlowShortcuts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it("renders without throwing when rfInstance is null", () => {
        expect(() => {
            renderHook(() => useFlowShortcuts(null));
        }).not.toThrow();
    });

    it("registers and cleans up the keydown listener", () => {
        const addSpy = vi.spyOn(window, "addEventListener");
        const removeSpy = vi.spyOn(window, "removeEventListener");

        const { unmount } = renderHook(() => useFlowShortcuts(null));
        expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

        unmount();
        expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    });

    it("Ctrl+V with empty clipboard does not throw", () => {
        renderHook(() => useFlowShortcuts(null));

        const event = new KeyboardEvent("keydown", {
            key: "v",
            ctrlKey: true,
            bubbles: true,
        });

        expect(() => {
            act(() => {
                window.dispatchEvent(event);
            });
        }).not.toThrow();
    });

    it("Ctrl+C does not copy when rfInstance is null", () => {
        renderHook(() => useFlowShortcuts(null));

        const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

        const event = new KeyboardEvent("keydown", {
            key: "c",
            ctrlKey: true,
            bubbles: true,
        });

        act(() => {
            window.dispatchEvent(event);
        });

        expect(setItemSpy).not.toHaveBeenCalled();
    });

    it("ignores Ctrl+C when fired on editable target", () => {
        renderHook(() => useFlowShortcuts(null));
        const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

        const input = document.createElement("input");
        document.body.appendChild(input);
        input.focus();

        const event = new KeyboardEvent("keydown", {
            key: "c",
            ctrlKey: true,
            bubbles: true,
        });
        Object.defineProperty(event, "target", { value: input });

        act(() => {
            window.dispatchEvent(event);
        });

        expect(setItemSpy).not.toHaveBeenCalled();
        document.body.removeChild(input);
    });
});
