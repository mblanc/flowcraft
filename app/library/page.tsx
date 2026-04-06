"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, BookImage } from "lucide-react";
import { UserProfile } from "@/components/flow/user-profile";
import { LibraryTabs } from "@/components/library/library-tabs";
import { LibraryToolbar } from "@/components/library/library-toolbar";
import { LibraryMasonryGrid } from "@/components/library/library-masonry-grid";
import { LibraryAssetDetail } from "@/components/library/library-asset-detail";
import type { LibraryAsset } from "@/lib/library-types";
import Link from "next/link";

type LibraryTab = "images" | "videos";

export default function LibraryPage() {
    const { data: session, status } = useSession();
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
            router.push("/");
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
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="bg-background min-h-screen">
            {/* Header */}
            <header className="border-border bg-background/80 sticky top-0 z-10 border-b backdrop-blur-sm">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-6">
                        <Link
                            href="/flows"
                            className="flex items-center gap-2 text-sm font-semibold"
                        >
                            <BookImage className="h-5 w-5" />
                            Library
                        </Link>
                        <LibraryTabs
                            activeTab={activeTab}
                            onChange={setActiveTab}
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <LibraryToolbar
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                        />
                        {session && <UserProfile isCollapsed={false} />}
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="mx-auto max-w-7xl px-6 py-8">
                {loading ? (
                    <div className="flex justify-center py-24">
                        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
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
