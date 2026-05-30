"use client";

import { Panel } from "@xyflow/react";
import { Button } from "../ui/button";
import { Play } from "lucide-react";

interface FlowRunPanelProps {
    isRunning: boolean;
    hasSelectedNodes: boolean;
    onRunFlow: () => void;
    onRunSelectedNodes: () => void;
}

export function FlowRunPanel({
    isRunning,
    hasSelectedNodes,
    onRunFlow,
    onRunSelectedNodes,
}: FlowRunPanelProps) {
    return (
        <Panel
            position="top-right"
            className="bg-card border-border flex gap-2 rounded-lg border p-2"
        >
            <Button
                onClick={onRunFlow}
                disabled={isRunning}
                size="sm"
                className="bg-green-500 text-white hover:bg-green-600"
            >
                <Play className="mr-2 h-4 w-4" />
                {isRunning ? "Running..." : "Run Flow"}
            </Button>
            {hasSelectedNodes && (
                <Button
                    onClick={onRunSelectedNodes}
                    disabled={isRunning}
                    size="sm"
                    variant="outline"
                    className="border-green-500 text-green-500 hover:bg-green-50 dark:hover:bg-green-950/20"
                >
                    <Play className="mr-2 h-4 w-4" />
                    Run Selected
                </Button>
            )}
        </Panel>
    );
}
