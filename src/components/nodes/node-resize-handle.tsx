"use client";

import type React from "react";

interface NodeResizeHandleProps {
    onResizeStart: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export function NodeResizeHandle({ onResizeStart }: NodeResizeHandleProps) {
    return (
        <div
            data-testid="node-resize-handle"
            className="nodrag nopan absolute right-0 bottom-0 z-30 h-6 w-6 cursor-se-resize select-none"
            onMouseDown={onResizeStart}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            style={{ touchAction: "none" }}
        >
            <div className="border-muted-foreground/40 hover:border-foreground/70 pointer-events-none absolute right-1 bottom-1 h-3 w-3 rounded-br border-r-2 border-b-2 transition-colors" />
        </div>
    );
}
