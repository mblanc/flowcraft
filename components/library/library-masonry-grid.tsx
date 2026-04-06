"use client";

import type { LibraryAsset } from "@/lib/library-types";
import { LibraryAssetCard } from "./library-asset-card";

interface LibraryMasonryGridProps {
    assets: LibraryAsset[];
    onAssetClick: (asset: LibraryAsset) => void;
}

export function LibraryMasonryGrid({ assets, onAssetClick }: LibraryMasonryGridProps) {
    if (assets.length === 0) {
        return (
            <div className="text-muted-foreground flex flex-col items-center justify-center py-24 text-center">
                <p className="text-base font-medium">No assets yet</p>
                <p className="mt-1 text-sm">
                    Generate images or videos from a flow or canvas to see them here.
                </p>
            </div>
        );
    }

    return (
        <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
            {assets.map((asset) => (
                <LibraryAssetCard
                    key={asset.id}
                    asset={asset}
                    onClick={() => onAssetClick(asset)}
                />
            ))}
        </div>
    );
}
