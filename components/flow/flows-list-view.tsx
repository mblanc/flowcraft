"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    Plus,
    Trash2,
    Calendar,
    Loader2,
    Box,
    Workflow,
    Copy,
    PanelRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import logger from "@/app/logger";
import { fetchAndCacheSignedUrl } from "@/lib/cache/signed-url-cache";

async function fetchThumbnailUrl(
    id: string,
    thumbnail: string | undefined,
): Promise<[string, string] | null> {
    if (!thumbnail) return null;

    if (thumbnail.startsWith("gs://")) {
        try {
            const signedUrl = await fetchAndCacheSignedUrl(thumbnail);
            if (signedUrl) return [id, signedUrl];
        } catch (error) {
            logger.error("Error fetching signed URL for thumbnail:", error);
        }
        return null;
    }

    return [id, thumbnail];
}

interface Flow {
    id: string;
    name: string;
    thumbnail?: string;
    createdAt: string;
    updatedAt: string;
}

interface CustomNode {
    id: string;
    name: string;
    thumbnail?: string;
    createdAt: string;
    updatedAt: string;
}

interface Canvas {
    id: string;
    name: string;
    thumbnail?: string;
    createdAt: string;
    updatedAt: string;
}

interface FlowsListViewProps {
    activeTab: "my" | "shared" | "community" | "canvas";
    title?: string;
    description?: string;
}

export function FlowsListView({
    activeTab,
    title,
    description,
}: FlowsListViewProps) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [flows, setFlows] = useState<Flow[]>([]);
    const [customNodes, setCustomNodes] = useState<CustomNode[]>([]);
    const [canvases, setCanvases] = useState<Canvas[]>([]);
    const [loading, setLoading] = useState(true);
    const [creatingFlow, setCreatingFlow] = useState(false);
    const [creatingNode, setCreatingNode] = useState(false);
    const [creatingCanvas, setCreatingCanvas] = useState(false);
    const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>(
        {},
    );

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (session) {
                if (activeTab === "canvas") {
                    const canvasResponse = await fetch("/api/canvases");
                    if (canvasResponse.ok) {
                        const data = await canvasResponse.json();
                        setCanvases(data.canvases || []);
                    }
                    setThumbnailUrls({});
                } else {
                    const [flowsResponse, customNodesResponse] =
                        await Promise.all([
                            fetch(`/api/flows?tab=${activeTab}`),
                            fetch("/api/custom-nodes"),
                        ]);

                    const urls: Record<string, string> = {};

                    if (flowsResponse.ok) {
                        const flowsData = await flowsResponse.json();
                        const flowsList = flowsData.flows || [];
                        setFlows(flowsList);

                        const flowUrls = await Promise.all(
                            flowsList.map((flow: Flow) =>
                                fetchThumbnailUrl(flow.id, flow.thumbnail),
                            ),
                        );
                        flowUrls.forEach((result) => {
                            if (result) urls[result[0]] = result[1];
                        });
                    }

                    if (customNodesResponse.ok) {
                        const nodesData = await customNodesResponse.json();
                        const nodesList = nodesData.customNodes || [];
                        setCustomNodes(nodesList);

                        const nodeUrls = await Promise.all(
                            nodesList.map((node: CustomNode) =>
                                fetchThumbnailUrl(node.id, node.thumbnail),
                            ),
                        );
                        nodeUrls.forEach((result) => {
                            if (result) urls[result[0]] = result[1];
                        });
                    }

                    setThumbnailUrls(urls);
                }
            }
        } catch (error) {
            logger.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    }, [session, activeTab]);

    useEffect(() => {
        if (status === "authenticated") {
            fetchData();
        }
    }, [status, fetchData]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/sign-in");
        }
    }, [status, router]);

    const handleCreateFlow = async () => {
        setCreatingFlow(true);
        try {
            const response = await fetch("/api/flows", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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
            logger.error("Error creating flow:", error);
        } finally {
            setCreatingFlow(false);
        }
    };

    const handleCreateCustomNode = async () => {
        setCreatingNode(true);
        try {
            const response = await fetch("/api/custom-nodes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "New Custom Node",
                    nodes: [
                        {
                            id: "input-1",
                            type: "workflow-input",
                            position: { x: 100, y: 200 },
                            data: {
                                type: "workflow-input",
                                name: "Input",
                                portName: "input",
                                portType: "text",
                                portRequired: true,
                            },
                        },
                        {
                            id: "output-1",
                            type: "workflow-output",
                            position: { x: 500, y: 200 },
                            data: {
                                type: "workflow-output",
                                name: "Output",
                                portName: "output",
                                portType: "text",
                            },
                        },
                    ],
                    edges: [],
                }),
            });

            if (response.ok) {
                const customNode = await response.json();
                router.push(`/custom-node/${customNode.id}`);
            }
        } catch (error) {
            logger.error("Error creating custom node:", error);
        } finally {
            setCreatingNode(false);
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
            logger.error("Error deleting flow:", error);
        }
    };

    const handleCloneFlow = async (flowId: string) => {
        try {
            const response = await fetch(`/api/flows/${flowId}/clone`, {
                method: "POST",
            });

            if (response.ok) {
                const newFlow = await response.json();
                router.push(`/flow/${newFlow.id}`);
            }
        } catch (error) {
            logger.error("Error cloning flow:", error);
        }
    };

    const handleDeleteCustomNode = async (nodeId: string) => {
        if (!confirm("Are you sure you want to delete this custom node?"))
            return;

        try {
            const response = await fetch(`/api/custom-nodes/${nodeId}`, {
                method: "DELETE",
            });

            if (response.ok) {
                setCustomNodes(customNodes.filter((n) => n.id !== nodeId));
            }
        } catch (error) {
            logger.error("Error deleting custom node:", error);
        }
    };

    const handleCreateCanvas = async () => {
        setCreatingCanvas(true);
        try {
            const response = await fetch("/api/canvases", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "Untitled Canvas" }),
            });

            if (response.ok) {
                const canvas = await response.json();
                router.push(`/canvas/${canvas.id}`);
            }
        } catch (error) {
            logger.error("Error creating canvas:", error);
        } finally {
            setCreatingCanvas(false);
        }
    };

    const handleDeleteCanvas = async (canvasId: string) => {
        if (!confirm("Are you sure you want to delete this canvas?")) return;

        try {
            const response = await fetch(`/api/canvases/${canvasId}`, {
                method: "DELETE",
            });

            if (response.ok) {
                setCanvases(canvases.filter((c) => c.id !== canvasId));
            }
        } catch (error) {
            logger.error("Error deleting canvas:", error);
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

    const renderCard = (
        item: Flow | CustomNode | Canvas,
        type: "flow" | "custom-node" | "canvas",
        onDelete: (id: string) => void,
    ) => {
        const isCustomNode = type === "custom-node";
        const isCanvas = type === "canvas";
        const path = isCanvas
            ? `/canvas/${item.id}`
            : isCustomNode
              ? `/custom-node/${item.id}`
              : `/flow/${item.id}`;

        const iconBg = isCanvas
            ? "bg-blue-600"
            : isCustomNode
              ? "bg-purple-500"
              : "bg-primary";

        const IconComponent = isCanvas
            ? PanelRight
            : isCustomNode
              ? Box
              : Workflow;

        return (
            <div
                key={item.id}
                className="group border-border bg-card relative cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
                onClick={() => router.push(path)}
            >
                <div className="bg-muted flex aspect-video items-center justify-center">
                    {thumbnailUrls[item.id] ? (
                        <Image
                            src={thumbnailUrls[item.id]}
                            alt={item.name}
                            width={400}
                            height={250}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                            unoptimized
                        />
                    ) : (
                        <div className="text-muted-foreground text-center">
                            <div
                                className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl shadow-lg ${iconBg}`}
                            >
                                <IconComponent className="h-5 w-5 text-white" />
                            </div>
                            <p className="text-xs font-medium">No preview</p>
                        </div>
                    )}
                </div>
                <div className="p-5">
                    <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-foreground group-hover:text-primary flex-1 truncate font-bold transition-colors">
                            {item.name}
                        </h3>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Updated {formatDate(item.updatedAt)}</span>
                        </div>
                    </div>
                </div>
                <div className="absolute top-3 right-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    {!isCustomNode &&
                        !isCanvas &&
                        (activeTab === "shared" ||
                            activeTab === "community") && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCloneFlow(item.id);
                                }}
                                title="Clone Flow"
                                className="bg-background/90 hover:bg-background border-border rounded-xl border p-2 shadow-sm backdrop-blur-sm"
                            >
                                <Copy className="text-primary h-4 w-4" />
                            </button>
                        )}
                    {(activeTab === "my" || activeTab === "canvas") && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(item.id);
                            }}
                            title="Delete"
                            className="bg-background/90 hover:bg-background border-border rounded-xl border p-2 shadow-sm backdrop-blur-sm"
                        >
                            <Trash2 className="text-destructive h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderEmptyState = (
        type: "flow" | "custom-node",
        onCreate: () => void,
        creating: boolean,
    ) => {
        const isFlow = type === "flow";
        const isMyTab = activeTab === "my";

        let titleStr = `No ${isFlow ? "flows" : "custom nodes"} yet`;
        let descriptionStr = isFlow
            ? "Create your first flow to get started"
            : "Create reusable components for your flows";

        if (isFlow && !isMyTab) {
            if (activeTab === "shared") {
                titleStr = "No flows shared with you yet";
                descriptionStr =
                    "Flows shared with you by others will appear here";
            } else if (activeTab === "community") {
                titleStr = "No community templates available yet";
                descriptionStr = "Check back later for new templates";
            }
        }

        return (
            <div className="border-border/50 bg-muted/30 flex h-64 flex-col items-center justify-center rounded-3xl border-2 border-dashed">
                <div className="max-w-md text-center">
                    <h3 className="text-foreground mb-2 text-xl font-bold">
                        {titleStr}
                    </h3>
                    <p className="text-muted-foreground mb-6">
                        {descriptionStr}
                    </p>
                    {isMyTab && (
                        <Button
                            onClick={onCreate}
                            disabled={creating}
                            className="rounded-xl px-8"
                        >
                            {creating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create {isFlow ? "Flow" : "Custom Node"}
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    if (status === "unauthenticated") {
        return null;
    }

    return (
        <div className="space-y-12">
            <header className="flex items-end justify-between">
                <div>
                    <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                        {title || "Dashboard"}
                    </h1>
                    <p className="text-muted-foreground mt-2 text-lg">
                        {description || "Manage your projects and resources"}
                    </p>
                </div>
                {activeTab === "my" && (
                    <Button
                        onClick={handleCreateFlow}
                        disabled={creatingFlow}
                        className="shadow-primary/20 rounded-xl shadow-lg"
                    >
                        {creatingFlow ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Plus className="mr-2 h-4 w-4" />
                        )}
                        New Flow
                    </Button>
                )}
                {activeTab === "canvas" && (
                    <Button
                        onClick={handleCreateCanvas}
                        disabled={creatingCanvas}
                        className="shadow-primary/20 rounded-xl shadow-lg"
                    >
                        {creatingCanvas ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Plus className="mr-2 h-4 w-4" />
                        )}
                        New Canvas
                    </Button>
                )}
            </header>

            {loading ? (
                <div className="flex h-96 items-center justify-center">
                    <Loader2 className="text-primary h-12 w-12 animate-spin" />
                </div>
            ) : activeTab === "canvas" ? (
                <section>
                    {canvases.length === 0 ? (
                        <div className="border-border/50 bg-muted/30 flex h-64 flex-col items-center justify-center rounded-3xl border-2 border-dashed">
                            <div className="max-w-md text-center">
                                <h3 className="text-foreground mb-2 text-xl font-bold">
                                    No canvases yet
                                </h3>
                                <p className="text-muted-foreground mb-6">
                                    Create your first canvas to start generating
                                    media with AI
                                </p>
                                <Button
                                    onClick={handleCreateCanvas}
                                    disabled={creatingCanvas}
                                    className="rounded-xl px-8"
                                >
                                    {creatingCanvas ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Create Canvas
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                            {canvases.map((canvas) =>
                                renderCard(
                                    canvas,
                                    "canvas",
                                    handleDeleteCanvas,
                                ),
                            )}
                        </div>
                    )}
                </section>
            ) : (
                <div className="space-y-12">
                    {/* Flows Section */}
                    <section>
                        <div className="mb-6 flex items-center gap-2">
                            <h3 className="text-foreground text-xl font-bold">
                                {activeTab === "my"
                                    ? "My Flows"
                                    : activeTab === "shared"
                                      ? "Shared with Me"
                                      : "Community Flows"}
                            </h3>
                            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
                                {flows.length}
                            </span>
                        </div>
                        {flows.length === 0 ? (
                            renderEmptyState(
                                "flow",
                                handleCreateFlow,
                                creatingFlow,
                            )
                        ) : (
                            <div className="grid grid-cols-1 gap-8 text-sm md:grid-cols-2 lg:grid-cols-3">
                                {flows.map((flow) =>
                                    renderCard(flow, "flow", handleDeleteFlow),
                                )}
                            </div>
                        )}
                    </section>

                    {/* Custom Nodes Section - Only show in My Flows for now */}
                    {activeTab === "my" && (
                        <section>
                            <div className="mb-6 flex items-center gap-2">
                                <h3 className="text-foreground text-xl font-bold">
                                    Custom Nodes
                                </h3>
                                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
                                    {customNodes.length}
                                </span>
                            </div>
                            {customNodes.length === 0 ? (
                                renderEmptyState(
                                    "custom-node",
                                    handleCreateCustomNode,
                                    creatingNode,
                                )
                            ) : (
                                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                                    {customNodes.map((node) =>
                                        renderCard(
                                            node,
                                            "custom-node",
                                            handleDeleteCustomNode,
                                        ),
                                    )}
                                </div>
                            )}
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
