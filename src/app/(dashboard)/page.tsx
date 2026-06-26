"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    Bot,
    Palette,
    Sparkles,
    Workflow,
    BookImage,
    Plus,
    ArrowRight,
    Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { FlowDocument } from "@/lib/types";
import type { CanvasDocument } from "@/lib/canvas/types";
import { fetchAndCacheSignedUrl } from "@/lib/cache/signed-urls";
import { isGcsUri } from "@/lib/utils/gcs-uri";

const dashboardBoxes = [
    {
        name: "Agents",
        description: "Collaborative canvas for agent-driven media",
        href: "/agents",
        icon: Bot,
        accent: true,
    },
    {
        name: "Styles",
        description: "Design and share visual style guidelines",
        href: "/styles",
        icon: Palette,
        accent: false,
    },
    {
        name: "Skills",
        description: "Configure custom instructions and workflows",
        href: "/skills",
        icon: Sparkles,
        accent: false,
    },
    {
        name: "Flows",
        description: "Visual workflow builder for AI content generation",
        href: "/flows",
        icon: Workflow,
        accent: false,
    },
    {
        name: "Library",
        description: "Manage your generated assets and media",
        href: "/library",
        icon: BookImage,
        accent: false,
    },
];

export default function HomePage() {
    const router = useRouter();
    const { data: session, status } = useSession();

    const [recentFlows, setRecentFlows] = useState<FlowDocument[]>([]);
    const [recentCanvases, setRecentCanvases] = useState<CanvasDocument[]>([]);
    const [fetchingFlows, setFetchingFlows] = useState(true);
    const [fetchingCanvases, setFetchingCanvases] = useState(true);

    useEffect(() => {
        if (status !== "authenticated") return;

        const loadRecentData = async () => {
            try {
                const [canvasRes, flowRes] = await Promise.all([
                    fetch("/api/canvases?tab=my"),
                    fetch("/api/flows?tab=my"),
                ]);

                let canvasesData: CanvasDocument[] = [];
                let flowsData: FlowDocument[] = [];

                if (canvasRes.ok) {
                    const data = await canvasRes.json();
                    canvasesData = (data.canvases ?? []).slice(0, 3);
                }
                if (flowRes.ok) {
                    const data = await flowRes.json();
                    flowsData = (data.flows ?? []).slice(0, 3);
                }

                // Resolve GCS thumbnails in parallel
                const resolveThumbnails = async <
                    T extends { id: string; thumbnail?: string },
                >(
                    items: T[],
                ): Promise<T[]> => {
                    return Promise.all(
                        items.map(async (item) => {
                            if (item.thumbnail && isGcsUri(item.thumbnail)) {
                                try {
                                    const signedUrl =
                                        await fetchAndCacheSignedUrl(
                                            item.thumbnail,
                                        );
                                    if (signedUrl) {
                                        return {
                                            ...item,
                                            thumbnail: signedUrl,
                                        };
                                    }
                                } catch (error) {
                                    console.error(
                                        `Error resolving signed URL for ${item.id}:`,
                                        error,
                                    );
                                }
                            }
                            return item;
                        }),
                    );
                };

                const [resolvedCanvases, resolvedFlows] = await Promise.all([
                    resolveThumbnails(canvasesData),
                    resolveThumbnails(flowsData),
                ]);

                setRecentCanvases(resolvedCanvases);
                setRecentFlows(resolvedFlows);
            } catch (err) {
                console.error("Failed to load recent home data", err);
            } finally {
                setFetchingCanvases(false);
                setFetchingFlows(false);
            }
        };
        void loadRecentData();
    }, [status]);

    if (status === "loading") {
        return null;
    }

    if (status === "unauthenticated") {
        router.push("/sign-in");
        return null;
    }

    function formatRelativeTime(dateStr: string): string {
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return "Just now";
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays === 1) return "Yesterday";
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
            });
        } catch {
            return "";
        }
    }

    return (
        <div className="space-y-16">
            <header className="space-y-2">
                <h1
                    className="text-foreground text-4xl font-bold sm:text-5xl"
                    style={{ letterSpacing: "-0.02em" }}
                >
                    Welcome back, {session?.user?.name?.split(" ")[0]}.
                </h1>
                <p className="text-muted-foreground max-w-xl text-base">
                    Build, create, and manage your AI workflows in one place.
                </p>
            </header>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {dashboardBoxes.map((box) => (
                    <div
                        key={box.name}
                        onClick={() => router.push(box.href)}
                        className={cn(
                            "group relative flex cursor-pointer flex-col rounded-lg border p-5 transition-shadow duration-150 hover:shadow-sm",
                            box.accent
                                ? "border-primary/40 bg-card"
                                : "border-border bg-card",
                        )}
                        style={{ minHeight: 160 }}
                    >
                        <div
                            className={cn(
                                "mb-auto flex h-9 w-9 items-center justify-center rounded-md transition-transform duration-150 group-hover:rotate-6",
                                box.accent ? "bg-primary/10" : "bg-muted",
                            )}
                        >
                            <box.icon
                                className={cn(
                                    "h-5 w-5",
                                    box.accent
                                        ? "text-primary"
                                        : "text-muted-foreground",
                                )}
                            />
                        </div>

                        <div className="mt-8 space-y-1">
                            <h2
                                className={cn(
                                    "text-sm font-semibold",
                                    box.accent
                                        ? "text-primary"
                                        : "text-foreground",
                                )}
                            >
                                {box.name}
                            </h2>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                                {box.description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Agents */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2
                        className="text-foreground text-base font-semibold"
                        style={{ letterSpacing: "-0.01em" }}
                    >
                        Recent agents
                    </h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:bg-primary/5 gap-1 text-xs"
                        onClick={() => router.push("/agents")}
                    >
                        View all <ArrowRight className="h-3 w-3" />
                    </Button>
                </div>
                {fetchingCanvases ? (
                    <div className="flex h-32 items-center justify-center">
                        <Loader2 className="text-muted-foreground size-5 animate-spin" />
                    </div>
                ) : recentCanvases.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {recentCanvases.map((canvas) => (
                            <div
                                key={canvas.id}
                                onClick={() =>
                                    router.push(`/canvas/${canvas.id}`)
                                }
                                className="group border-border bg-card hover:border-primary/30 flex cursor-pointer flex-col gap-3 rounded-xl border p-3 transition-all duration-150"
                            >
                                <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                                    {canvas.thumbnail ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={canvas.thumbnail}
                                            alt={canvas.name}
                                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-102"
                                        />
                                    ) : (
                                        <div className="from-primary/5 border-border/40 flex h-full w-full items-center justify-center border bg-gradient-to-br to-violet-500/5">
                                            <Bot className="text-primary/30 size-8 transition-transform duration-200 group-hover:scale-105" />
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0 space-y-0.5 px-0.5">
                                    <h3 className="text-foreground group-hover:text-primary truncate text-xs font-semibold transition-colors">
                                        {canvas.name}
                                    </h3>
                                    <p className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase">
                                        Updated{" "}
                                        {formatRelativeTime(canvas.updatedAt)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div
                        onClick={() => router.push("/agents")}
                        className="border-border hover:border-primary/40 flex h-32 cursor-pointer flex-col items-start justify-between rounded-lg border border-dashed p-5 transition-colors duration-150"
                    >
                        <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-md">
                            <Plus className="text-primary h-4 w-4" />
                        </div>
                        <p className="text-foreground text-sm font-medium">
                            Start a new agent session
                        </p>
                    </div>
                )}
            </section>

            {/* Recent Flows */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2
                        className="text-foreground text-base font-semibold"
                        style={{ letterSpacing: "-0.01em" }}
                    >
                        Recent flows
                    </h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:bg-primary/5 gap-1 text-xs"
                        onClick={() => router.push("/flows")}
                    >
                        View all <ArrowRight className="h-3 w-3" />
                    </Button>
                </div>
                {fetchingFlows ? (
                    <div className="flex h-32 items-center justify-center">
                        <Loader2 className="text-muted-foreground size-5 animate-spin" />
                    </div>
                ) : recentFlows.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {recentFlows.map((flow) => (
                            <div
                                key={flow.id}
                                onClick={() => router.push(`/flow/${flow.id}`)}
                                className="group border-border bg-card hover:border-primary/30 flex cursor-pointer flex-col gap-3 rounded-xl border p-3 transition-all duration-150"
                            >
                                <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                                    {flow.thumbnail ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={flow.thumbnail}
                                            alt={flow.name}
                                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-102"
                                        />
                                    ) : (
                                        <div className="from-primary/5 border-border/40 flex h-full w-full items-center justify-center border bg-gradient-to-br to-emerald-500/5">
                                            <Workflow className="text-primary/30 size-8 transition-transform duration-200 group-hover:scale-105" />
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0 space-y-0.5 px-0.5">
                                    <h3 className="text-foreground group-hover:text-primary truncate text-xs font-semibold transition-colors">
                                        {flow.name}
                                    </h3>
                                    <p className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase">
                                        Updated{" "}
                                        {formatRelativeTime(flow.updatedAt)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div
                        onClick={() => router.push("/flows")}
                        className="border-border hover:border-primary/40 flex h-32 cursor-pointer flex-col items-start justify-between rounded-lg border border-dashed p-5 transition-colors duration-150"
                    >
                        <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-md">
                            <Plus className="text-primary h-4 w-4" />
                        </div>
                        <p className="text-foreground text-sm font-medium">
                            Create a new flow
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
}
