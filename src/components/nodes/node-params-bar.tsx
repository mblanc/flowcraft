"use client";

import React from "react";
import { NodeToolbar, Position, useStore } from "@xyflow/react";

interface NodeParamsBarProps {
    isVisible?: boolean;
    children: React.ReactNode;
}

export function NodeParamsBar({ isVisible, children }: NodeParamsBarProps) {
    const selectedCount = useStore(
        (s) => s.nodes.filter((n) => n.selected).length,
    );
    return (
        <NodeToolbar
            isVisible={isVisible && selectedCount <= 1}
            position={Position.Bottom}
            offset={8}
            className="z-20"
        >
            <div className="border-border bg-card pointer-events-auto rounded-lg border px-3 py-2 shadow-sm">
                {children}
            </div>
        </NodeToolbar>
    );
}
