"use client";

import { useEffect } from "react";
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

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex bg-black/90">
            {/* Left: media — click the dark backdrop to close */}
            <div
                className="flex flex-1 cursor-pointer items-center justify-center overflow-hidden p-6 lg:p-12"
                onClick={onClose}
            >
                {asset.type === "image" ? (
                    displayUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={displayUrl}
                            alt={asset.provenance.prompt ?? "Generated image"}
                            className="max-h-full max-w-full cursor-default rounded-lg object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <div className="h-64 w-64 animate-pulse rounded-lg bg-white/10" />
                    )
                ) : displayUrl ? (
                    <video
                        src={displayUrl}
                        controls
                        autoPlay
                        className="max-h-full max-w-full cursor-default rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <div className="h-64 w-64 animate-pulse rounded-lg bg-white/10" />
                )}
            </div>

            {/* Right: metadata panel */}
            <div className="bg-background border-border flex h-full w-80 flex-col overflow-y-auto border-l lg:w-96">
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

                {/* Metadata + actions */}
                <div className="flex flex-1 flex-col gap-5 px-5 py-5">
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

                    <LibraryProvenance provenance={asset.provenance} />

                    <LibraryTagsEditor
                        assetId={asset.id}
                        initialTags={asset.tags}
                        onTagsChange={(tags) => onTagsChange(asset.id, tags)}
                    />

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
