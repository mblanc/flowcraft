"use client";

import { Download, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface LibraryAssetActionsProps {
    assetId: string;
    gcsUri: string;
    onDelete: () => void;
}

export function LibraryAssetActions({
    assetId,
    gcsUri,
    onDelete,
}: LibraryAssetActionsProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDownload = async () => {
        try {
            const res = await fetch(
                `/api/signed-url?gcsUri=${encodeURIComponent(gcsUri)}`,
            );
            if (!res.ok) throw new Error("Failed to get download URL");
            const { url } = await res.json();
            const a = document.createElement("a");
            a.href = url;
            a.download = gcsUri.split("/").pop() ?? "asset";
            a.target = "_blank";
            a.click();
        } catch {
            toast.error("Download failed");
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
        <div className="flex gap-2">
            <button
                onClick={handleDownload}
                className="border-border bg-background text-foreground hover:bg-muted flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition-colors"
            >
                <Download className="h-4 w-4" />
                Download
            </button>
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
        </div>
    );
}
