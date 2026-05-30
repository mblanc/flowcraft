"use client";

import { Fragment } from "react";
import type { LibraryAsset } from "@/lib/library-types";
import { LibraryAssetCard } from "./library-asset-card";

export interface LibraryAssetGroup {
    label: string;
    assets: LibraryAsset[];
}

interface LibraryMasonryGridProps {
    groups: LibraryAssetGroup[];
    onAssetClick: (asset: LibraryAsset) => void;
}

export function LibraryMasonryGrid({
    groups,
    onAssetClick,
}: LibraryMasonryGridProps) {
    if (groups.length === 0) {
        return (
            <div className="text-muted-foreground flex flex-col items-center justify-center py-24 text-center">
                <p className="text-base font-semibold">No assets yet</p>
                <p className="mt-1 text-sm">
                    Generate images or videos from a flow or canvas to see them
                    here.
                </p>
            </div>
        );
    }

    return (
        <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
            {groups.map(({ label, assets }) => (
                <Fragment key={label}>
                    <div className="mt-6 mb-3 [column-span:all] first:mt-0">
                        <h3 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                            {label}
                        </h3>
                        <div className="border-border/40 mt-1.5 border-t" />
                    </div>
                    {assets.map((asset) => (
                        <LibraryAssetCard
                            key={asset.id}
                            asset={asset}
                            onClick={() => onAssetClick(asset)}
                        />
                    ))}
                </Fragment>
            ))}
        </div>
    );
}
