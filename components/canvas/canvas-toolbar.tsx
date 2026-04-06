"use client";

import { useRef, useCallback, useState } from "react";
import { Type, Upload, Loader2 } from "lucide-react";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import type {
    CanvasTextData,
    CanvasImageData,
    CanvasVideoData,
} from "@/lib/canvas-types";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import logger from "@/app/logger";

const ACCEPTED_IMAGE_TYPES = ".png,.jpg,.jpeg,.webp";
const ACCEPTED_VIDEO_TYPES = ".mp4,.webm";
const ACCEPTED_TYPES = `${ACCEPTED_IMAGE_TYPES},${ACCEPTED_VIDEO_TYPES}`;

interface CanvasToolbarProps {
    getViewportCenter: () => { x: number; y: number };
}

export function CanvasToolbar({ getViewportCenter }: CanvasToolbarProps) {
    const addNode = useCanvasStore((s) => s.addNode);
    const getNextLabel = useCanvasStore((s) => s.getNextLabel);
    const getNextNodeId = useCanvasStore((s) => s.getNextNodeId);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleAddText = useCallback(() => {
        const center = getViewportCenter();
        const label = getNextLabel("canvas-text");
        const id = getNextNodeId("canvas-text");

        const data: CanvasTextData = {
            type: "canvas-text",
            label,
            content: "",
            width: 250,
            height: 180,
        };

        addNode({
            id,
            type: "canvas-text",
            position: { x: center.x - 125, y: center.y - 90 },
            data,
            width: 250,
            height: 180,
        });
    }, [addNode, getNextLabel, getNextNodeId, getViewportCenter]);

    const handleImport = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;

            setUploading(true);
            const center = getViewportCenter();
            let offsetX = 0;

            try {
                for (const file of Array.from(files)) {
                    const formData = new FormData();
                    formData.append("file", file);

                    const response = await fetch("/api/upload-file", {
                        method: "POST",
                        body: formData,
                    });

                    if (!response.ok) {
                        logger.error(`Failed to upload ${file.name}`);
                        continue;
                    }

                    const { gcsUri } = await response.json();
                    const isVideo = file.type.startsWith("video/");
                    const nodeType = isVideo ? "canvas-video" : "canvas-image";
                    const label = getNextLabel(nodeType);
                    const id = getNextNodeId(nodeType);

                    if (isVideo) {
                        const data: CanvasVideoData = {
                            type: "canvas-video",
                            label,
                            sourceUrl: gcsUri,
                            mimeType: file.type,
                            status: "ready",
                        };
                        addNode({
                            id,
                            type: "canvas-video",
                            position: {
                                x: center.x - 180 + offsetX,
                                y: center.y - 140,
                            },
                            data,
                            width: 360,
                            height: 280,
                        });
                    } else {
                        const data: CanvasImageData = {
                            type: "canvas-image",
                            label,
                            sourceUrl: gcsUri,
                            mimeType: file.type,
                            width: 300,
                            height: 300,
                            status: "ready",
                        };
                        addNode({
                            id,
                            type: "canvas-image",
                            position: {
                                x: center.x - 150 + offsetX,
                                y: center.y - 150,
                            },
                            data,
                            width: 300,
                            height: 300,
                        });
                    }

                    offsetX += 40;
                }
            } catch (error) {
                logger.error("Error uploading file:", error);
            } finally {
                setUploading(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }
        },
        [addNode, getNextLabel, getNextNodeId, getViewportCenter],
    );

    return (
        <TooltipProvider delayDuration={300}>
            <div className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/75 absolute top-1/2 left-4 z-20 flex -translate-y-1/2 flex-col items-center gap-1 rounded-full border p-1 shadow-sm backdrop-blur">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={handleAddText}
                            className="hover:bg-accent flex h-10 w-10 items-center justify-center rounded-full transition-colors"
                        >
                            <Type className="h-5 w-5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Add Text</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={handleImport}
                            disabled={uploading}
                            className="hover:bg-accent flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:opacity-50"
                        >
                            {uploading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Upload className="h-5 w-5" />
                            )}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Import Media</TooltipContent>
                </Tooltip>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>
        </TooltipProvider>
    );
}
