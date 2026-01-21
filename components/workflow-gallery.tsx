"use client";

import { useEffect, useState } from "react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { Button } from "./ui/button";
import { Loader2, Box, Plus, User, Globe } from "lucide-react";
import { toast } from "sonner";

export function WorkflowGallery() {
    const [flows, setFlows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "mine" | "public">("all");
    const addNodeWithType = useFlowStore((state) => state.addNodeWithType);
    const updateNodeData = useFlowStore((state) => state.updateNodeData);

    const fetchPublishedFlows = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/flows/published?filter=${filter}`);
            if (!res.ok) throw new Error("Failed to fetch gallery");
            const data = await res.json();
            setFlows(data.flows);
        } catch (error) {
            toast.error("Failed to load workflow gallery");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPublishedFlows();
    }, [filter]);

    const handleAddFlow = (flow: any) => {
        addNodeWithType("custom-workflow", undefined, {
            subWorkflowId: flow.id,
            subWorkflowVersion: flow.publishedVersion,
            name: flow.name,
        } as any);
        
        toast.info(`Added ${flow.name} to canvas`);
    };

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center gap-1 p-1 bg-muted rounded-md self-start text-[10px]">
                <Button 
                    variant={filter === "all" ? "secondary" : "ghost"} 
                    size="sm" 
                    className="h-7 text-[10px] px-2"
                    onClick={() => setFilter("all")}
                >
                    All
                </Button>
                <Button 
                    variant={filter === "mine" ? "secondary" : "ghost"} 
                    size="sm" 
                    className="h-7 text-[10px] px-2"
                    onClick={() => setFilter("mine")}
                >
                    <User className="mr-1 h-3 w-3" /> Mine
                </Button>
                <Button 
                    variant={filter === "public" ? "secondary" : "ghost"} 
                    size="sm" 
                    className="h-7 text-[10px] px-2"
                    onClick={() => setFilter("public")}
                >
                    <Globe className="mr-1 h-3 w-3" /> Public
                </Button>
            </div>

            {loading ? (
                <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : flows.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                    <Box className="h-8 w-8 text-muted-foreground mb-2 opacity-20" />
                    <p className="text-xs text-muted-foreground font-medium">No published workflows found</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Publish a workflow to see it here</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 overflow-y-auto pr-1 pb-4">
                    {flows.map((flow) => (
                        <div 
                            key={flow.id} 
                            className="group border border-border bg-card hover:border-primary/50 rounded-lg p-3 transition-all flex flex-col gap-2"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-blue-500/10">
                                        <Box className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <div className="overflow-hidden">
                                        <h4 className="text-[11px] font-semibold truncate text-foreground group-hover:text-primary transition-colors">
                                            {flow.name}
                                        </h4>
                                        <p className="text-[9px] text-muted-foreground">
                                            v{flow.publishedVersion}
                                        </p>
                                    </div>
                                </div>
                                <Button 
                                    size="icon" 
                                    variant="outline" 
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleAddFlow(flow)}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                            
                            {flow.thumbnail && (
                                <div className="h-20 w-full rounded overflow-hidden bg-muted border border-border">
                                    <img src={flow.thumbnail} alt="" className="w-full h-full object-cover opacity-80" />
                                </div>
                            )}

                            <div className="flex items-center gap-2 mt-1">
                                <div className="flex items-center text-[8px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    {flow.visibility === 'public' ? <Globe className="mr-1 h-2 w-2" /> : <User className="mr-1 h-2 w-2" />}
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
