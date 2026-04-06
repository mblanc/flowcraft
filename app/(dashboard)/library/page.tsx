"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { LibraryTabs } from "@/components/library/library-tabs";
import { LibraryToolbar } from "@/components/library/library-toolbar";
import { LibraryMasonryGrid } from "@/components/library/library-masonry-grid";
import { LibraryAssetDetail } from "@/components/library/library-asset-detail";
import type { LibraryAsset } from "@/lib/library-types";

type LibraryTab = "images" | "videos";

export default function LibraryPage() {
    const { status } = useSession();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<LibraryTab>("images");
    const [searchQuery, setSearchQuery] = useState("");
    const [assets, setAssets] = useState<LibraryAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAsset, setSelectedAsset] = useState<LibraryAsset | null>(
        null,
    );

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/sign-in");
        }
    }, [status, router]);

    const fetchAssets = useCallback(async () => {
        setLoading(true);
        try {
            const type = activeTab === "images" ? "image" : "video";
            const res = await fetch(`/api/library?type=${type}`);
            if (res.ok) {
                const data = await res.json();
                setAssets(data.assets ?? []);
            }
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        if (status === "authenticated") {
            fetchAssets();
        }
    }, [status, fetchAssets]);

    const filteredAssets = searchQuery.trim()
        ? assets.filter((a) => {
              const q = searchQuery.toLowerCase();
              return (
                  a.provenance.prompt?.toLowerCase().includes(q) ||
                  a.tags.some((t) => t.toLowerCase().includes(q)) ||
                  a.provenance.sourceName.toLowerCase().includes(q)
              );
          })
        : assets;

    const handleDelete = useCallback((id: string) => {
        setAssets((prev) => prev.filter((a) => a.id !== id));
        setSelectedAsset(null);
    }, []);

    const handleTagsChange = useCallback((id: string, tags: string[]) => {
        setAssets((prev) =>
            prev.map((a) => (a.id === id ? { ...a, tags } : a)),
        );
        setSelectedAsset((prev) =>
            prev?.id === id ? { ...prev, tags } : prev,
        );
    }, []);

    if (status === "loading") {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="text-primary h-12 w-12 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                        Library
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Explore your generated assets and media
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <LibraryToolbar
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                    />
                </div>
            </header>

            <div className="border-border/50 bg-card/50 sticky top-0 z-10 -mx-4 flex items-center justify-between border-y px-4 py-3 backdrop-blur-sm sm:mx-0 sm:rounded-2xl sm:border">
                <LibraryTabs activeTab={activeTab} onChange={setActiveTab} />
                <div className="text-muted-foreground text-sm font-medium">
                    {filteredAssets.length} items
                </div>
            </div>

            <main>
                {loading ? (
                    <div className="flex justify-center py-24">
                        <Loader2 className="text-primary h-12 w-12 animate-spin" />
                    </div>
                ) : (
                    <LibraryMasonryGrid
                        assets={filteredAssets}
                        onAssetClick={setSelectedAsset}
                    />
                )}
            </main>

            {/* Detail overlay */}
            {selectedAsset && (
                <LibraryAssetDetail
                    asset={selectedAsset}
                    onClose={() => setSelectedAsset(null)}
                    onDelete={handleDelete}
                    onTagsChange={handleTagsChange}
                />
            )}
        </div>
    );
}
