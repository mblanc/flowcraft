"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Download, Link as LinkIcon, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserProfile } from "@/components/flow/user-profile";
import type { LibraryAsset } from "@/lib/library-types";

export default function AssetPublicPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session, status } = useSession();
    const [asset, setAsset] = useState<LibraryAsset | null>(null);
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push(`/sign-in?callbackUrl=/assets/${params.id as string}`);
        }
    }, [status, router, params.id]);

    useEffect(() => {
        if (status !== "authenticated") return;
        const id = params.id as string;

        fetch(`/api/library/${id}`)
            .then(async (res) => {
                if (res.ok) {
                    const data: LibraryAsset = await res.json();
                    setAsset(data);
                    const urlRes = await fetch(
                        `/api/signed-url?gcsUri=${encodeURIComponent(data.gcsUri)}`,
                    );
                    if (urlRes.ok) {
                        const { signedUrl } = (await urlRes.json()) as {
                            signedUrl: string;
                        };
                        setMediaUrl(signedUrl);
                    }
                } else {
                    setNotFound(true);
                }
            })
            .catch(() => setNotFound(true))
            .finally(() => setLoading(false));
    }, [status, params.id]);

    const handleCopyLink = () => {
        void navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard");
    };

    const handleDownload = () => {
        if (!mediaUrl || !asset) return;
        const a = document.createElement("a");
        a.href = mediaUrl;
        a.download = `asset-${asset.id}.${asset.mimeType.split("/")[1] ?? "bin"}`;
        a.click();
    };

    if (loading || status === "loading") {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (notFound || !asset) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-center">
                    <h2 className="text-foreground mb-2 text-2xl font-semibold">
                        Asset not found
                    </h2>
                    <p className="text-muted-foreground mb-4">
                        This asset doesn&apos;t exist or is private.
                    </p>
                    <button
                        onClick={() => router.push("/library")}
                        className="text-primary hover:underline"
                    >
                        Back to library
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-background min-h-screen">
            {/* Header */}
            <header className="border-border bg-background/80 sticky top-0 z-10 flex h-14 items-center justify-between border-b px-6 backdrop-blur-sm">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/library")}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Library
                </Button>
                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <UserProfile isCollapsed={false} />
                </div>
            </header>

            <main className="mx-auto max-w-3xl px-6 py-12">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-foreground mb-1 text-2xl font-bold capitalize">
                            {asset.type}
                        </h1>
                        {asset.provenance?.prompt && (
                            <p className="text-muted-foreground text-sm">
                                {asset.provenance.prompt}
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopyLink}
                        >
                            <LinkIcon className="mr-2 h-3.5 w-3.5" />
                            Copy link
                        </Button>
                        {mediaUrl && (
                            <Button size="sm" onClick={handleDownload}>
                                <Download className="mr-2 h-3.5 w-3.5" />
                                Download
                            </Button>
                        )}
                    </div>
                </div>

                {/* Media viewer */}
                <div className="bg-muted overflow-hidden rounded-xl">
                    {mediaUrl ? (
                        asset.type === "video" ? (
                            <video
                                src={mediaUrl}
                                controls
                                className="w-full"
                                style={{
                                    aspectRatio: asset.aspectRatio ?? "16/9",
                                }}
                            />
                        ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={mediaUrl}
                                alt="Asset"
                                className="w-full object-contain"
                                style={{
                                    maxHeight: "70vh",
                                }}
                            />
                        )
                    ) : (
                        <div className="flex h-64 items-center justify-center">
                            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                        </div>
                    )}
                </div>

                {/* Metadata */}
                <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                    {asset.model && (
                        <div>
                            <dt className="text-muted-foreground">Model</dt>
                            <dd className="text-foreground font-medium">
                                {asset.model}
                            </dd>
                        </div>
                    )}
                    {asset.aspectRatio && (
                        <div>
                            <dt className="text-muted-foreground">
                                Aspect ratio
                            </dt>
                            <dd className="text-foreground font-medium">
                                {asset.aspectRatio}
                            </dd>
                        </div>
                    )}
                    {asset.width && asset.height && (
                        <div>
                            <dt className="text-muted-foreground">
                                Dimensions
                            </dt>
                            <dd className="text-foreground font-medium">
                                {asset.width}×{asset.height}
                            </dd>
                        </div>
                    )}
                    {asset.provenance?.sourceName && (
                        <div>
                            <dt className="text-muted-foreground">Source</dt>
                            <dd className="text-foreground font-medium">
                                {asset.provenance.sourceName}
                            </dd>
                        </div>
                    )}
                </dl>
            </main>
        </div>
    );
}
