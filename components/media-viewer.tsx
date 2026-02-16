"use client";

import * as React from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";

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
        className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 border-none bg-transparent shadow-none focus:outline-none flex items-center justify-center overflow-visible"
        // Override the default close button behavior by hiding it via CSS or not using the default Close
        // We will add our own close button
        hideCloseButton
        aria-description="Media Viewer"
      >
        <DialogTitle className="sr-only">Media Viewer</DialogTitle>
        <div className="relative group">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute -top-4 -right-4 z-50 rounded-full bg-background border border-border p-1.5 shadow-md hover:bg-muted transition-colors opacity-100"
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
              <img
                src={url}
                alt={alt}
                className="max-w-[95vw] max-h-[95vh] w-auto h-auto object-contain rounded-md shadow-2xl bg-black/5"
              />
            </div>
          ) : (
            <video
              src={url}
              controls
              autoPlay
              className="max-w-[95vw] max-h-[95vh] w-auto h-auto rounded-md shadow-2xl"
              onContextMenu={handleContextMenu}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
