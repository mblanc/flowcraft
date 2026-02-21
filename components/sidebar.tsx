"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import { ConfigPanel } from "./config-panel";
import {
    X,
    Bot,
    FileText,
    ImageIcon,
    Video,
    FileUp,
    ZoomIn,
    Scaling,
    LogIn,
    LogOut,
    Box,
} from "lucide-react";
import { Button } from "./ui/button";

export function Sidebar() {
    const selectedNode = useFlowStore((state) => state.selectedNode);
    const selectNode = useFlowStore((state) => state.selectNode);

    // Hide sidebar entirely when no node is selected
    if (!selectedNode) {
        return null;
    }

    const getNodeTypeInfo = () => {
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
            case "upscale":
                return {
                    title: "Upscale Configuration",
                    icon: ZoomIn,
                    color: "text-red-400",
                };
            case "resize":
                return {
                    title: "Resize Configuration",
                    icon: Scaling,
                    color: "text-blue-400",
                };
            case "workflow-input":
                return {
                    title: "Input Configuration",
                    icon: LogIn,
                    color: "text-blue-400",
                };
            case "workflow-output":
                return {
                    title: "Output Configuration",
                    icon: LogOut,
                    color: "text-orange-400",
                };
            case "custom-workflow":
                return {
                    title: "Custom Node Configuration",
                    icon: Box,
                    color: "text-purple-500",
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
            <div className="border-border flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                    <nodeInfo.icon className={`h-4 w-4 ${nodeInfo.color}`} />
                    <h3 className="text-sm font-semibold">{nodeInfo.title}</h3>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => selectNode(null)}
                    aria-label="Close sidebar"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <ConfigPanel />
            </div>
        </div>
    );
}
