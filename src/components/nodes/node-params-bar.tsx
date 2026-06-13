"use client";

import React from "react";
import { NodeToolbar, Position, useStore } from "@xyflow/react";

interface NodeParamsBarProps {
    isVisible?: boolean;
    children: React.ReactNode;
}

export function NodeParamsBar({ isVisible, children }: NodeParamsBarProps) {
    const isMultiSelect = useStore((s) => {
        let count = 0;
        for (const n of s.nodes) {
            if (n.selected && ++count > 1) return true;
        }
        return false;
    });
    return (
        <NodeToolbar
            isVisible={isVisible && !isMultiSelect}
            position={Position.Bottom}
            offset={8}
            className="z-20"
        >
            <div
                data-testid="params-bar-container"
                className="border-border bg-background/95 pointer-events-auto rounded-lg border px-3 py-2 shadow-md backdrop-blur-md"
            >
                {children}
            </div>
        </NodeToolbar>
    );
}
