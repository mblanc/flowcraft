"use client";

import { memo, useState, useEffect } from "react";
import Image from "next/image";
import { MediaViewer } from "@/components/nodes/media-viewer";
import { cn } from "@/lib/utils";
import logger from "@/app/logger";
import {
    getCachedSignedUrl,
    fetchAndCacheSignedUrl,
} from "@/lib/cache/signed-url-cache";

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

        // Initialise synchronously from the module-level cache so remounting
        // nodes never show placeholder images or trigger redundant fetches.
        const [signedUrls, setSignedUrls] = useState<Map<string, string>>(
            () => {
                const map = new Map<string, string>();
                items.forEach((url) => {
                    if (url.startsWith("gs://")) {
                        const cached = getCachedSignedUrl(url);
                        if (cached) map.set(url, cached);
                    }
                });
                return map;
            },
        );

        useEffect(() => {
            const urlsToFetch = items.filter(
                (url) => url.startsWith("gs://") && !signedUrls.has(url),
            );

            if (urlsToFetch.length === 0) return;

            Promise.all(
                urlsToFetch.map((url) =>
                    fetchAndCacheSignedUrl(url).then((signedUrl) => ({
                        url,
                        signedUrl,
                    })),
                ),
            )
                .then((results) => {
                    setSignedUrls((prev) => {
                        const next = new Map(prev);
                        results.forEach(({ url, signedUrl }) => {
                            if (signedUrl) next.set(url, signedUrl);
                        });
                        return next;
                    });
                })
                .catch((err) => {
                    logger.error("Error fetching signed URLs:", err);
                });
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [items]);

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
