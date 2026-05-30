import { useState, useEffect, useRef, useCallback } from "react";
import { useFlowStore } from "@/lib/store/use-flow-store";

interface UseNodeResizeOptions {
    defaultWidth: number;
    defaultHeight: number;
    minWidth: number;
    minHeight: number;
    useElementHeight?: boolean;
    lockedAspectRatio?: number; // width / height — when set, height is derived from width
}

export function useNodeResize(
    id: string,
    dataWidth: number | undefined,
    dataHeight: number | undefined,
    options: UseNodeResizeOptions,
) {
    const {
        defaultWidth,
        defaultHeight,
        minWidth,
        minHeight,
        useElementHeight,
        lockedAspectRatio,
    } = options;
    const updateNodeData = useFlowStore((state) => state.updateNodeData);

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
                height: useElementHeight
                    ? e.currentTarget.parentElement?.offsetHeight || minHeight
                    : dimensions.height,
            };
        },
        [useElementHeight, minHeight, dimensions.width, dimensions.height],
    );

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - resizeStartRef.current.x;
            const newWidth = Math.max(
                minWidth,
                resizeStartRef.current.width + deltaX,
            );
            if (lockedAspectRatio) {
                setDimensions({
                    width: newWidth,
                    height: Math.max(
                        minHeight,
                        Math.round(newWidth / lockedAspectRatio),
                    ),
                });
            } else {
                const deltaY = e.clientY - resizeStartRef.current.y;
                setDimensions({
                    width: newWidth,
                    height: Math.max(
                        minHeight,
                        resizeStartRef.current.height + deltaY,
                    ),
                });
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            updateNodeData(id, {
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
        updateNodeData,
        dimensions.width,
        dimensions.height,
        minWidth,
        minHeight,
        lockedAspectRatio,
    ]);

    return { dimensions, handleResizeStart };
}
