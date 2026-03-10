"use client";

import { memo, useState, useEffect } from "react";
import Image from "next/image";
import { MediaViewer } from "@/components/media-viewer";
import { cn } from "@/lib/utils";
import logger from "@/app/logger";

interface BatchMediaGalleryProps {
    items: string[];
    type: "image" | "video";
    maxHeight: number;
    nodeWidth: number;
}

export const BatchMediaGallery = memo(
    ({ items, type, maxHeight, nodeWidth }: BatchMediaGalleryProps) => {
        const [selectedIndex, setSelectedIndex] = useState(0);
        const [isViewerOpen, setIsViewerOpen] = useState(false);
        const [signedUrls, setSignedUrls] = useState<Map<string, string>>(
            new Map(),
        );

        useEffect(() => {
            for (const url of items) {
                if (url.startsWith("gs://") && !signedUrls.has(url)) {
                    fetch(`/api/signed-url?gcsUri=${encodeURIComponent(url)}`)
                        .then((res) => res.json())
                        .then((result) => {
                            if (result.signedUrl) {
                                setSignedUrls((prev) => {
                                    const next = new Map(prev);
                                    next.set(url, result.signedUrl);
                                    return next;
                                });
                            }
                        })
                        .catch((err) =>
                            logger.error("Error fetching signed URL:", err),
                        );
                }
            }
        }, [items, signedUrls]);

        const getDisplayUrl = (url: string) => {
            if (url.startsWith("gs://")) {
                return signedUrls.get(url) || "/placeholder.svg";
            }
            return url;
        };

        const cols = items.length > 6 ? 3 : 2;
        const thumbSize = Math.floor((nodeWidth - 48) / cols);

        const handleOpen = (index: number) => {
            setSelectedIndex(index);
            setIsViewerOpen(true);
        };

        const handlePrev = () => {
            setSelectedIndex((i) => (i > 0 ? i - 1 : items.length - 1));
        };

        const handleNext = () => {
            setSelectedIndex((i) => (i < items.length - 1 ? i + 1 : 0));
        };

        const currentDisplayUrl = getDisplayUrl(items[selectedIndex] || "");

        return (
            <>
                <div
                    className="border-border mt-3 overflow-y-auto rounded-md border"
                    style={{ maxHeight }}
                >
                    <div
                        className="grid gap-1 p-1"
                        style={{
                            gridTemplateColumns: `repeat(${cols}, 1fr)`,
                        }}
                    >
                        {items.map((url, index) => {
                            const displayUrl = getDisplayUrl(url);
                            return (
                                <div
                                    key={index}
                                    className={cn(
                                        "relative cursor-pointer overflow-hidden rounded-sm transition-opacity hover:opacity-80",
                                        "border border-transparent",
                                    )}
                                    style={{
                                        height: thumbSize,
                                    }}
                                    onClick={() => handleOpen(index)}
                                >
                                    {type === "image" ? (
                                        <Image
                                            src={displayUrl}
                                            alt={`Result ${index + 1}`}
                                            width={thumbSize}
                                            height={thumbSize}
                                            className="h-full w-full object-cover"
                                            unoptimized={displayUrl.startsWith(
                                                "data:",
                                            )}
                                        />
                                    ) : (
                                        <video
                                            src={displayUrl}
                                            className="h-full w-full object-cover"
                                            muted
                                        />
                                    )}
                                    <span className="bg-background/70 absolute right-0.5 bottom-0.5 rounded px-1 font-mono text-[9px]">
                                        {index + 1}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {isViewerOpen && (
                    <MediaViewer
                        isOpen={isViewerOpen}
                        onOpenChange={setIsViewerOpen}
                        url={currentDisplayUrl}
                        alt={`Result ${selectedIndex + 1} of ${items.length}`}
                        type={type === "video" ? "video" : undefined}
                        onPrev={items.length > 1 ? handlePrev : undefined}
                        onNext={items.length > 1 ? handleNext : undefined}
                        currentIndex={selectedIndex}
                        totalCount={items.length}
                    />
                )}
            </>
        );
    },
);

BatchMediaGallery.displayName = "BatchMediaGallery";
