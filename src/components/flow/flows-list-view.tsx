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
    Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import logger from "@/app/logger";
import { fetchAndCacheSignedUrl } from "@/lib/cache/signed-urls";
import { isGcsUri } from "@/lib/utils/gcs-uri";
import { ShareDialog } from "@/components/sharing/ShareDialog";

async function fetchThumbnailUrl(
    id: string,
    thumbnail: string | undefined,
): Promise<[string, string] | null> {
    if (!thumbnail) return null;

    if (isGcsUri(thumbnail)) {
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
    userId: string;
    name: string;
    thumbnail?: string;
    visibility: "private" | "public";
    sharedWith: { email: string; role: "view" | "edit" }[];
    isTemplate: boolean;
    createdAt: string;
    updatedAt: string;
}

const CANVAS_EMPTY_STATE = {
    "canvas-community": {
        title: "No community canvases yet",
        description: "Community canvas templates will appear here",
    },
    "canvas-shared": {
        title: "No canvases shared with you",
        description: "Canvases shared with you by others will appear here",
    },
    canvas: {
        title: "No canvases yet",
        description:
            "Create your first canvas to start generating media with AI",
    },
} as const;

function CanvasEmptyState({
    activeTab,
    onCreate,
    creating,
}: {
    activeTab: "canvas" | "canvas-community" | "canvas-shared";
    onCreate: () => void;
    creating: boolean;
}) {
    const { title, description } = CANVAS_EMPTY_STATE[activeTab];
    return (
        <div className="border-border flex h-56 flex-col items-center justify-center rounded-lg border border-dashed">
            <div className="max-w-sm text-center">
                <h3 className="text-foreground mb-1.5 text-base font-semibold">
                    {title}
                </h3>
                <p className="text-muted-foreground mb-6 text-sm">
                    {description}
                </p>
                {activeTab === "canvas" && (
                    <Button
                        onClick={onCreate}
                        disabled={creating}
                        className="rounded-md"
                    >
                        {creating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Plus className="mr-2 h-4 w-4" />
                                Create canvas
                            </>
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
}

function CanvasCloneCard({
    canvas,
    thumbnailUrl,
    onClone,
}: {
    canvas: Canvas;
    thumbnailUrl?: string;
    onClone: (id: string) => void;
}) {
    return (
        <div className="group border-border bg-card relative overflow-hidden rounded-lg border transition-shadow duration-150 hover:shadow-sm">
            <div className="bg-muted flex aspect-video items-center justify-center overflow-hidden">
                {thumbnailUrl ? (
                    <Image
                        src={thumbnailUrl}
                        alt={canvas.name}
                        width={400}
                        height={250}
                        className="h-full w-full object-cover"
                        unoptimized
                    />
                ) : (
                    <div className="text-muted-foreground text-center">
                        <div className="bg-muted border-border mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-md border">
                            <PanelRight className="text-muted-foreground h-5 w-5" />
                        </div>
                        <p className="text-xs">No preview</p>
                    </div>
                )}
            </div>
            <div className="p-4">
                <h3 className="text-foreground mb-2 truncate text-sm font-semibold">
                    {canvas.name}
                </h3>
                <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => onClone(canvas.id)}
                >
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Clone to my workspace
                </Button>
            </div>
        </div>
    );
}

interface FlowsListViewProps {
    activeTab:
        | "my"
        | "shared"
        | "community"
        | "canvas"
        | "canvas-community"
        | "canvas-shared";
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
    const [shareTarget, setShareTarget] = useState<Canvas | null>(null);
    const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>(
        {},
    );

    const [activeSubTab, setActiveSubTab] =
        useState<FlowsListViewProps["activeTab"]>(activeTab);

    const fetchData = useCallback(async () => {
        setLoading(true);
        // Clear previous state to prevent old data from lingering during load
        setFlows([]);
        setCustomNodes([]);
        setCanvases([]);
        setThumbnailUrls({});
        try {
            if (session) {
                if (
                    activeSubTab === "canvas" ||
                    activeSubTab === "canvas-community" ||
                    activeSubTab === "canvas-shared"
                ) {
                    const tabParam =
                        activeSubTab === "canvas-community"
                            ? "community"
                            : activeSubTab === "canvas-shared"
                              ? "shared"
                              : "my";
                    const canvasResponse = await fetch(
                        `/api/canvases?tab=${tabParam}`,
                    );
                    if (canvasResponse.ok) {
                        const data = await canvasResponse.json();
                        const canvasList: Canvas[] = data.canvases || [];
                        setCanvases(canvasList);

                        const urls: Record<string, string> = {};
                        const canvasUrls = await Promise.all(
                            canvasList.map((canvas) =>
                                fetchThumbnailUrl(canvas.id, canvas.thumbnail),
                            ),
                        );
                        canvasUrls.forEach((result) => {
                            if (result) urls[result[0]] = result[1];
                        });
                        setThumbnailUrls(urls);
                    } else {
                        setThumbnailUrls({});
                    }
                } else {
                    const [flowsResponse, customNodesResponse] =
                        await Promise.all([
                            fetch(`/api/flows?tab=${activeSubTab}`),
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
    }, [session, activeSubTab]);

    useEffect(() => {
        if (status === "authenticated") {
            // eslint-disable-next-line react-hooks/set-state-in-effect
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

    const handleCloneCanvas = async (canvasId: string) => {
        try {
            const response = await fetch(`/api/canvases/${canvasId}/clone`, {
                method: "POST",
            });
            if (response.ok) {
                const clone = await response.json();
                router.push(`/canvas/${clone.id}`);
            }
        } catch (error) {
            logger.error("Error cloning canvas:", error);
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

        const IconComponent = isCanvas
            ? PanelRight
            : isCustomNode
              ? Box
              : Workflow;

        return (
            <div
                key={item.id}
                className="group border-border bg-card relative cursor-pointer overflow-hidden rounded-lg border transition-shadow duration-150 hover:shadow-sm"
                onClick={() => router.push(path)}
            >
                <div className="bg-muted flex aspect-video items-center justify-center overflow-hidden">
                    {thumbnailUrls[item.id] ? (
                        <Image
                            src={thumbnailUrls[item.id]}
                            alt={item.name}
                            width={400}
                            height={250}
                            className="h-full w-full object-cover"
                            unoptimized
                        />
                    ) : (
                        <div className="text-muted-foreground text-center">
                            <div className="bg-muted border-border mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-md border">
                                <IconComponent className="text-muted-foreground h-5 w-5" />
                            </div>
                            <p className="text-xs">No preview</p>
                        </div>
                    )}
                </div>
                <div className="p-4">
                    <div className="mb-1.5 flex items-center gap-2">
                        <h3 className="text-foreground group-hover:text-primary flex-1 truncate text-sm font-semibold transition-colors duration-150">
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
                <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    {!isCustomNode &&
                        !isCanvas &&
                        (activeSubTab === "shared" ||
                            activeSubTab === "community") && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCloneFlow(item.id);
                                }}
                                title="Clone flow"
                                className="bg-background/90 hover:bg-background border-border rounded-md border p-1.5 backdrop-blur-sm transition-colors duration-150"
                            >
                                <Copy className="text-primary h-3.5 w-3.5" />
                            </button>
                        )}
                    {isCanvas && activeSubTab === "canvas" && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShareTarget(item as Canvas);
                            }}
                            title="Share canvas"
                            className="bg-background/90 hover:bg-background border-border rounded-md border p-1.5 backdrop-blur-sm transition-colors duration-150"
                        >
                            <Share2 className="text-primary h-3.5 w-3.5" />
                        </button>
                    )}
                    {(activeSubTab === "my" || activeSubTab === "canvas") && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(item.id);
                            }}
                            title="Delete"
                            className="bg-background/90 hover:bg-background border-border rounded-md border p-1.5 backdrop-blur-sm transition-colors duration-150"
                        >
                            <Trash2 className="text-destructive h-3.5 w-3.5" />
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
        const isMyTab = activeSubTab === "my";

        let titleStr = `No ${isFlow ? "flows" : "custom nodes"} yet`;
        let descriptionStr = isFlow
            ? "Create your first flow to get started"
            : "Create reusable components for your flows";

        if (isFlow && !isMyTab) {
            if (activeSubTab === "shared") {
                titleStr = "No flows shared with you yet";
                descriptionStr =
                    "Flows shared with you by others will appear here";
            } else if (activeSubTab === "community") {
                titleStr = "No community templates available yet";
                descriptionStr = "Check back later for new templates";
            }
        }

        return (
            <div className="border-border flex h-56 flex-col items-center justify-center rounded-lg border border-dashed">
                <div className="max-w-sm text-center">
                    <h3 className="text-foreground mb-1.5 text-base font-semibold">
                        {titleStr}
                    </h3>
                    <p className="text-muted-foreground mb-6 text-sm">
                        {descriptionStr}
                    </p>
                    {isMyTab && (
                        <Button
                            onClick={onCreate}
                            disabled={creating}
                            className="rounded-md"
                        >
                            {creating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create {isFlow ? "flow" : "custom node"}
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

    const isFlowMode = ["my", "shared", "community"].includes(activeTab);
    const tabs = isFlowMode
        ? ([
              { value: "my", label: "My Flows" },
              { value: "shared", label: "Shared with me" },
              { value: "community", label: "Community Templates" },
          ] as const)
        : ([
              { value: "canvas", label: "My Agents" },
              { value: "canvas-shared", label: "Shared with me" },
              { value: "canvas-community", label: "Community Templates" },
          ] as const);

    return (
        <div className="space-y-16">
            <header className="flex items-end justify-between">
                <div>
                    <h1
                        className="text-foreground text-3xl font-bold sm:text-4xl"
                        style={{ letterSpacing: "-0.02em" }}
                    >
                        {title || (isFlowMode ? "Flows" : "Agents")}
                    </h1>
                    <p className="text-muted-foreground mt-1.5 text-sm">
                        {description ||
                            (isFlowMode
                                ? "Manage your custom visual workflows and reusable components"
                                : "Collaborative canvas for agent-driven media")}
                    </p>
                </div>
                {activeSubTab === "my" && (
                    <Button
                        onClick={handleCreateFlow}
                        disabled={creatingFlow}
                        className="rounded-md"
                    >
                        {creatingFlow ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Plus className="mr-2 h-4 w-4" />
                        )}
                        New flow
                    </Button>
                )}
                {activeSubTab === "canvas" && (
                    <Button
                        onClick={handleCreateCanvas}
                        disabled={creatingCanvas}
                        className="rounded-md"
                    >
                        {creatingCanvas ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Plus className="mr-2 h-4 w-4" />
                        )}
                        New canvas
                    </Button>
                )}
            </header>

            {/* Local Tab Bar */}
            <div className="border-border flex gap-1 border-b">
                {tabs.map((tab) => (
                    <button
                        key={tab.value}
                        onClick={() => setActiveSubTab(tab.value)}
                        className={`px-4 pb-2 text-sm font-medium transition-colors ${
                            activeSubTab === tab.value
                                ? "border-primary text-foreground border-b-2 font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="text-primary h-8 w-8 animate-spin" />
                </div>
            ) : activeSubTab === "canvas" ||
              activeSubTab === "canvas-community" ||
              activeSubTab === "canvas-shared" ? (
                <section>
                    {canvases.length === 0 ? (
                        <CanvasEmptyState
                            activeTab={
                                activeSubTab as
                                    | "canvas"
                                    | "canvas-community"
                                    | "canvas-shared"
                            }
                            onCreate={handleCreateCanvas}
                            creating={creatingCanvas}
                        />
                    ) : (
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {canvases.map((canvas) =>
                                activeSubTab === "canvas-community" ||
                                activeSubTab === "canvas-shared" ? (
                                    <CanvasCloneCard
                                        key={canvas.id}
                                        canvas={canvas}
                                        thumbnailUrl={thumbnailUrls[canvas.id]}
                                        onClone={handleCloneCanvas}
                                    />
                                ) : (
                                    renderCard(
                                        canvas,
                                        "canvas",
                                        handleDeleteCanvas,
                                    )
                                ),
                            )}
                        </div>
                    )}
                </section>
            ) : (
                <div className="space-y-12">
                    <section>
                        <div className="mb-4 flex items-center gap-2">
                            <h3
                                className="text-foreground text-base font-semibold"
                                style={{ letterSpacing: "-0.01em" }}
                            >
                                {activeSubTab === "my"
                                    ? "My flows"
                                    : activeSubTab === "shared"
                                      ? "Shared with me"
                                      : "Community flows"}
                            </h3>
                            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
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
                            <div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-2 lg:grid-cols-3">
                                {flows.map((flow) =>
                                    renderCard(flow, "flow", handleDeleteFlow),
                                )}
                            </div>
                        )}
                    </section>

                    {activeSubTab === "my" && (
                        <section>
                            <div className="mb-4 flex items-center gap-2">
                                <h3
                                    className="text-foreground text-base font-semibold"
                                    style={{ letterSpacing: "-0.01em" }}
                                >
                                    Custom nodes
                                </h3>
                                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
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
                </div>
            )}
            {shareTarget && (
                <ShareDialog
                    isOpen={!!shareTarget}
                    onClose={() => setShareTarget(null)}
                    artifactType="canvas"
                    artifactId={shareTarget.id}
                    artifactName={shareTarget.name}
                    currentVisibility={shareTarget.visibility}
                    sharedWith={shareTarget.sharedWith}
                    isTemplate={shareTarget.isTemplate}
                    isOwner={shareTarget.userId === session?.user?.id}
                    isAdmin={false}
                    onSaved={fetchData}
                />
            )}
        </div>
    );
}
