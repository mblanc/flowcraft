"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Copy, Calendar, ImageIcon, ArrowLeft } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserProfile } from "@/components/flow/user-profile";
import type { StyleDocument } from "@/lib/styles/style-types";

function formatDate(str: string) {
    return new Date(str).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

export default function StylePublicPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session, status } = useSession();
    const [style, setStyle] = useState<StyleDocument | null>(null);
    const [signedUrls, setSignedUrls] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [cloning, setCloning] = useState(false);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push(`/sign-in?callbackUrl=/styles/${params.id as string}`);
        }
    }, [status, router, params.id]);

    useEffect(() => {
        if (status !== "authenticated") return;
        const id = params.id as string;

        fetch(`/api/styles/${id}`)
            .then(async (res) => {
                if (res.ok) {
                    const data: StyleDocument = await res.json();
                    setStyle(data);

                    const urls = await Promise.all(
                        data.referenceImageUris.map(async (uri) => {
                            const r = await fetch(
                                `/api/signed-url?gcsUri=${encodeURIComponent(uri)}`,
                            );
                            if (r.ok) {
                                const { signedUrl } = (await r.json()) as {
                                    signedUrl: string;
                                };
                                return signedUrl;
                            }
                            return null;
                        }),
                    );
                    setSignedUrls(urls.filter(Boolean) as string[]);
                } else {
                    setNotFound(true);
                }
            })
            .catch(() => setNotFound(true))
            .finally(() => setLoading(false));
    }, [status, params.id]);

    const handleClone = async () => {
        if (!style) return;
        setCloning(true);
        try {
            const res = await fetch(`/api/styles/${style.id}/clone`, {
                method: "POST",
            });
            if (res.ok) {
                toast.success("Style cloned to your library");
                router.push("/styles");
            } else {
                toast.error("Failed to clone style");
            }
        } catch {
            toast.error("Failed to clone style");
        } finally {
            setCloning(false);
        }
    };

    if (loading || status === "loading") {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (notFound || !style) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-center">
                    <h2 className="text-foreground mb-2 text-2xl font-semibold">
                        Style not found
                    </h2>
                    <p className="text-muted-foreground mb-4">
                        This style doesn&apos;t exist or is private.
                    </p>
                    <button
                        onClick={() => router.push("/styles")}
                        className="text-primary hover:underline"
                    >
                        Back to styles
                    </button>
                </div>
            </div>
        );
    }

    const isOwner = style.userId === session?.user?.id;

    return (
        <div className="bg-background min-h-screen">
            {/* Header */}
            <header className="border-border bg-background/80 sticky top-0 z-10 flex h-14 items-center justify-between border-b px-6 backdrop-blur-sm">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/styles")}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Styles
                </Button>
                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <UserProfile isCollapsed={false} />
                </div>
            </header>

            <main className="mx-auto max-w-3xl px-6 py-12">
                <div className="mb-8 flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-foreground mb-2 text-3xl font-bold">
                            {style.name}
                        </h1>
                        {style.description && (
                            <p className="text-muted-foreground text-base">
                                {style.description}
                            </p>
                        )}
                        <div className="text-muted-foreground mt-3 flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {formatDate(style.updatedAt)}
                            </span>
                            {style.referenceImageUris.length > 0 && (
                                <span className="flex items-center gap-1">
                                    <ImageIcon className="h-3.5 w-3.5" />
                                    {style.referenceImageUris.length} reference
                                    {style.referenceImageUris.length !== 1
                                        ? "s"
                                        : ""}
                                </span>
                            )}
                        </div>
                    </div>
                    {!isOwner && (
                        <Button onClick={handleClone} disabled={cloning}>
                            <Copy className="mr-2 h-4 w-4" />
                            {cloning ? "Cloning…" : "Clone to my styles"}
                        </Button>
                    )}
                </div>

                {/* Reference images */}
                {signedUrls.length > 0 && (
                    <section className="mb-8">
                        <h2 className="text-foreground mb-4 text-sm font-medium tracking-wide uppercase">
                            Reference Images
                        </h2>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                            {signedUrls.map((url, i) => (
                                <div
                                    key={i}
                                    className="relative aspect-square overflow-hidden rounded-lg"
                                >
                                    <Image
                                        src={url}
                                        alt={`Reference ${i + 1}`}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Style content */}
                <section>
                    <h2 className="text-foreground mb-4 text-sm font-medium tracking-wide uppercase">
                        Style Definition
                    </h2>
                    <pre className="bg-muted text-foreground overflow-x-auto rounded-lg p-4 text-sm break-words whitespace-pre-wrap">
                        {style.content}
                    </pre>
                </section>
            </main>
        </div>
    );
}
