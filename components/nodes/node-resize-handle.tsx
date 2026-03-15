"use client";

import type React from "react";

interface NodeResizeHandleProps {
    onResizeStart: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export function NodeResizeHandle({ onResizeStart }: NodeResizeHandleProps) {
    return (
        <div
            className="nodrag absolute right-0 bottom-0 h-4 w-4 cursor-se-resize"
            onMouseDown={onResizeStart}
            style={{ touchAction: "none" }}
        >
            <div className="border-muted-foreground/30 absolute right-1 bottom-1 h-3 w-3 rounded-br border-r-2 border-b-2" />
        </div>
    );
}
