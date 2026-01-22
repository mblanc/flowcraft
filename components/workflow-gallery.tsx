"use client";

import { useEffect, useState, useCallback } from "react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { Button } from "./ui/button";
import { Loader2, Box, Plus, User, Globe } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

interface PublishedFlow {
    id: string;
    name: string;
    publishedVersion: string;
    thumbnail?: string;
    visibility: "public" | "private";
}

export function WorkflowGallery() {
    const [flows, setFlows] = useState<PublishedFlow[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "mine" | "public">("all");
    const addNodeWithType = useFlowStore((state) => state.addNodeWithType);

    const fetchPublishedFlows = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/flows/published?filter=${filter}`);
            if (!res.ok) throw new Error("Failed to fetch gallery");
            const data = await res.json();
            setFlows(data.flows);
        } catch {
            toast.error("Failed to load workflow gallery");
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchPublishedFlows();
    }, [fetchPublishedFlows]);

    const handleAddFlow = (flow: PublishedFlow) => {
        addNodeWithType("custom-workflow", undefined, {
            subWorkflowId: flow.id,
            subWorkflowVersion: flow.publishedVersion,
            name: flow.name,
        });

        toast.info(`Added ${flow.name} to canvas`);
    };

    return (
        <div className="flex h-full flex-col gap-4">
            <div className="bg-muted flex items-center gap-1 self-start rounded-md p-1 text-[10px]">
                <Button
                    variant={filter === "all" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    onClick={() => setFilter("all")}
                >
                    All
                </Button>
                <Button
                    variant={filter === "mine" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    onClick={() => setFilter("mine")}
                >
                    <User className="mr-1 h-3 w-3" /> Mine
                </Button>
                <Button
                    variant={filter === "public" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    onClick={() => setFilter("public")}
                >
                    <Globe className="mr-1 h-3 w-3" /> Public
                </Button>
            </div>

            {loading ? (
                <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                </div>
            ) : flows.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center">
                    <Box className="text-muted-foreground mb-2 h-8 w-8 opacity-20" />
                    <p className="text-muted-foreground text-xs font-medium">
                        No published workflows found
                    </p>
                    <p className="text-muted-foreground/60 mt-1 text-[10px]">
                        Publish a workflow to see it here
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 overflow-y-auto pr-1 pb-4">
                    {flows.map((flow) => (
                        <div
                            key={flow.id}
                            className="group border-border bg-card hover:border-primary/50 flex flex-col gap-2 rounded-lg border p-3 transition-all"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-blue-500/10">
                                        <Box className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <div className="overflow-hidden">
                                        <h4 className="text-foreground group-hover:text-primary truncate text-[11px] font-semibold transition-colors">
                                            {flow.name}
                                        </h4>
                                        <p className="text-muted-foreground text-[9px]">
                                            v{flow.publishedVersion}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                                    onClick={() => handleAddFlow(flow)}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>

                            {flow.thumbnail && (
                                <div className="bg-muted border-border h-20 w-full overflow-hidden rounded border">
                                    <Image
                                        src={flow.thumbnail}
                                        alt=""
                                        width={300}
                                        height={80}
                                        className="h-full w-full object-cover opacity-80"
                                    />
                                </div>
                            )}

                            <div className="mt-1 flex items-center gap-2">
                                <div className="text-muted-foreground bg-muted flex items-center rounded px-1.5 py-0.5 text-[8px] font-medium tracking-wider uppercase">
                                    {flow.visibility === "public" ? (
                                        <Globe className="mr-1 h-2 w-2" />
                                    ) : (
                                        <User className="mr-1 h-2 w-2" />
                                    )}
                                    {flow.visibility}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
