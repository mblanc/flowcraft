"use client";

import type React from "react";

import { useCallback, useState, useEffect } from "react";
import {
    ReactFlow,
    Controls,
    Panel,
    type Node,
    type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useFlow } from "./flow-provider";
import { AgentNode } from "./agent-node";
import { TextNode } from "./text-node";
import { ImageNode } from "./image-node";
import { VideoNode } from "./video-node";
import { FileNode } from "./file-node";
import { UpscaleNode } from "./upscale-node";
import { ResizeNode } from "./resize-node";
import { NodeType } from "@/lib/types";
import { Button } from "./ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "./ui/tooltip";
import {
    Bot,
    FileText,
    ImageIcon,
    Video,
    Play,
    FileUp,
    ZoomIn,
    Scaling,
} from "lucide-react";

const nodeTypes = {
    agent: AgentNode,
    text: TextNode,
    image: ImageNode,
    video: VideoNode,
    file: FileNode,
    upscale: UpscaleNode,
    resize: ResizeNode,
};

export function FlowCanvas() {
    const {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        addNode,
        selectNode,
        runFlow,
        isRunning,
        flowId,
    } = useFlow();

    const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(
        null,
    );
    const [hasFitted, setHasFitted] = useState(false);

    const [prevFlowId, setPrevFlowId] = useState(flowId);
    if (flowId !== prevFlowId) {
        setPrevFlowId(flowId);
        setHasFitted(false);
    }

    // Fit view when nodes are loaded and we haven't fitted yet
    useEffect(() => {
        if (rfInstance && nodes.length > 0 && !hasFitted && flowId) {
            window.requestAnimationFrame(() => {
                rfInstance.fitView({ padding: 0.2 });
                setHasFitted(true);
            });
        }
    }, [rfInstance, nodes.length, hasFitted, flowId]);

    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: Node) => {
            selectNode(node.id);
        },
        [selectNode],
    );

    const onPaneClick = useCallback(() => {
        selectNode(null);
    }, [selectNode]);

    const onDragStart = (event: React.DragEvent, nodeType: string) => {
        event.dataTransfer.setData("application/reactflow", nodeType);
        event.dataTransfer.effectAllowed = "move";
    };

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData(
                "application/reactflow",
            ) as NodeType;

            // check if the dropped element is valid
            if (typeof type === "undefined" || !type || !rfInstance) {
                return;
            }

            const position = rfInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            addNode(type, position);
        },
        [rfInstance, addNode],
    );

    const sidebarItems = [
        {
            type: "text",
            icon: FileText,
            color: "text-purple-500 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-950/20",
            label: "Text",
        },
        {
            type: "file",
            icon: FileUp,
            color: "text-cyan-500 hover:bg-cyan-50 hover:text-cyan-600 dark:hover:bg-cyan-950/20",
            label: "File",
        },
        {
            type: "agent",
            icon: Bot,
            color: "text-primary hover:text-primary/80 hover:bg-primary/10",
            label: "Agent",
        },
        {
            type: "image",
            icon: ImageIcon,
            color: "text-orange-500 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950/20",
            label: "Image",
        },
        {
            type: "video",
            icon: Video,
            color: "text-pink-500 hover:bg-pink-50 hover:text-pink-600 dark:hover:bg-pink-950/20",
            label: "Video",
        },
        {
            type: "upscale",
            icon: ZoomIn,
            color: "text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20",
            label: "Upscale",
        },
        {
            type: "resize",
            icon: Scaling,
            color: "text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/20",
            label: "Resize",
        },
    ] as const;

    return (
        <div className="relative flex h-full flex-1">
            <aside className="border-border bg-card z-10 flex w-14 flex-col items-center gap-4 border-r py-4">
                <TooltipProvider>
                    {sidebarItems.map((item) => (
                        <Tooltip key={item.type}>
                            <TooltipTrigger asChild>
                                <div
                                    onDragStart={(event) =>
                                        onDragStart(event, item.type)
                                    }
                                    draggable
                                >
                                    <Button
                                        onClick={() =>
                                            addNode(item.type as NodeType)
                                        }
                                        size="icon"
                                        variant="ghost"
                                        className={`h-10 w-10 cursor-grab active:cursor-grabbing ${item.color}`}
                                    >
                                        <item.icon className="h-5 w-5" />
                                    </Button>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                <p>Add {item.label} Node</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </TooltipProvider>
            </aside>

            <div
                className="relative h-full flex-1"
                onDrop={onDrop}
                onDragOver={onDragOver}
            >
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    onInit={setRfInstance}
                    nodeTypes={nodeTypes}
                    proOptions={{ hideAttribution: true }}
                    defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
                    minZoom={0.1}
                    maxZoom={2}
                    className="react-flow"
                    style={{ backgroundColor: "#e7e7e7" }}
                >
                    <Controls />
                    <Panel
                        position="top-right"
                        className="bg-card border-border rounded-lg border p-2"
                    >
                        <Button
                            onClick={runFlow}
                            disabled={isRunning}
                            size="sm"
                            className="bg-green-500 text-white hover:bg-green-600"
                        >
                            <Play className="mr-2 h-4 w-4" />
                            {isRunning ? "Running..." : "Run Flow"}
                        </Button>
                    </Panel>
                </ReactFlow>
            </div>
        </div>
    );
}
