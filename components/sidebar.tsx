"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import { ConfigPanel } from "./config-panel";
import { WorkflowGallery } from "./workflow-gallery";
import {
    X,
    Bot,
    FileText,
    ImageIcon,
    Video,
    FileUp,
    Settings2,
    Library,
} from "lucide-react";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";

export function Sidebar() {
    const selectedNode = useFlowStore((state) => state.selectedNode);
    const selectNode = useFlowStore((state) => state.selectNode);
    const [activeTab, setActiveTab] = useState<"config" | "gallery">("gallery");

    // Automatically switch to config when a node is selected
    useEffect(() => {
        if (selectedNode && activeTab !== "config") {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActiveTab("config");
        }
    }, [selectedNode, activeTab]);

    const getNodeTypeInfo = () => {
        if (!selectedNode) return null;
        switch (selectedNode.data.type) {
            case "llm":
                return {
                    title: "Agent Configuration",
                    icon: Bot,
                    color: "text-primary",
                };
            case "text":
                return {
                    title: "Text Configuration",
                    icon: FileText,
                    color: "text-purple-400",
                };
            case "image":
                return {
                    title: "Image Configuration",
                    icon: ImageIcon,
                    color: "text-orange-400",
                };
            case "video":
                return {
                    title: "Video Configuration",
                    icon: Video,
                    color: "text-pink-400",
                };
            case "file":
                return {
                    title: "File Configuration",
                    icon: FileUp,
                    color: "text-cyan-400",
                };
            default:
                return {
                    title: "Configuration",
                    icon: Bot,
                    color: "text-primary",
                };
        }
    };

    const nodeInfo = getNodeTypeInfo();

    return (
        <div className="border-border bg-card flex w-96 flex-col border-l">
            <div className="border-border flex items-center justify-between border-b px-4 py-2">
                <div className="bg-muted flex w-full rounded-lg p-1">
                    <Button
                        variant={activeTab === "config" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 flex-1 text-xs"
                        onClick={() => setActiveTab("config")}
                        disabled={!selectedNode}
                    >
                        <Settings2 className="mr-2 h-3.5 w-3.5" />
                        Config
                    </Button>
                    <Button
                        variant={
                            activeTab === "gallery" ? "secondary" : "ghost"
                        }
                        size="sm"
                        className="h-8 flex-1 text-xs"
                        onClick={() => setActiveTab("gallery")}
                    >
                        <Library className="mr-2 h-3.5 w-3.5" />
                        Gallery
                    </Button>
                </div>
                {selectedNode && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 h-8 w-8 p-0"
                        onClick={() => selectNode(null)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {activeTab === "config" && selectedNode && (
                    <div className="flex flex-col gap-4">
                        <div className="mb-2 flex items-center gap-2">
                            {nodeInfo && (
                                <nodeInfo.icon
                                    className={`h-4 w-4 ${nodeInfo.color}`}
                                />
                            )}
                            <h3 className="text-sm font-semibold">
                                {nodeInfo?.title}
                            </h3>
                        </div>
                        <ConfigPanel />
                    </div>
                )}

                {activeTab === "gallery" && <WorkflowGallery />}

                {activeTab === "config" && !selectedNode && (
                    <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center p-8 text-center">
                        <Settings2 className="mb-2 h-8 w-8 opacity-20" />
                        <p className="text-xs">Select a node to configure</p>
                    </div>
                )}
            </div>
        </div>
    );
}
