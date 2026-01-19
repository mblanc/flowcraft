"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import { ConfigPanel } from "./config-panel";
import { X, Bot, FileText, ImageIcon, Video, FileUp } from "lucide-react";
import { Button } from "./ui/button";

export function Sidebar() {
    const selectedNode = useFlowStore((state) => state.selectedNode);
    const selectNode = useFlowStore((state) => state.selectNode);

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
            default:
                return {
                    title: "Configuration",
                    icon: Bot,
                    color: "text-primary",
                };
        }
    };

    const { title, icon: Icon, color } = getNodeTypeInfo();

    return (
        <div className="border-border bg-card flex w-96 flex-col border-l">
            <div className="border-border flex items-center justify-between border-b p-4">
                <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${color}`} />
                    <h2 className="text-foreground font-semibold">{title}</h2>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => selectNode(null)}
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
