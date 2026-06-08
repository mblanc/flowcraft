"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { Music, AlertCircle, Loader2, Trash2 } from "lucide-react";
import type { CanvasAudioData } from "@/lib/canvas/types";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const CanvasNode = memo(
    ({ data, id, selected }: NodeProps & { data: CanvasAudioData }) => {
        const removeNode = useCanvasStore((s) => s.removeNode);
        const { displayUrl } = useSignedUrl(data.sourceUrl);

        return (
            <div
                className={cn(
                    "group bg-background relative flex w-72 flex-col gap-2 rounded-xl border p-3 shadow-sm transition-shadow",
                    selected ? "border-primary shadow-md" : "border-border",
                )}
            >
                {/* Header */}
                <div className="flex items-center gap-2">
                    <div className="bg-muted flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                        <Music className="text-muted-foreground h-4 w-4" />
                    </div>
                    <p className="truncate text-sm font-medium">{data.label}</p>

                    <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => removeNode(id)}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>

                {/* Status / player */}
                {data.status === "generating" && (
                    <div className="bg-muted flex items-center gap-2 rounded-lg px-3 py-4">
                        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                        <span className="text-muted-foreground text-sm">
                            Generating…
                        </span>
                    </div>
                )}

                {data.status === "error" && (
                    <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg px-3 py-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span className="text-xs">
                            {data.error ?? "Generation failed"}
                        </span>
                    </div>
                )}

                {data.status === "ready" && displayUrl && (
                    <audio
                        controls
                        src={displayUrl}
                        className="w-full rounded"
                    />
                )}

                {data.prompt && (
                    <p className="text-muted-foreground line-clamp-2 text-xs">
                        {data.prompt}
                    </p>
                )}
            </div>
        );
    },
);

CanvasNode.displayName = "MusicCanvasNode";
