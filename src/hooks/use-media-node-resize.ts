import { useState, useEffect, useRef, useCallback } from "react";

export interface ResizeOptions {
    defaultWidth: number;
    defaultHeight: number;
    minWidth: number;
    minHeight: number;
    useElementHeight?: boolean;
    lockedAspectRatio?: number; // width / height — when set, height is derived from width
    lockAspectRatio?: boolean; // if true, lock to starting aspect ratio
}

export function useMediaNodeResize(
    id: string,
    dataWidth: number | undefined,
    dataHeight: number | undefined,
    options: ResizeOptions,
    onCommit: (id: string, dims: { width: number; height: number }) => void,
) {
    const {
        defaultWidth,
        defaultHeight,
        minWidth,
        minHeight,
        useElementHeight,
        lockedAspectRatio,
        lockAspectRatio,
    } = options;

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
            const deltaY = e.clientY - resizeStartRef.current.y;

            let newWidth = Math.max(
                minWidth,
                resizeStartRef.current.width + deltaX,
            );
            let newHeight = Math.max(
                minHeight,
                resizeStartRef.current.height + deltaY,
            );

            if (lockedAspectRatio) {
                newHeight = Math.max(
                    minHeight,
                    Math.round(newWidth / lockedAspectRatio),
                );
            } else if (lockAspectRatio) {
                const ratio =
                    resizeStartRef.current.width /
                    resizeStartRef.current.height;
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    newHeight = Math.max(minHeight, newWidth / ratio);
                } else {
                    newWidth = Math.max(minWidth, newHeight * ratio);
                }
            }

            setDimensions({
                width: newWidth,
                height: newHeight,
            });
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            onCommit(id, {
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
        onCommit,
        dimensions.width,
        dimensions.height,
        minWidth,
        minHeight,
        lockedAspectRatio,
        lockAspectRatio,
    ]);

    return { dimensions, handleResizeStart, isResizing };
}
