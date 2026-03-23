import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdateNodeData = vi.fn();

vi.mock("@/lib/store/use-flow-store", () => ({
    useFlowStore: (selector: (state: unknown) => unknown) =>
        selector({ updateNodeData: mockUpdateNodeData }),
}));

import { useNodeResize } from "../hooks/use-node-resize";

describe("useNodeResize", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const defaultOptions = {
        defaultWidth: 300,
        defaultHeight: 200,
        minWidth: 100,
        minHeight: 80,
    };

    it("initialises with provided data dimensions", () => {
        const { result } = renderHook(() =>
            useNodeResize("n1", 400, 250, defaultOptions),
        );
        expect(result.current.dimensions).toEqual({ width: 400, height: 250 });
    });

    it("falls back to default dimensions when data dimensions are undefined", () => {
        const { result } = renderHook(() =>
            useNodeResize("n1", undefined, undefined, defaultOptions),
        );
        expect(result.current.dimensions).toEqual({
            width: 300,
            height: 200,
        });
    });

    it("syncs dimensions when dataWidth changes", () => {
        let dataWidth = 400;
        const { result, rerender } = renderHook(() =>
            useNodeResize("n1", dataWidth, 200, defaultOptions),
        );
        expect(result.current.dimensions.width).toBe(400);

        dataWidth = 500;
        rerender();
        expect(result.current.dimensions.width).toBe(500);
    });

    it("syncs dimensions when dataHeight changes", () => {
        let dataHeight = 200;
        const { result, rerender } = renderHook(() =>
            useNodeResize("n1", 300, dataHeight, defaultOptions),
        );
        expect(result.current.dimensions.height).toBe(200);

        dataHeight = 350;
        rerender();
        expect(result.current.dimensions.height).toBe(350);
    });

    it("returns a handleResizeStart function", () => {
        const { result } = renderHook(() =>
            useNodeResize("n1", 300, 200, defaultOptions),
        );
        expect(typeof result.current.handleResizeStart).toBe("function");
    });

    it("handleResizeStart prevents default and stops propagation", () => {
        const { result } = renderHook(() =>
            useNodeResize("n1", 300, 200, defaultOptions),
        );

        const mockEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 100,
            clientY: 200,
            currentTarget: { parentElement: null },
        } as unknown as React.MouseEvent<HTMLDivElement>;

        act(() => {
            result.current.handleResizeStart(mockEvent);
        });

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });

    it("works with useElementHeight option", () => {
        const options = { ...defaultOptions, useElementHeight: true };
        const { result } = renderHook(() =>
            useNodeResize("n1", 300, 200, options),
        );

        const parentEl = { offsetHeight: 150 };
        const mockEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 100,
            clientY: 200,
            currentTarget: { parentElement: parentEl },
        } as unknown as React.MouseEvent<HTMLDivElement>;

        act(() => {
            result.current.handleResizeStart(mockEvent);
        });

        expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("updates node data on mouse up after resize", () => {
        const { result } = renderHook(() =>
            useNodeResize("n1", 300, 200, defaultOptions),
        );

        // Start resize
        const startEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 0,
            clientY: 0,
            currentTarget: { parentElement: null },
        } as unknown as React.MouseEvent<HTMLDivElement>;

        act(() => {
            result.current.handleResizeStart(startEvent);
        });

        // Simulate mouse move then mouse up
        act(() => {
            const moveEvent = new MouseEvent("mousemove", {
                clientX: 50,
                clientY: 30,
            });
            document.dispatchEvent(moveEvent);
        });

        act(() => {
            const upEvent = new MouseEvent("mouseup");
            document.dispatchEvent(upEvent);
        });

        expect(mockUpdateNodeData).toHaveBeenCalledWith(
            "n1",
            expect.objectContaining({ width: expect.any(Number) }),
        );
    });
});
