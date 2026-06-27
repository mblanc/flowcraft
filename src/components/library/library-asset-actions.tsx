"use client";

import { Download, Trash2, Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ShareDialog } from "@/components/sharing/ShareDialog";
import { downloadFile } from "@/lib/utils";

interface LibraryAssetActionsProps {
    assetId: string;
    gcsUri: string;
    visibility: "private" | "public";
    isOwner: boolean;
    onDelete: () => void;
    onShared: () => void;
}

export function LibraryAssetActions({
    assetId,
    gcsUri,
    visibility,
    isOwner,
    onDelete,
    onShared,
}: LibraryAssetActionsProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        if (downloading) return;
        setDownloading(true);
        try {
            const res = await fetch(
                `/api/signed-url?gcsUri=${encodeURIComponent(gcsUri)}`,
            );
            if (!res.ok) throw new Error("Failed to get download URL");
            const { signedUrl } = (await res.json()) as { signedUrl: string };
            const filename = gcsUri.split("/").pop() ?? "asset";
            await downloadFile(signedUrl, filename);
        } catch {
            toast.error("Download failed");
        } finally {
            setDownloading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Delete this asset from your library?")) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/library/${assetId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Delete failed");
            onDelete();
            toast.success("Asset removed from library");
        } catch {
            toast.error("Failed to delete asset");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <div className="flex gap-2">
                <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="border-border bg-background text-foreground hover:bg-muted flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition-colors disabled:opacity-50"
                >
                    {downloading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="h-4 w-4" />
                    )}
                    {downloading ? "Downloading..." : "Download"}
                </button>
                {isOwner && (
                    <button
                        onClick={() => setShareOpen(true)}
                        className="border-border bg-background text-foreground hover:bg-muted flex items-center justify-center rounded-lg border px-3 py-2 transition-colors"
                        title="Share"
                    >
                        <Share2 className="h-4 w-4" />
                    </button>
                )}
                {isOwner && (
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="border-border bg-background text-destructive hover:bg-destructive/10 flex items-center justify-center rounded-lg border px-3 py-2 transition-colors disabled:opacity-50"
                    >
                        {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Trash2 className="h-4 w-4" />
                        )}
                    </button>
                )}
            </div>

            <ShareDialog
                isOpen={shareOpen}
                onClose={() => setShareOpen(false)}
                artifactType="asset"
                artifactId={assetId}
                artifactName="this asset"
                currentVisibility={visibility}
                isOwner={isOwner}
                onSaved={onShared}
            />
        </>
    );
}
