"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { LibraryTabs } from "@/components/library/library-tabs";
import { LibraryToolbar } from "@/components/library/library-toolbar";
import {
    LibraryMasonryGrid,
    type LibraryAssetGroup,
} from "@/components/library/library-masonry-grid";
import { LibraryAssetDetail } from "@/components/library/library-asset-detail";
import type { LibraryAsset } from "@/lib/library-types";

type LibraryTab = "images" | "videos";

const PAGE_LIMIT = 40;

function formatDateLabel(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        ...(date.getFullYear() !== today.getFullYear()
            ? { year: "numeric" }
            : {}),
    });
}

export default function LibraryPage() {
    const { status } = useSession();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<LibraryTab>("images");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [assets, setAssets] = useState<LibraryAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [cursor, setCursor] = useState<string | null>(null);
    const [selectedAsset, setSelectedAsset] = useState<LibraryAsset | null>(
        null,
    );

    const sentinelRef = useRef<HTMLDivElement>(null);
    const tabRequestGenerationRef = useRef(0);
    const initialRequestAbortRef = useRef<AbortController | null>(null);
    const loadMoreRequestAbortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/sign-in");
        }
    }, [status, router]);

    useEffect(() => {
        // Invalidate any in-flight requests from the previous tab selection.
        tabRequestGenerationRef.current += 1;
        initialRequestAbortRef.current?.abort();
        loadMoreRequestAbortRef.current?.abort();
        setLoadingMore(false);
    }, [activeTab]);

    useEffect(() => {
        return () => {
            initialRequestAbortRef.current?.abort();
            loadMoreRequestAbortRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(searchQuery), 300);
        return () => clearTimeout(id);
    }, [searchQuery]);

    const fetchInitial = useCallback(async () => {
        const requestGeneration = tabRequestGenerationRef.current;
        initialRequestAbortRef.current?.abort();
        const controller = new AbortController();
        initialRequestAbortRef.current = controller;
        setLoading(true);
        setAssets([]);
        setCursor(null);
        setHasMore(false);
        try {
            const type = activeTab === "images" ? "image" : "video";
            const searchParam = debouncedSearch
                ? `&search=${encodeURIComponent(debouncedSearch)}`
                : `&limit=${PAGE_LIMIT}`;
            const res = await fetch(
                `/api/library?type=${type}${searchParam}`,
                { signal: controller.signal },
            );
            if (!res.ok) {
                toast.error("Failed to load library");
                return;
            }
            const data = await res.json();
            const fetched: LibraryAsset[] = data.assets ?? [];
            if (
                controller.signal.aborted ||
                requestGeneration !== tabRequestGenerationRef.current
            ) {
                return;
            }
            setAssets(fetched);
            if (!debouncedSearch && fetched.length === PAGE_LIMIT) {
                setCursor(fetched[fetched.length - 1].createdAt);
                setHasMore(true);
            }
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                return;
            }
            toast.error("Failed to load library");
        } finally {
            if (
                !controller.signal.aborted &&
                requestGeneration === tabRequestGenerationRef.current
            ) {
                setLoading(false);
            }
        }
    }, [activeTab, debouncedSearch]);

    useEffect(() => {
        if (status === "authenticated") {
            fetchInitial();
        }
    }, [status, fetchInitial]);

    const loadMore = useCallback(async () => {
        if (!hasMore || loadingMore || !cursor) return;
        const requestGeneration = tabRequestGenerationRef.current;
        const requestCursor = cursor;
        loadMoreRequestAbortRef.current?.abort();
        const controller = new AbortController();
        loadMoreRequestAbortRef.current = controller;
        setLoadingMore(true);
        try {
            const type = activeTab === "images" ? "image" : "video";
            const res = await fetch(
                `/api/library?type=${type}&before=${encodeURIComponent(requestCursor)}&limit=${PAGE_LIMIT}`,
                { signal: controller.signal },
            );
            if (!res.ok) {
                toast.error("Failed to load more assets");
                return;
            }
            const data = await res.json();
            const fetched: LibraryAsset[] = data.assets ?? [];
            if (
                controller.signal.aborted ||
                requestGeneration !== tabRequestGenerationRef.current
            ) {
                return;
            }
            setAssets((prev) => [...prev, ...fetched]);
            if (fetched.length === PAGE_LIMIT) {
                setCursor(fetched[fetched.length - 1].createdAt);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                return;
            }
            toast.error("Failed to load more assets");
        } finally {
            if (
                !controller.signal.aborted &&
                requestGeneration === tabRequestGenerationRef.current
            ) {
                setLoadingMore(false);
            }
        }
    }, [hasMore, loadingMore, cursor, activeTab]);

    // Stable ref so the observer doesn't need to be recreated on every render
    const loadMoreRef = useRef(loadMore);
    loadMoreRef.current = loadMore;

    useEffect(() => {
        if (!hasMore) return;
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMoreRef.current();
                }
            },
            { threshold: 0.1 },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore]);

    const groups = useMemo<LibraryAssetGroup[]>(() => {
        const map = new Map<string, LibraryAsset[]>();
        for (const asset of assets) {
            const key = new Date(asset.createdAt).toDateString();
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(asset);
        }
        return [...map.entries()].map(([key, items]) => ({
            label: formatDateLabel(new Date(key)),
            assets: items,
        }));
    }, [assets]);

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
                    {assets.length} items
                </div>
            </div>

            <main>
                {loading ? (
                    <div className="flex justify-center py-24">
                        <Loader2 className="text-primary h-12 w-12 animate-spin" />
                    </div>
                ) : (
                    <>
                        <LibraryMasonryGrid
                            groups={groups}
                            onAssetClick={setSelectedAsset}
                        />

                        {/* Infinite scroll sentinel */}
                        {hasMore && (
                            <div ref={sentinelRef} className="py-8">
                                {loadingMore && (
                                    <div className="flex justify-center">
                                        <Loader2 className="text-primary h-6 w-6 animate-spin" />
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </main>

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
