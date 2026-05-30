"use client";

import * as React from "react";

import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface MediaViewerProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    url: string;
    alt: string;
    type?: "image" | "video";
    onPrev?: () => void;
    onNext?: () => void;
    currentIndex?: number;
    totalCount?: number;
}

export function MediaViewer({
    isOpen,
    onOpenChange,
    url,
    alt,
    type = "image",
    onPrev,
    onNext,
    currentIndex,
    totalCount,
}: MediaViewerProps) {
    const handleContextMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    React.useEffect(() => {
        if (!isOpen || (!onPrev && !onNext)) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") onPrev?.();
            if (e.key === "ArrowRight") onNext?.();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [isOpen, onPrev, onNext]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent
                className="flex h-auto max-h-[95vh] w-auto max-w-[95vw] items-center justify-center overflow-visible border-none bg-transparent p-0 shadow-none focus:outline-none"
                hideCloseButton
                aria-description="Media Viewer"
            >
                <DialogTitle className="sr-only">Media Viewer</DialogTitle>
                <div className="group relative">
                    <button
                        onClick={() => onOpenChange(false)}
                        className="bg-background border-border hover:bg-muted absolute -top-4 -right-4 z-50 rounded-full border p-1.5 opacity-100 shadow-md transition-colors"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    {onPrev && (
                        <button
                            onClick={onPrev}
                            className="bg-background/80 hover:bg-background border-border absolute top-1/2 -left-12 z-50 -translate-y-1/2 rounded-full border p-2 shadow-md transition-colors"
                            aria-label="Previous"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                    )}

                    {onNext && (
                        <button
                            onClick={onNext}
                            className="bg-background/80 hover:bg-background border-border absolute top-1/2 -right-12 z-50 -translate-y-1/2 rounded-full border p-2 shadow-md transition-colors"
                            aria-label="Next"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    )}

                    {totalCount !== undefined &&
                        currentIndex !== undefined &&
                        totalCount > 1 && (
                            <div className="bg-background/80 border-border absolute -bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full border px-3 py-1 text-xs font-medium shadow-md">
                                {currentIndex + 1} / {totalCount}
                            </div>
                        )}

                    {type === "image" ? (
                        <div
                            className="relative flex items-center justify-center"
                            onContextMenu={handleContextMenu}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={url}
                                alt={alt}
                                className="h-auto max-h-[95vh] w-auto max-w-[95vw] rounded-md bg-black/5 object-contain shadow-2xl"
                            />
                        </div>
                    ) : (
                        <video
                            src={url}
                            controls
                            autoPlay
                            className="h-auto max-h-[95vh] w-auto max-w-[95vw] rounded-md shadow-2xl"
                            onContextMenu={handleContextMenu}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
