// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMediaNodeResize } from "@/hooks/use-media-node-resize";

describe("useMediaNodeResize", () => {
    const defaultOptions = {
        defaultWidth: 300,
        defaultHeight: 200,
        minWidth: 100,
        minHeight: 80,
    };

    const mockOnCommit = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("initialises with provided data dimensions", () => {
        const { result } = renderHook(() =>
            useMediaNodeResize("n1", 400, 250, defaultOptions, mockOnCommit),
        );
        expect(result.current.dimensions).toEqual({ width: 400, height: 250 });
    });

    it("falls back to default dimensions when data dimensions are undefined", () => {
        const { result } = renderHook(() =>
            useMediaNodeResize(
                "n1",
                undefined,
                undefined,
                defaultOptions,
                mockOnCommit,
            ),
        );
        expect(result.current.dimensions).toEqual({
            width: 300,
            height: 200,
        });
    });

    it("syncs dimensions when dataWidth changes", () => {
        let dataWidth = 400;
        const { result, rerender } = renderHook(() =>
            useMediaNodeResize(
                "n1",
                dataWidth,
                200,
                defaultOptions,
                mockOnCommit,
            ),
        );
        expect(result.current.dimensions.width).toBe(400);

        dataWidth = 500;
        rerender();
        expect(result.current.dimensions.width).toBe(500);
    });

    it("updates dimensions and calls onCommit on mouse up after resize", () => {
        const { result } = renderHook(() =>
            useMediaNodeResize("n1", 300, 200, defaultOptions, mockOnCommit),
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

        expect(mockOnCommit).toHaveBeenCalledWith(
            "n1",
            expect.objectContaining({ width: 350, height: 230 }),
        );
    });

    it("supports lockAspectRatio (boolean based on starting ratio)", () => {
        const options = { ...defaultOptions, lockAspectRatio: true };
        const { result } = renderHook(
            () => useMediaNodeResize("n1", 300, 150, options, mockOnCommit), // 2:1 ratio
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

        // Move mouse (deltaX = 100, deltaY = 10 -> deltaX is dominant, so height will be derived)
        act(() => {
            const moveEvent = new MouseEvent("mousemove", {
                clientX: 100,
                clientY: 10,
            });
            document.dispatchEvent(moveEvent);
        });

        act(() => {
            const upEvent = new MouseEvent("mouseup");
            document.dispatchEvent(upEvent);
        });

        // Width = 300 + 100 = 400. Ratio = 2. Height = 400 / 2 = 200.
        expect(mockOnCommit).toHaveBeenCalledWith("n1", {
            width: 400,
            height: 200,
        });
    });

    it("supports lockedAspectRatio (number based on specified ratio)", () => {
        const options = { ...defaultOptions, lockedAspectRatio: 1.5 }; // 3:2 ratio
        const { result } = renderHook(() =>
            useMediaNodeResize("n1", 300, 200, options, mockOnCommit),
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

        act(() => {
            const moveEvent = new MouseEvent("mousemove", {
                clientX: 90,
                clientY: 100,
            });
            document.dispatchEvent(moveEvent);
        });

        act(() => {
            const upEvent = new MouseEvent("mouseup");
            document.dispatchEvent(upEvent);
        });

        // Width = 300 + 90 = 390. Height = 390 / 1.5 = 260.
        expect(mockOnCommit).toHaveBeenCalledWith("n1", {
            width: 390,
            height: 260,
        });
    });
});
