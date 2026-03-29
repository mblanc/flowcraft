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
    Users,
    Globe,
    Copy,
    PanelRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserProfile } from "@/components/flow/user-profile";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

export default function FlowsList() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activeTab, setActiveTabRaw] = useState<string>("my");

    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedTab = localStorage.getItem("flowcraft_tab");
            if (savedTab && savedTab !== "my") {
                setActiveTabRaw(savedTab);
            }
        }
    }, []);

    const setActiveTab = (val: string) => {
        setActiveTabRaw(val);
        if (typeof window !== "undefined") {
            localStorage.setItem("flowcraft_tab", val);
        }
    };
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

    const isAdmin = session?.user?.isAdmin || false;

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

    if (status === "loading") {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
        );
    }

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
                className="group border-border bg-card relative cursor-pointer overflow-hidden rounded-lg border transition-shadow hover:shadow-lg"
                onClick={() => router.push(path)}
            >
                <div className="bg-muted flex aspect-video items-center justify-center">
                    {thumbnailUrls[item.id] ? (
                        <Image
                            src={thumbnailUrls[item.id]}
                            alt={item.name}
                            width={300}
                            height={200}
                            className="h-full w-full object-cover"
                            unoptimized
                        />
                    ) : (
                        <div className="text-muted-foreground text-center">
                            <div
                                className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-md ${iconBg}`}
                            >
                                <IconComponent className="h-4 w-4 text-white" />
                            </div>
                            <p className="text-xs">No preview</p>
                        </div>
                    )}
                </div>
                <div className="p-4">
                    <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-foreground group-hover:text-primary flex-1 truncate font-semibold transition-colors">
                            {item.name}
                        </h3>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(item.updatedAt)}</span>
                        </div>
                    </div>
                </div>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
                                className="bg-background/80 hover:bg-background rounded-md p-2"
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
                            className="bg-background/80 hover:bg-background rounded-md p-2"
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

        let title = `No ${isFlow ? "flows" : "custom nodes"} yet`;
        let description = isFlow
            ? "Create your first flow to get started"
            : "Create reusable components for your flows";

        if (isFlow && !isMyTab) {
            if (activeTab === "shared") {
                title = "No flows shared with you yet";
                description =
                    "Flows shared with you by others will appear here";
            } else if (activeTab === "community") {
                title = "No community templates available yet";
                description = "Check back later for new templates";
            }
        }

        return (
            <div className="border-border flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed">
                <div className="max-w-md text-center">
                    <h3 className="text-foreground mb-2 text-lg font-semibold">
                        {title}
                    </h3>
                    <p className="text-muted-foreground mb-4">{description}</p>
                    {isMyTab && (
                        <Button
                            onClick={onCreate}
                            disabled={creating}
                            size="sm"
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
                    {/* Header */}
                    <div className="mb-8 flex items-end justify-between">
                        <div>
                            <h2 className="text-foreground mb-2 text-2xl font-semibold">
                                Dashboard
                            </h2>
                            <p className="text-muted-foreground">
                                Manage your workflows and custom nodes
                            </p>
                        </div>
                    </div>

                    <Tabs
                        value={activeTab}
                        onValueChange={setActiveTab}
                        className="space-y-8"
                    >
                        <TabsList className="bg-muted/50 border-border border p-1">
                            <TabsTrigger
                                value="my"
                                className="data-[state=active]:bg-background flex items-center gap-2 px-6"
                            >
                                <Workflow className="h-4 w-4" />
                                My Flows
                            </TabsTrigger>
                            <TabsTrigger
                                value="shared"
                                className="data-[state=active]:bg-background flex items-center gap-2 px-6"
                            >
                                <Users className="h-4 w-4" />
                                Shared with me
                            </TabsTrigger>
                            <TabsTrigger
                                value="community"
                                className="data-[state=active]:bg-background flex items-center gap-2 px-6"
                            >
                                <Globe className="h-4 w-4" />
                                Community
                            </TabsTrigger>
                            {isAdmin && (
                                <TabsTrigger
                                    value="canvas"
                                    className="data-[state=active]:bg-background flex items-center gap-2 px-6"
                                >
                                    <PanelRight className="h-4 w-4" />
                                    Canvas
                                </TabsTrigger>
                            )}
                        </TabsList>

                        <TabsContent value={activeTab} className="space-y-12">
                            {loading ? (
                                <div className="flex h-64 items-center justify-center">
                                    <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                                </div>
                            ) : activeTab === "canvas" ? (
                                <section>
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <PanelRight className="h-5 w-5 text-blue-600" />
                                            <h3 className="text-foreground text-lg font-semibold">
                                                Canvases
                                            </h3>
                                            <span className="text-muted-foreground text-sm">
                                                ({canvases.length})
                                            </span>
                                        </div>
                                        <Button
                                            onClick={handleCreateCanvas}
                                            disabled={creatingCanvas}
                                            size="sm"
                                        >
                                            {creatingCanvas ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Creating...
                                                </>
                                            ) : (
                                                <>
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    New Canvas
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                    {canvases.length === 0 ? (
                                        <div className="border-border flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed">
                                            <div className="max-w-md text-center">
                                                <h3 className="text-foreground mb-2 text-lg font-semibold">
                                                    No canvases yet
                                                </h3>
                                                <p className="text-muted-foreground mb-4">
                                                    Create your first canvas to
                                                    start generating media with
                                                    AI
                                                </p>
                                                <Button
                                                    onClick={handleCreateCanvas}
                                                    disabled={creatingCanvas}
                                                    size="sm"
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
                                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                                <>
                                    {/* Flows Section */}
                                    <section>
                                        <div className="mb-4 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-foreground text-lg font-semibold">
                                                    {activeTab === "my"
                                                        ? "Flows"
                                                        : activeTab === "shared"
                                                          ? "Shared Flows"
                                                          : "Community Templates"}
                                                </h3>
                                                <span className="text-muted-foreground text-sm">
                                                    ({flows.length})
                                                </span>
                                            </div>
                                            {activeTab === "my" && (
                                                <Button
                                                    onClick={handleCreateFlow}
                                                    disabled={creatingFlow}
                                                    size="sm"
                                                >
                                                    {creatingFlow ? (
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
                                            )}
                                        </div>
                                        {flows.length === 0 ? (
                                            renderEmptyState(
                                                "flow",
                                                handleCreateFlow,
                                                creatingFlow,
                                            )
                                        ) : (
                                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                                                {flows.map((flow) =>
                                                    renderCard(
                                                        flow,
                                                        "flow",
                                                        handleDeleteFlow,
                                                    ),
                                                )}
                                            </div>
                                        )}
                                    </section>

                                    {/* Custom Nodes Section - Only show in My Flows for now */}
                                    {activeTab === "my" && (
                                        <section>
                                            <div className="mb-4 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Box className="h-5 w-5 text-purple-500" />
                                                    <h3 className="text-foreground text-lg font-semibold">
                                                        Custom Nodes
                                                    </h3>
                                                    <span className="text-muted-foreground text-sm">
                                                        ({customNodes.length})
                                                    </span>
                                                </div>
                                                <Button
                                                    onClick={
                                                        handleCreateCustomNode
                                                    }
                                                    disabled={creatingNode}
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-purple-500 text-purple-500 hover:bg-purple-500/10"
                                                >
                                                    {creatingNode ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            Creating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Plus className="mr-2 h-4 w-4" />
                                                            New Custom Node
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                            {customNodes.length === 0 ? (
                                                renderEmptyState(
                                                    "custom-node",
                                                    handleCreateCustomNode,
                                                    creatingNode,
                                                )
                                            ) : (
                                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                                </>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
