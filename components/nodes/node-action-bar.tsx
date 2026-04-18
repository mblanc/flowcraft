"use client";

import {
    Play,
    FastForward,
    Settings2,
    Maximize2,
    Loader2,
    Download,
    Trash2,
} from "lucide-react";
import React from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NodeToolbar, Position } from "@xyflow/react";

interface NodeActionBarProps {
    onGenerate?: () => void;
    onRunFromHere?: () => void;
    onSettings?: () => void;
    onFullscreen?: () => void;
    onDownload?: () => void;
    onDelete?: () => void;
    isExecuting?: boolean;
    batchProgress?: number;
    batchTotal?: number;
    extra?: React.ReactNode;
    isVisible?: boolean;
}

export function NodeActionBar({
    onGenerate,
    onRunFromHere,
    onSettings,
    onFullscreen,
    onDownload,
    onDelete,
    isExecuting,
    batchProgress,
    batchTotal,
    extra,
    isVisible,
}: NodeActionBarProps) {
    return (
        <NodeToolbar
            isVisible={isVisible}
            position={Position.Top}
            offset={34}
            className="z-50"
        >
            <TooltipProvider delayDuration={300}>
                <div className="relative">
                    {/* Hover Bridge: a transparent area that fills the gap between the node and the toolbar */}
                    <div className="absolute -bottom-[34px] left-0 -z-10 h-[34px] w-full" />

                    <div className="border-border bg-background/95 pointer-events-auto flex items-center gap-1 rounded-full border px-1 py-1 shadow-md backdrop-blur-md">
                        {onGenerate && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={isExecuting}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onGenerate();
                                        }}
                                        className={cn(
                                            "h-7 w-7 rounded-full",
                                            isExecuting &&
                                                "cursor-not-allowed opacity-50",
                                        )}
                                    >
                                        {isExecuting && batchTotal ? (
                                            <span className="text-[10px] font-medium tabular-nums">
                                                {batchProgress ?? 0}/
                                                {batchTotal}
                                            </span>
                                        ) : isExecuting ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Play
                                                className="h-3.5 w-3.5"
                                                fill="currentColor"
                                            />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    Generate
                                </TooltipContent>
                            </Tooltip>
                        )}
                        {onRunFromHere && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={isExecuting}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRunFromHere();
                                        }}
                                        className="h-7 w-7 rounded-full"
                                    >
                                        <FastForward className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    Run from here
                                </TooltipContent>
                            </Tooltip>
                        )}
                        {onSettings && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSettings();
                                        }}
                                        className="h-7 w-7 rounded-full"
                                    >
                                        <Settings2 className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    Settings
                                </TooltipContent>
                            </Tooltip>
                        )}
                        {onFullscreen && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onFullscreen();
                                        }}
                                        className="h-7 w-7 rounded-full"
                                    >
                                        <Maximize2 className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    Full size
                                </TooltipContent>
                            </Tooltip>
                        )}
                        {onDownload && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDownload();
                                        }}
                                        className="h-7 w-7 rounded-full"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    Download
                                </TooltipContent>
                            </Tooltip>
                        )}
                        {extra}
                        {onDelete && (
                            <>
                                {(onGenerate ||
                                    onRunFromHere ||
                                    onSettings ||
                                    onFullscreen ||
                                    onDownload ||
                                    extra) && (
                                    <div className="bg-border mx-0.5 h-3.5 w-px shrink-0" />
                                )}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete();
                                            }}
                                            className="text-muted-foreground hover:text-destructive h-7 w-7 rounded-full"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        Delete node
                                    </TooltipContent>
                                </Tooltip>
                            </>
                        )}
                    </div>
                </div>
            </TooltipProvider>
        </NodeToolbar>
    );
}
