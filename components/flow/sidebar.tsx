"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import { ConfigPanel } from "../panels/config-panel";
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
    ListOrdered,
} from "lucide-react";
import { Button } from "../ui/button";

export function Sidebar() {
    const isConfigSidebarOpen = useFlowStore(
        (state) => state.isConfigSidebarOpen,
    );
    const setIsConfigSidebarOpen = useFlowStore(
        (state) => state.setIsConfigSidebarOpen,
    );
    const selectedNode = useFlowStore((state) => state.selectedNode);

    // Hide sidebar entirely when no node is selected or if it's not explicitly open
    if (!selectedNode || !isConfigSidebarOpen) {
        return null;
    }

    const getNodeTypeInfo = () => {
        switch (selectedNode.data.type) {
            case "llm":
                return { title: "Agent settings", icon: Bot };
            case "text":
                return { title: "Text settings", icon: FileText };
            case "image":
                return { title: "Image settings", icon: ImageIcon };
            case "video":
                return { title: "Video settings", icon: Video };
            case "file":
                return { title: "File settings", icon: FileUp };
            case "upscale":
                return { title: "Upscale settings", icon: ZoomIn };
            case "resize":
                return { title: "Resize settings", icon: Scaling };
            case "list":
                return { title: "List settings", icon: ListOrdered };
            case "workflow-input":
                return { title: "Input settings", icon: LogIn };
            case "workflow-output":
                return { title: "Output settings", icon: LogOut };
            case "custom-workflow":
                return { title: "Custom node settings", icon: Box };
            default:
                return { title: "Settings", icon: Bot };
        }
    };

    const nodeInfo = getNodeTypeInfo();

    return (
        <div className="border-border bg-card flex w-96 flex-col border-l">
            <div className="border-border flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                    <nodeInfo.icon className="text-muted-foreground h-4 w-4" />
                    <h3 className="text-sm font-semibold">{nodeInfo.title}</h3>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setIsConfigSidebarOpen(false)}
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
