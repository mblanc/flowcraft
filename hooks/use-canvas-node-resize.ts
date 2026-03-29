import { useState, useEffect, useRef, useCallback } from "react";
import { useCanvasStore } from "@/lib/store/use-canvas-store";

interface UseCanvasNodeResizeOptions {
    defaultWidth: number;
    defaultHeight: number;
    minWidth: number;
    minHeight: number;
}

export function useCanvasNodeResize(
    id: string,
    dataWidth: number | undefined,
    dataHeight: number | undefined,
    options: UseCanvasNodeResizeOptions,
) {
    const { defaultWidth, defaultHeight, minWidth, minHeight } = options;
    const updateNode = useCanvasStore((state) => state.updateNode);

    const [dimensions, setDimensions] = useState({
        width: dataWidth || defaultWidth,
        height: dataHeight || defaultHeight,
    });
    const [prevDataWidth, setPrevDataWidth] = useState(dataWidth);
    const [prevDataHeight, setPrevDataHeight] = useState(dataHeight);
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

    if (dataWidth !== prevDataWidth || dataHeight !== prevDataHeight) {
        setPrevDataWidth(dataWidth);
        setPrevDataHeight(dataHeight);
        setDimensions({
            width: dataWidth || defaultWidth,
            height: dataHeight || defaultHeight,
        });
    }

    const handleResizeStart = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            setIsResizing(true);
            resizeStartRef.current = {
                x: e.clientX,
                y: e.clientY,
                width: dimensions.width,
                height: dimensions.height,
            };
        },
        [dimensions.width, dimensions.height],
    );

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - resizeStartRef.current.x;
            const deltaY = e.clientY - resizeStartRef.current.y;
            setDimensions({
                width: Math.max(
                    minWidth,
                    resizeStartRef.current.width + deltaX,
                ),
                height: Math.max(
                    minHeight,
                    resizeStartRef.current.height + deltaY,
                ),
            });
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            updateNode(id, {
                width: dimensions.width,
                height: dimensions.height,
            });
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [
        isResizing,
        id,
        updateNode,
        dimensions.width,
        dimensions.height,
        minWidth,
        minHeight,
    ]);

    return { dimensions, handleResizeStart, isResizing };
}
