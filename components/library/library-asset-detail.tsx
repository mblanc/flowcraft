"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useSignedUrl } from "@/hooks/use-signed-url";
import type { LibraryAsset } from "@/lib/library-types";
import { LibraryProvenance } from "./library-provenance";
import { LibraryTagsEditor } from "./library-tags-editor";
import { LibraryAssetActions } from "./library-asset-actions";

interface LibraryAssetDetailProps {
    asset: LibraryAsset;
    onClose: () => void;
    onDelete: (id: string) => void;
    onTagsChange: (id: string, tags: string[]) => void;
}

export function LibraryAssetDetail({
    asset,
    onClose,
    onDelete,
    onTagsChange,
}: LibraryAssetDetailProps) {
    const { displayUrl } = useSignedUrl(asset.gcsUri);
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    // Close on backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40 backdrop-blur-sm"
            onClick={handleBackdropClick}
        >
            <div
                ref={panelRef}
                className="bg-background border-border flex h-full w-full max-w-md flex-col overflow-y-auto border-l shadow-2xl"
            >
                {/* Header */}
                <div className="border-border flex items-center justify-between border-b px-5 py-4">
                    <span className="text-foreground font-semibold capitalize">
                        {asset.type} detail
                    </span>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Preview */}
                <div className="bg-muted flex items-center justify-center p-4">
                    {asset.type === "image" ? (
                        displayUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={displayUrl}
                                alt={
                                    asset.provenance.prompt ?? "Generated image"
                                }
                                className="max-h-72 w-full rounded-lg object-contain"
                            />
                        ) : (
                            <div className="bg-muted-foreground/20 h-48 w-full animate-pulse rounded-lg" />
                        )
                    ) : displayUrl ? (
                        <video
                            src={displayUrl}
                            controls
                            className="max-h-72 w-full rounded-lg"
                        />
                    ) : (
                        <div className="bg-muted-foreground/20 h-48 w-full animate-pulse rounded-lg" />
                    )}
                </div>

                {/* Metadata + actions */}
                <div className="flex flex-1 flex-col gap-5 px-5 py-5">
                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-3">
                        {asset.aspectRatio && (
                            <MetaItem
                                label="Aspect ratio"
                                value={asset.aspectRatio}
                            />
                        )}
                        {asset.model && (
                            <MetaItem label="Model" value={asset.model} />
                        )}
                        {asset.duration != null && (
                            <MetaItem
                                label="Duration"
                                value={`${asset.duration}s`}
                            />
                        )}
                        <MetaItem
                            label="Created"
                            value={new Date(asset.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                },
                            )}
                        />
                    </div>

                    {/* Provenance */}
                    <LibraryProvenance provenance={asset.provenance} />

                    {/* Tags */}
                    <LibraryTagsEditor
                        assetId={asset.id}
                        initialTags={asset.tags}
                        onTagsChange={(tags) => onTagsChange(asset.id, tags)}
                    />

                    {/* Actions */}
                    <div className="mt-auto pt-2">
                        <LibraryAssetActions
                            assetId={asset.id}
                            gcsUri={asset.gcsUri}
                            onDelete={() => onDelete(asset.id)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetaItem({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {label}
            </p>
            <p className="text-foreground mt-0.5 text-sm">{value}</p>
        </div>
    );
}
