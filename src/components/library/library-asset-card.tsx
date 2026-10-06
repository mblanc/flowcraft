"use client";

import { useState } from "react";
import { useSignedUrl } from "@/hooks/use-signed-url";
import type { LibraryAsset } from "@/lib/library-types";

interface LibraryAssetCardProps {
    asset: LibraryAsset;
    signedUrl?: string;
    onClick: () => void;
}

export function LibraryAssetCard({
    asset,
    signedUrl,
    onClick,
}: LibraryAssetCardProps) {
    const { displayUrl } = useSignedUrl(asset.gcsUri, signedUrl);
    const [detectedAspectRatio, setDetectedAspectRatio] = useState<
        string | null
    >(null);

    const aspectRatio = asset.aspectRatio
        ? asset.aspectRatio.replace(":", " / ")
        : asset.width && asset.height
          ? `${asset.width} / ${asset.height}`
          : (detectedAspectRatio ?? "16 / 9");

    return (
        <button
            type="button"
            aria-label={
                asset.provenance.prompt
                    ? `View ${asset.type}: ${asset.provenance.prompt}`
                    : `View ${asset.type} asset`
            }
            className="group border-border bg-card focus-visible:ring-primary relative mb-3 block w-full cursor-pointer break-inside-avoid overflow-hidden rounded-lg border text-left transition-shadow duration-150 hover:shadow-sm focus-visible:ring-2 focus-visible:outline-none"
            onClick={onClick}
        >
            <div
                className="bg-muted relative w-full overflow-hidden"
                style={{ aspectRatio }}
            >
                {!displayUrl ? (
                    <div className="flex h-full w-full items-center justify-center">
                        <div className="bg-muted-foreground/20 h-8 w-8 animate-pulse rounded" />
                    </div>
                ) : asset.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={displayUrl}
                        alt={asset.provenance.prompt ?? "Generated image"}
                        className="h-full w-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <>
                        <video
                            src={displayUrl}
                            muted
                            preload="metadata"
                            onLoadedMetadata={(e) => {
                                const v = e.currentTarget;
                                if (v.videoWidth && v.videoHeight) {
                                    setDetectedAspectRatio(
                                        `${v.videoWidth} / ${v.videoHeight}`,
                                    );
                                }
                            }}
                            className="h-full w-full object-cover"
                        />
                        <span className="absolute right-1.5 bottom-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                            Video
                        </span>
                    </>
                )}
            </div>
        </button>
    );
}
