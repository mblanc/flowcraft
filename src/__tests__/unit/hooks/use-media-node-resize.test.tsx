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

    it("does not jump back to defaultWidth when dataHeight updates mid-drag while dataWidth is undefined", () => {
        const dataWidth: number | undefined = undefined;
        let dataHeight: number | undefined = 169;
        const options = {
            defaultWidth: 300,
            defaultHeight: 300,
            minWidth: 150,
            minHeight: 80,
            lockedAspectRatio: 16 / 9,
        };

        const { result, rerender } = renderHook(() =>
            useMediaNodeResize(
                "n1",
                dataWidth,
                dataHeight,
                options,
                mockOnCommit,
            ),
        );

        expect(result.current.dimensions).toEqual({
            width: 300,
            height: 169,
        });

        const startEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 100,
            clientY: 100,
            currentTarget: { parentElement: null },
        } as unknown as React.MouseEvent<HTMLDivElement>;

        act(() => {
            result.current.handleResizeStart(startEvent);
        });

        // Drag out to 420px width
        act(() => {
            document.dispatchEvent(
                new MouseEvent("mousemove", { clientX: 220, clientY: 170 }),
            );
        });

        expect(result.current.dimensions).toEqual({
            width: 420,
            height: Math.round(420 / (16 / 9)),
        });

        // Simulate a mid-drag store update to dataHeight (e.g. from an image onLoad callback)
        dataHeight = 236;
        rerender();

        // Width MUST remain at 420 and NOT reset to defaultWidth (300)
        expect(result.current.dimensions.width).toBe(420);

        // Continue dragging to 480px width and release
        act(() => {
            document.dispatchEvent(
                new MouseEvent("mousemove", { clientX: 280, clientY: 200 }),
            );
            document.dispatchEvent(new MouseEvent("mouseup"));
        });

        expect(result.current.dimensions).toEqual({
            width: 480,
            height: Math.round(480 / (16 / 9)),
        });
        expect(mockOnCommit).toHaveBeenCalledWith("n1", {
            width: 480,
            height: Math.round(480 / (16 / 9)),
        });
    });

    it("never introduces vertical negative space when resizing down across landscape and portrait aspect ratios", () => {
        const ratios = [16 / 9, 21 / 9, 4 / 3, 9 / 16];

        for (const ratio of ratios) {
            const options = {
                defaultWidth: 320,
                defaultHeight: Math.round(320 / ratio),
                minWidth: 200,
                minHeight: 180,
                lockedAspectRatio: ratio,
            };

            const { result } = renderHook(() =>
                useMediaNodeResize(
                    "n1",
                    320,
                    Math.round(320 / ratio),
                    options,
                    mockOnCommit,
                ),
            );

            const startEvent = {
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
                clientX: 300,
                clientY: 300,
                currentTarget: { parentElement: null },
            } as unknown as React.MouseEvent<HTMLDivElement>;

            act(() => {
                result.current.handleResizeStart(startEvent);
            });

            // Drag aggressively down/left past minimum bounds
            for (const delta of [-40, -80, -120, -200, -350]) {
                act(() => {
                    document.dispatchEvent(
                        new MouseEvent("mousemove", {
                            clientX: 300 + delta,
                            clientY: 300 + delta,
                        }),
                    );
                });

                const { width, height } = result.current.dimensions;
                expect(width).toBeGreaterThanOrEqual(options.minWidth);
                expect(height).toBeGreaterThanOrEqual(options.minHeight);
                // Container height must match width / ratio within 1px rounding (zero vertical negative space)
                expect(
                    Math.abs(height - Math.round(width / ratio)),
                ).toBeLessThanOrEqual(1);
            }

            act(() => {
                document.dispatchEvent(new MouseEvent("mouseup"));
            });
        }
    });

    it("does not jump when dragging across the 45-degree diagonal with lockAspectRatio", () => {
        const options = { ...defaultOptions, lockAspectRatio: true };
        const { result } = renderHook(() =>
            useMediaNodeResize("n1", 300, 150, options, mockOnCommit),
        );

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

        // Cross the |deltaX| == |deltaY| diagonal (deltaY goes 49 -> 50 -> 51 while deltaX = 50)
        const recordedWidths: number[] = [];
        for (const dy of [49, 50, 51]) {
            act(() => {
                document.dispatchEvent(
                    new MouseEvent("mousemove", { clientX: 50, clientY: dy }),
                );
            });
            recordedWidths.push(result.current.dimensions.width);
        }

        expect(recordedWidths).toEqual([350, 350, 350]);
        expect(result.current.dimensions.height).toBe(175);

        act(() => {
            document.dispatchEvent(new MouseEvent("mouseup"));
        });
    });

    it("scales mouse deltas by the active ReactFlow viewport zoom", () => {
        const viewport = document.createElement("div");
        viewport.className = "react-flow__viewport";
        viewport.style.transform = "translate(10px, 20px) scale(0.5)";
        const nodeEl = document.createElement("div");
        const handleEl = document.createElement("div");
        nodeEl.appendChild(handleEl);
        viewport.appendChild(nodeEl);
        document.body.appendChild(viewport);

        const { result } = renderHook(() =>
            useMediaNodeResize("n1", 300, 200, defaultOptions, mockOnCommit),
        );

        const startEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 0,
            clientY: 0,
            currentTarget: handleEl,
        } as unknown as React.MouseEvent<HTMLDivElement>;

        act(() => {
            result.current.handleResizeStart(startEvent);
        });

        // At 0.5x zoom, a 50px screen drag corresponds to 100px in canvas coordinates
        act(() => {
            document.dispatchEvent(
                new MouseEvent("mousemove", { clientX: 50, clientY: 25 }),
            );
            document.dispatchEvent(new MouseEvent("mouseup"));
        });

        expect(result.current.dimensions).toEqual({ width: 400, height: 250 });
        document.body.removeChild(viewport);
    });

    it("locks body cursor and userSelect during resize and restores them on mouseup", () => {
        document.body.style.cursor = "default";
        document.body.style.userSelect = "auto";

        const { result } = renderHook(() =>
            useMediaNodeResize("n1", 300, 200, defaultOptions, mockOnCommit),
        );

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

        expect(result.current.isResizing).toBe(true);
        expect(document.body.style.cursor).toBe("se-resize");
        expect(document.body.style.userSelect).toBe("none");

        act(() => {
            document.dispatchEvent(new MouseEvent("mouseup"));
        });

        expect(result.current.isResizing).toBe(false);
        expect(document.body.style.cursor).toBe("default");
        expect(document.body.style.userSelect).toBe("auto");
    });
});
