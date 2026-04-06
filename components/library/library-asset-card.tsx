"use client";

import { useSignedUrl } from "@/hooks/use-signed-url";
import type { LibraryAsset } from "@/lib/library-types";

interface LibraryAssetCardProps {
    asset: LibraryAsset;
    onClick: () => void;
}

export function LibraryAssetCard({ asset, onClick }: LibraryAssetCardProps) {
    const { displayUrl } = useSignedUrl(asset.gcsUri);

    return (
        <div
            className="group border-border bg-card relative mb-3 cursor-pointer break-inside-avoid overflow-hidden rounded-lg border transition-shadow hover:shadow-lg"
            onClick={onClick}
        >
            {asset.type === "image" ? (
                displayUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={displayUrl}
                        alt={asset.provenance.prompt ?? "Generated image"}
                        className="w-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className="bg-muted flex aspect-video items-center justify-center">
                        <div className="bg-muted-foreground/20 h-8 w-8 animate-pulse rounded" />
                    </div>
                )
            ) : (
                <div className="bg-muted relative aspect-video overflow-hidden">
                    {displayUrl ? (
                        <video
                            src={displayUrl}
                            muted
                            preload="metadata"
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <div className="bg-muted-foreground/20 h-8 w-8 animate-pulse rounded" />
                        </div>
                    )}
                    <span className="absolute right-1.5 bottom-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                        Video
                    </span>
                </div>
            )}
        </div>
    );
}
