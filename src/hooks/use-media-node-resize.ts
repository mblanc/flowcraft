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

function getZoomScale(target: HTMLElement | null): number {
    if (!target) return 1;
    const viewportEl = target.closest?.(
        ".react-flow__viewport, .xyflow__viewport",
    ) as HTMLElement | null;
    if (viewportEl?.style?.transform) {
        const match = viewportEl.style.transform.match(/scale\(([^,)]+)/);
        if (match) {
            const scale = parseFloat(match[1]);
            if (Number.isFinite(scale) && scale > 0) {
                return scale;
            }
        }
    }
    const parent = target.parentElement;
    if (parent && parent.offsetWidth > 0) {
        const rect = parent.getBoundingClientRect();
        if (rect.width > 0) {
            const scale = rect.width / parent.offsetWidth;
            if (Number.isFinite(scale) && scale > 0) {
                return scale;
            }
        }
    }
    return 1;
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
    const dimensionsRef = useRef(dimensions);

    useEffect(() => {
        dimensionsRef.current = dimensions;
    }, [dimensions]);

    const [prevDataWidth, setPrevDataWidth] = useState(dataWidth);
    const [prevDataHeight, setPrevDataHeight] = useState(dataHeight);
    const [prevLockedAspectRatio, setPrevLockedAspectRatio] =
        useState(lockedAspectRatio);
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartRef = useRef({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        zoom: 1,
    });

    if (dataWidth !== prevDataWidth || dataHeight !== prevDataHeight) {
        const widthChanged = dataWidth !== prevDataWidth;
        const heightChanged = dataHeight !== prevDataHeight;
        setPrevDataWidth(dataWidth);
        setPrevDataHeight(dataHeight);
        if (!isResizing) {
            setDimensions((prev) => {
                const nextDims = {
                    width: widthChanged
                        ? dataWidth || defaultWidth
                        : dataWidth || prev.width,
                    height: heightChanged
                        ? dataHeight || defaultHeight
                        : dataHeight || prev.height,
                };
                dimensionsRef.current = nextDims;
                return nextDims;
            });
        }
    }

    if (lockedAspectRatio !== prevLockedAspectRatio) {
        setPrevLockedAspectRatio(lockedAspectRatio);
        if (!isResizing && lockedAspectRatio && lockedAspectRatio > 0) {
            setDimensions((prev) => {
                const nextDims = {
                    width: prev.width,
                    height: Math.max(
                        minHeight,
                        Math.round(prev.width / lockedAspectRatio),
                    ),
                };
                dimensionsRef.current = nextDims;
                return nextDims;
            });
        }
    }

    const handleResizeStart = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            const currentTarget = e.currentTarget;
            const zoom = getZoomScale(currentTarget);
            setIsResizing(true);
            resizeStartRef.current = {
                x: e.clientX,
                y: e.clientY,
                width: dimensionsRef.current.width,
                height: useElementHeight
                    ? currentTarget?.parentElement?.offsetHeight || minHeight
                    : dimensionsRef.current.height,
                zoom,
            };
        },
        [useElementHeight, minHeight],
    );

    useEffect(() => {
        if (!isResizing) return;

        const prevCursor = document.body.style.cursor;
        const prevUserSelect = document.body.style.userSelect;
        document.body.style.cursor = "se-resize";
        document.body.style.userSelect = "none";

        const handleMouseMove = (e: MouseEvent) => {
            const zoom = resizeStartRef.current.zoom || 1;
            const deltaX = (e.clientX - resizeStartRef.current.x) / zoom;
            const deltaY = (e.clientY - resizeStartRef.current.y) / zoom;

            const effectiveAspectRatio =
                lockedAspectRatio && lockedAspectRatio > 0
                    ? lockedAspectRatio
                    : lockAspectRatio && resizeStartRef.current.height > 0
                      ? resizeStartRef.current.width /
                        resizeStartRef.current.height
                      : undefined;

            let newWidth: number;
            let newHeight: number;

            if (effectiveAspectRatio) {
                const effectiveMinWidth = Math.max(
                    minWidth,
                    Math.round(minHeight * effectiveAspectRatio),
                );
                newWidth = Math.max(
                    effectiveMinWidth,
                    Math.round(resizeStartRef.current.width + deltaX),
                );
                newHeight = Math.max(
                    minHeight,
                    Math.round(newWidth / effectiveAspectRatio),
                );
            } else {
                newWidth = Math.max(
                    minWidth,
                    Math.round(resizeStartRef.current.width + deltaX),
                );
                newHeight = Math.max(
                    minHeight,
                    Math.round(resizeStartRef.current.height + deltaY),
                );
            }

            const nextDims = {
                width: newWidth,
                height: newHeight,
            };
            dimensionsRef.current = nextDims;
            setDimensions(nextDims);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            onCommit(id, {
                width: dimensionsRef.current.width,
                height: dimensionsRef.current.height,
            });
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.body.style.cursor = prevCursor;
            document.body.style.userSelect = prevUserSelect;
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [
        isResizing,
        id,
        onCommit,
        minWidth,
        minHeight,
        lockedAspectRatio,
        lockAspectRatio,
    ]);

    return { dimensions, handleResizeStart, isResizing };
}
