"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Trash2, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserProfile } from "@/components/user-profile";
import Image from "next/image";

interface Flow {
    id: string;
    name: string;
    thumbnail?: string;
    createdAt: string;
    updatedAt: string;
}

export default function FlowsList() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [flows, setFlows] = useState<Flow[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>(
        {},
    );

    const fetchFlows = useCallback(async () => {
        try {
            if (session) {
                const response = await fetch("/api/flows");
                if (response.ok) {
                    const data = await response.json();
                    const flowsData = data.flows || [];
                    setFlows(flowsData);

                    // Fetch signed URLs for thumbnails that are GCS URIs
                    const urls: Record<string, string> = {};
                    await Promise.all(
                        flowsData.map(async (flow: Flow) => {
                            if (
                                flow.thumbnail &&
                                flow.thumbnail.startsWith("gs://")
                            ) {
                                try {
                                    const urlResponse = await fetch(
                                        `/api/signed-url?gcsUri=${encodeURIComponent(flow.thumbnail)}`,
                                    );
                                    const urlData = await urlResponse.json();
                                    if (urlData.signedUrl) {
                                        urls[flow.id] = urlData.signedUrl;
                                    }
                                    console.log(
                                        "Signed URL for thumbnail:",
                                        urls[flow.name],
                                    );
                                } catch (error) {
                                    console.error(
                                        "Error fetching signed URL for thumbnail:",
                                        error,
                                    );
                                }
                            } else if (flow.thumbnail) {
                                urls[flow.id] = flow.thumbnail;
                            }
                        }),
                    );
                    setThumbnailUrls(urls);
                }
            }
        } catch (error) {
            console.error("Error fetching flows:", error);
        } finally {
            setLoading(false);
        }
    }, [session]);

    useEffect(() => {
        if (status === "authenticated") {
            fetchFlows();
        }
    }, [status, fetchFlows]);

    const handleCreateFlow = async () => {
        setCreating(true);
        try {
            const response = await fetch("/api/flows", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: "New Flow",
                    nodes: [],
                    edges: [],
                }),
            });

            if (response.ok) {
                const flow = await response.json();
                router.push(`/flow/${flow.id}`);
            }
        } catch (error) {
            console.error("Error creating flow:", error);
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteFlow = async (flowId: string) => {
        if (!confirm("Are you sure you want to delete this flow?")) return;

        try {
            const response = await fetch(`/api/flows/${flowId}`, {
                method: "DELETE",
            });

            if (response.ok) {
                setFlows(flows.filter((f) => f.id !== flowId));
            }
        } catch (error) {
            console.error("Error deleting flow:", error);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    if (status === "loading") {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="bg-background flex h-screen flex-col">
            <header className="border-border bg-card flex h-14 items-center justify-between border-b px-8">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-md">
                            <span className="text-primary-foreground text-sm font-bold">
                                F
                            </span>
                        </div>
                        <h1 className="text-foreground text-lg font-semibold">
                            FlowCraft
                        </h1>
                    </div>
                </div>
                <UserProfile isCollapsed={false} />
            </header>

            <div className="flex-1 overflow-auto p-8">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h2 className="text-foreground mb-2 text-2xl font-semibold">
                                Your Flows
                            </h2>
                            <p className="text-muted-foreground">
                                Create and manage your AI workflows
                            </p>
                        </div>
                        <Button
                            onClick={handleCreateFlow}
                            disabled={creating}
                            size="lg"
                        >
                            {creating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Flow
                                </>
                            )}
                        </Button>
                    </div>

                    {loading ? (
                        <div className="flex h-64 items-center justify-center">
                            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                        </div>
                    ) : flows.length === 0 ? (
                        <div className="border-border flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed">
                            <div className="max-w-md text-center">
                                <h3 className="text-foreground mb-2 text-lg font-semibold">
                                    No flows yet
                                </h3>
                                <p className="text-muted-foreground mb-6">
                                    Create your first flow to get started
                                </p>
                                <Button
                                    onClick={handleCreateFlow}
                                    disabled={creating}
                                >
                                    {creating ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Create Flow
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {flows.map((flow) => (
                                <div
                                    key={flow.id}
                                    className="group border-border bg-card relative cursor-pointer overflow-hidden rounded-lg border transition-shadow hover:shadow-lg"
                                    onClick={() =>
                                        router.push(`/flow/${flow.id}`)
                                    }
                                >
                                    <div className="bg-muted flex aspect-video items-center justify-center">
                                        {thumbnailUrls[flow.id] ? (
                                            <Image
                                                src={thumbnailUrls[flow.id]}
                                                alt={flow.name}
                                                width={300}
                                                height={200}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="text-muted-foreground text-center">
                                                <div className="bg-primary mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-md">
                                                    <span className="text-primary-foreground text-sm font-bold">
                                                        F
                                                    </span>
                                                </div>
                                                <p className="text-xs">
                                                    No preview
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <h3 className="text-foreground group-hover:text-primary mb-2 font-semibold transition-colors">
                                            {flow.name}
                                        </h3>
                                        <div className="text-muted-foreground flex items-center gap-4 text-sm">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                <span>
                                                    {formatDate(flow.updatedAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteFlow(flow.id);
                                        }}
                                        className="bg-background/80 hover:bg-background absolute top-2 right-2 rounded-md p-2 opacity-0 transition-opacity group-hover:opacity-100"
                                    >
                                        <Trash2 className="text-destructive h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
