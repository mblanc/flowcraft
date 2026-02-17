"use client";

import * as React from "react";

import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface MediaViewerProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    url: string;
    alt: string;
    type?: "image" | "video";
}

export function MediaViewer({
    isOpen,
    onOpenChange,
    url,
    alt,
    type = "image",
}: MediaViewerProps) {
    // We need to stop propagation on context menu to prevent React Flow's custom menu
    // and allow the native browser menu (Save Image As, etc.)
    const handleContextMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent
                className="flex h-auto max-h-[95vh] w-auto max-w-[95vw] items-center justify-center overflow-visible border-none bg-transparent p-0 shadow-none focus:outline-none"
                // Override the default close button behavior by hiding it via CSS or not using the default Close
                // We will add our own close button
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

                    {type === "image" ? (
                        <div
                            className="relative flex items-center justify-center"
                            onContextMenu={handleContextMenu}
                        >
                            {/* Use a regular img tag for full flexibility or next/image with generic styling */}
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
