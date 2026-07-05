"use client";

import React from "react";
import { NodeToolbar, Position, useStore } from "@xyflow/react";

interface NodeParamsBarProps {
    isVisible?: boolean;
    nodeWidth?: number;
    children: React.ReactNode;
}

export function NodeParamsBar({
    isVisible,
    nodeWidth,
    children,
}: NodeParamsBarProps) {
    const isMultiSelect = useStore((s) => {
        let count = 0;
        for (const n of s.nodes) {
            if (n.selected && ++count > 1) return true;
        }
        return false;
    });

    const style = nodeWidth
        ? {
              minWidth: nodeWidth,
              maxWidth: nodeWidth * 1.3,
              width: "100%",
          }
        : undefined;

    return (
        <NodeToolbar
            isVisible={isVisible && !isMultiSelect}
            position={Position.Bottom}
            offset={8}
            className="z-20"
            style={style}
        >
            <div
                data-testid="params-bar-container"
                className="border-border bg-background/95 pointer-events-auto w-full rounded-lg border px-3 py-2 shadow-md backdrop-blur-md"
                style={style}
            >
                {children}
            </div>
        </NodeToolbar>
    );
}
