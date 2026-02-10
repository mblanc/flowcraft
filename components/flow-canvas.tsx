"use client";

import type React from "react";

import { useCallback, useState, useEffect, useRef } from "react";
import {
    ReactFlow,
    Controls,
    Panel,
    type Node,
    type Edge,
    type ReactFlowInstance,
    type Connection,
    Background,
    BackgroundVariant,
    SelectionMode,
    ControlButton,
} from "@xyflow/react";
import { useSession } from "next-auth/react";
import "@xyflow/react/dist/style.css";
import { LLMNode } from "./llm-node";
import { TextNode } from "./text-node";
import { ImageNode } from "./image-node";
import { VideoNode } from "./video-node";
import { FileNode } from "./file-node";
import { UpscaleNode } from "./upscale-node";
import { ResizeNode } from "./resize-node";
import { WorkflowInputNode } from "./workflow-input-node";
import { WorkflowOutputNode } from "./workflow-output-node";
import { CustomWorkflowNode } from "./custom-workflow-node";
import {
    NodeType,
    NodeData,
    CustomWorkflowData,
    CustomNodePort,
} from "@/lib/types";
import {
    getSourcePortType,
    getTargetPortType,
    getNodeDefinition,
} from "@/lib/node-registry";
import { isTypeCompatible } from "@/lib/utils";
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
    LogIn,
    LogOut,
    Box,
    ChevronDown,
    ChevronRight,
    MousePointer2,
    Hand,
} from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import { useFlowExecution } from "@/hooks/use-flow-execution";
import { useTheme } from "next-themes";
import logger from "@/app/logger";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
} from "./ui/context-menu";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
    type OnConnectStartParams,
    type OnConnectEnd,
    type OnConnectStart,
} from "@xyflow/react";
import { createNode } from "@/lib/node-factory";
import { v4 as uuidv4 } from "uuid";

interface CustomNodeItem {
    id: string;
    name: string;
    inputs: CustomNodePort[];
    outputs: CustomNodePort[];
}

const nodeTypes = {
    llm: LLMNode,
    text: TextNode,
    image: ImageNode,
    video: VideoNode,
    file: FileNode,
    upscale: UpscaleNode,
    resize: ResizeNode,
    "workflow-input": WorkflowInputNode,
    "workflow-output": WorkflowOutputNode,
    "custom-workflow": CustomWorkflowNode,
};

const NODE_COLORS: Record<string, string> = {
    llm: "oklch(0.65 0.25 252)",
    text: "#a855f7", // purple-500
    image: "#f97316", // orange-500
    video: "#ec4899", // pink-500
    file: "#06b6d4", // cyan-500
    upscale: "#ef4444", // red-500
    resize: "#3b82f6", // blue-500
    "workflow-input": "#60a5fa", // blue-400
    "workflow-output": "#fb923c", // orange-400
    "custom-workflow": "#3b82f6", // blue-500
};

// Native node items - always available
const nativeItems = [
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
        type: "llm",
        icon: Bot,
        color: "text-primary hover:text-primary/80 hover:bg-primary/10",
        label: "LLM",
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

// Workflow I/O items - only in custom node editor
const workflowIOItems = [
    {
        type: "workflow-input",
        icon: LogIn,
        color: "text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/20",
        label: "Input",
    },
    {
        type: "workflow-output",
        icon: LogOut,
        color: "text-orange-500 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950/20",
        label: "Output",
    },
] as const;

export function FlowCanvas() {
    const nodes = useFlowStore((state: FlowState) => state.nodes);
    const edges = useFlowStore((state: FlowState) => state.edges);
    const onNodesChange = useFlowStore(
        (state: FlowState) => state.onNodesChange,
    );
    const onEdgesChange = useFlowStore(
        (state: FlowState) => state.onEdgesChange,
    );
    const onConnect = useFlowStore((state: FlowState) => state.onConnect);
    const selectNode = useFlowStore((state: FlowState) => state.selectNode);
    const selectedNode = useFlowStore((state: FlowState) => state.selectedNode);
    const flowId = useFlowStore((state: FlowState) => state.flowId);
    const entityType = useFlowStore((state: FlowState) => state.entityType);
    const addNodeWithType = useFlowStore(
        (state: FlowState) => state.addNodeWithType,
    );
    const { runFlow, runSelectedNodes } = useFlowExecution();
    const isRunning = useFlowStore((state: FlowState) => state.isRunning);
    const { theme, resolvedTheme } = useTheme();

    const { data: session } = useSession();
    const ownerId = useFlowStore((state: FlowState) => state.ownerId);
    const sharedWith = useFlowStore((state: FlowState) => state.sharedWith);
    const isOwner =
        !!session?.user?.id && !!ownerId && session.user.id === ownerId;
    const isEditor =
        !!session?.user?.email &&
        sharedWith?.some(
            (s) => s.email === session.user?.email && s.role === "edit",
        );
    const isEditable = isOwner || isEditor;

    const [mode, setMode] = useState<"selection" | "hand">("hand");

    const [customNodes, setCustomNodes] = useState<CustomNodeItem[]>([]);
    const [customNodesExpanded, setCustomNodesExpanded] = useState(true);
    const isCustomNodeEditor = entityType === "custom-node";

    // Fetch custom nodes for the palette
    useEffect(() => {
        const fetchCustomNodes = async () => {
            try {
                const response = await fetch("/api/custom-nodes");
                if (response.ok) {
                    const data = await response.json();
                    // Filter out the current custom node if we're editing one
                    const filtered = (data.customNodes || []).filter(
                        (node: CustomNodeItem) => node.id !== flowId,
                    );
                    setCustomNodes(filtered);
                }
            } catch (error) {
                logger.error("Error fetching custom nodes:", error);
            }
        };
        fetchCustomNodes();
    }, [flowId]);

    const isValidConnection = useCallback(
        (connection: Connection | Edge) => {
            const sourceNode = nodes.find((n) => n.id === connection.source);
            const targetNode = nodes.find((n) => n.id === connection.target);

            if (!sourceNode || !targetNode) return false;

            const sourceType = getSourcePortType(
                sourceNode as Node<NodeData>,
                connection.sourceHandle,
            );
            const targetType = getTargetPortType(
                targetNode as Node<NodeData>,
                connection.targetHandle,
            );

            return isTypeCompatible(sourceType, targetType);
        },
        [nodes],
    );

    const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(
        null,
    );
    const [hasFitted, setHasFitted] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [connectionStartParams, setConnectionStartParams] =
        useState<OnConnectStartParams | null>(null);
    const connectionStartParamsRef = useRef<OnConnectStartParams | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [dropdownVisualPosition, setDropdownVisualPosition] = useState<{
        x: number;
        y: number;
    } | null>(null);

    const clearConnectionParams = useCallback(() => {
        setConnectionStartParams(null);
        connectionStartParamsRef.current = null;
    }, []);

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

    const copyNodes = useCallback(() => {
        if (!rfInstance) return;
        const selectedNodes = rfInstance.getNodes().filter((n) => n.selected);
        const selectedEdges = rfInstance.getEdges().filter((e) => e.selected);
        if (selectedNodes.length > 0) {
            const copyData = { nodes: selectedNodes, edges: selectedEdges };
            localStorage.setItem(
                "flowcraft-copy-buffer",
                JSON.stringify(copyData),
            );
        }
    }, [rfInstance]);

    const pasteNodes = useCallback(() => {
        const copyDataStr = localStorage.getItem("flowcraft-copy-buffer");
        if (copyDataStr && rfInstance) {
            try {
                const { nodes: copiedNodes, edges: copiedEdges } =
                    JSON.parse(copyDataStr);
                const idMap: Record<string, string> = {};

                // Offset for pasted nodes
                const offset = { x: 50, y: 50 };

                const newNodes = (copiedNodes as Node<NodeData>[]).map(
                    (node: Node<NodeData>) => {
                        const newId = uuidv4();
                        idMap[node.id] = newId;
                        return {
                            ...node,
                            id: newId,
                            position: {
                                x: node.position.x + offset.x,
                                y: node.position.y + offset.y,
                            },
                            selected: true,
                        } as Node<NodeData>;
                    },
                );

                const newEdges = (copiedEdges || [])
                    .map((edge: Edge) => ({
                        ...edge,
                        id: uuidv4(),
                        source: idMap[edge.source] || edge.source,
                        target: idMap[edge.target] || edge.target,
                        selected: true,
                    }))
                    .filter(
                        (edge: Edge) =>
                            idMap[edge.source] && idMap[edge.target],
                    );

                // Deselect current nodes
                onNodesChange(
                    nodes.map((n) => ({
                        id: n.id,
                        type: "select",
                        selected: false,
                    })),
                );
                onEdgesChange(
                    edges.map((e) => ({
                        id: e.id,
                        type: "select",
                        selected: false,
                    })),
                );

                // Add new nodes and edges
                newNodes.forEach((node: Node<NodeData>) =>
                    useFlowStore.getState().addNode(node),
                );
                if (newEdges.length > 0) {
                    useFlowStore
                        .getState()
                        .setEdges([
                            ...useFlowStore.getState().edges,
                            ...newEdges,
                        ]);
                }
            } catch (error) {
                logger.error("Error pasting nodes:", error);
            }
        }
    }, [rfInstance, onNodesChange, onEdgesChange, nodes, edges]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement
            ) {
                return;
            }

            if ((event.ctrlKey || event.metaKey) && event.key === "c") {
                copyNodes();
            }
            if ((event.ctrlKey || event.metaKey) && event.key === "v") {
                pasteNodes();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [copyNodes, pasteNodes]);

    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: Node) => {
            selectNode(node.id);
        },
        [selectNode],
    );

    const onEdgeClick = useCallback(
        (event: React.MouseEvent) => {
            if (!event.shiftKey) {
                selectNode(null);
            }
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

    const onCustomNodeDragStart = (
        event: React.DragEvent,
        customNode: CustomNodeItem,
    ) => {
        event.dataTransfer.setData("application/reactflow", "custom-workflow");
        event.dataTransfer.setData(
            "application/custom-node",
            JSON.stringify(customNode),
        );
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

            // Check if this is a custom node drop
            const customNodeData = event.dataTransfer.getData(
                "application/custom-node",
            );
            if (customNodeData) {
                try {
                    const customNode = JSON.parse(
                        customNodeData,
                    ) as CustomNodeItem;
                    addNodeWithType("custom-workflow", position, {
                        subWorkflowId: customNode.id,
                        name: customNode.name,
                    } as Partial<CustomWorkflowData>);
                    return;
                } catch {
                    // Fall through to regular node creation
                }
            }

            addNodeWithType(type, position);
        },
        [rfInstance, addNodeWithType],
    );

    const handleContextMenu = (event: React.MouseEvent) => {
        if (!rfInstance) return;
        const position = rfInstance.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });
        setMenuPosition(position);
    };

    const handleContextMenuAddNode = (type: NodeType) => {
        if (!menuPosition) return;
        addNodeWithType(type, menuPosition);
        setMenuPosition(null);
    };

    const handleContextMenuAddCustomNode = (customNode: CustomNodeItem) => {
        if (!menuPosition) return;
        addNodeWithType("custom-workflow", menuPosition, {
            subWorkflowId: customNode.id,
            name: customNode.name,
        } as Partial<CustomWorkflowData>);
        setMenuPosition(null);
    };

    const onConnectStart: OnConnectStart = useCallback((_event, params) => {
        setConnectionStartParams(params);
        connectionStartParamsRef.current = params;
    }, []);

    const onConnectEnd: OnConnectEnd = useCallback(
        (event, connectionState) => {
            if (
                !connectionState.isValid &&
                connectionStartParamsRef.current &&
                rfInstance
            ) {
                const { clientX, clientY } =
                    "clientX" in event ? event : event.touches[0];

                const position = rfInstance.screenToFlowPosition({
                    x: clientX,
                    y: clientY,
                });

                setDropdownPosition(position);
                setDropdownVisualPosition({ x: clientX, y: clientY });
                setDropdownOpen(true);
            } else if (connectionState.isValid) {
                clearConnectionParams();
            }
        },
        [rfInstance, clearConnectionParams],
    );

    const getCompatibleNodes = (
        params: OnConnectStartParams,
    ): {
        native: (typeof nativeItems)[number][];
        custom: CustomNodeItem[];
    } => {
        const sourceNode = nodes.find((n) => n.id === params.nodeId);
        if (!sourceNode) return { native: [], custom: [] };

        const portType =
            params.handleType === "source"
                ? getSourcePortType(
                      sourceNode as Node<NodeData>,
                      params.handleId,
                  )
                : getTargetPortType(
                      sourceNode as Node<NodeData>,
                      params.handleId,
                  );

        // Filter native nodes
        const filteredNative = nativeItems.filter((item) => {
            const def = getNodeDefinition(item.type as NodeType);
            if (!def) return false;

            if (params.handleType === "source") {
                // If we drag from an output, the target must have a compatible input
                return Object.values(def.inputs || {}).some((targetType) =>
                    isTypeCompatible(portType, targetType),
                );
            } else {
                // If we drag from an input, the source must have a compatible output
                return Object.values(def.outputs || {}).some((sourceType) =>
                    isTypeCompatible(sourceType, portType),
                );
            }
        });

        // For custom nodes, filter based on their input/output types
        const filteredCustom = customNodes.filter((item) => {
            if (params.handleType === "source") {
                // Dragging from an output -> target must have a compatible input
                return (item.inputs || []).some((input) =>
                    isTypeCompatible(portType, input.type),
                );
            } else {
                // Dragging from an input -> source must have a compatible output
                return (item.outputs || []).some((output) =>
                    isTypeCompatible(output.type, portType),
                );
            }
        });

        return { native: filteredNative, custom: filteredCustom };
    };

    const handleSelectDropdownNode = (
        type: NodeType,
        customNode?: CustomNodeItem,
    ) => {
        if (!dropdownPosition || !connectionStartParams || !rfInstance) return;

        // 1. Create the new node
        const newNode = createNode(
            customNode ? "custom-workflow" : type,
            dropdownPosition,
        );
        if (customNode) {
            // Convert CustomNodePort[] to Record<string, string> for the data object
            const inputsRecord: Record<string, string> = {};
            customNode.inputs?.forEach((p) => {
                inputsRecord[p.id] = p.type;
            });
            const outputsRecord: Record<string, string> = {};
            customNode.outputs?.forEach((p) => {
                outputsRecord[p.id] = p.type;
            });

            newNode.data = {
                ...newNode.data,
                subWorkflowId: customNode.id,
                name: customNode.name,
                inputs: inputsRecord,
                outputs: outputsRecord,
            } as CustomWorkflowData;
        }

        // 2. Add node to store
        useFlowStore.getState().addNode(newNode);

        // 3. Find compatible handle on the new node
        const sourceNode = nodes.find(
            (n) => n.id === connectionStartParams.nodeId,
        );
        if (sourceNode) {
            const sourcePortType =
                connectionStartParams.handleType === "source"
                    ? getSourcePortType(
                          sourceNode as Node<NodeData>,
                          connectionStartParams.handleId,
                      )
                    : getTargetPortType(
                          sourceNode as Node<NodeData>,
                          connectionStartParams.handleId,
                      );

            const newDef = getNodeDefinition(newNode.data.type as NodeType);
            let targetHandle: string | null = null;

            if (connectionStartParams.handleType === "source") {
                // Dragging from source (output) -> looking for a target (input)
                if (newNode.data.type === "custom-workflow") {
                    // For custom nodes, find the first compatible input handle
                    const cwData = newNode.data as CustomWorkflowData;
                    const inputs = Object.entries(cwData.inputs || {});
                    // 1. Try exact match first
                    targetHandle =
                        inputs.find(
                            ([_, type]) => type === sourcePortType,
                        )?.[0] ||
                        // 2. Fall back to compatible match
                        inputs.find(([_, type]) =>
                            isTypeCompatible(sourcePortType, type),
                        )?.[0] ||
                        null;
                } else if (newDef?.inputs) {
                    const inputs = Object.entries(newDef.inputs);
                    // 1. Try exact match first
                    targetHandle =
                        inputs.find(
                            ([_, type]) => type === sourcePortType,
                        )?.[0] ||
                        // 2. Fall back to compatible match
                        inputs.find(([_, type]) =>
                            isTypeCompatible(sourcePortType, type),
                        )?.[0] ||
                        null;
                }
            } else {
                // Dragging from target (input) -> looking for a source (output)
                if (newNode.data.type === "custom-workflow") {
                    const cwData = newNode.data as CustomWorkflowData;
                    const outputs = Object.entries(cwData.outputs || {});
                    // 1. Try exact match first
                    targetHandle =
                        outputs.find(
                            ([_, type]) => type === sourcePortType,
                        )?.[0] ||
                        // 2. Fall back to compatible match
                        outputs.find(([_, type]) =>
                            isTypeCompatible(type, sourcePortType),
                        )?.[0] ||
                        null;
                } else if (newDef?.outputs) {
                    const outputs = Object.entries(newDef.outputs);
                    // 1. Try exact match first
                    targetHandle =
                        outputs.find(
                            ([_, type]) => type === sourcePortType,
                        )?.[0] ||
                        // 2. Fall back to compatible match
                        outputs.find(([_, type]) =>
                            isTypeCompatible(type, sourcePortType),
                        )?.[0] ||
                        null;
                }
            }

            // 4. Create internal edge in store
            if (targetHandle !== null) {
                const newEdge: Edge = {
                    id: uuidv4(),
                    source:
                        connectionStartParams.handleType === "source"
                            ? sourceNode.id
                            : newNode.id,
                    sourceHandle:
                        connectionStartParams.handleType === "source"
                            ? connectionStartParams.handleId
                            : targetHandle,
                    target:
                        connectionStartParams.handleType === "source"
                            ? newNode.id
                            : sourceNode.id,
                    targetHandle:
                        connectionStartParams.handleType === "source"
                            ? targetHandle
                            : connectionStartParams.handleId,
                };
                useFlowStore.getState().setEdges([...edges, newEdge]);
            }
        }

        setDropdownOpen(false);
        clearConnectionParams();
    };

    const compatibleNodes = connectionStartParams
        ? getCompatibleNodes(connectionStartParams)
        : { native: [], custom: [] };

    const handleAddCustomNode = (customNode: CustomNodeItem) => {
        addNodeWithType("custom-workflow", undefined, {
            subWorkflowId: customNode.id,
            name: customNode.name,
        } as Partial<CustomWorkflowData>);
    };

    const highlightedEdges = edges.map((edge) => {
        const isHighlighted =
            (selectedNode &&
                (edge.source === selectedNode.id ||
                    edge.target === selectedNode.id)) ||
            edge.selected;

        if (!isHighlighted) return edge;

        const sourceNode = nodes.find((n) => n.id === edge.source);
        const color = sourceNode
            ? NODE_COLORS[sourceNode.data.type]
            : "#3b82f6"; // Default blue if source not found

        return {
            ...edge,
            animated: true,
            style: {
                ...edge.style,
                stroke: color,
                strokeWidth: 6,
            },
        };
    });

    const renderNodeButton = (
        item: (typeof nativeItems)[number] | (typeof workflowIOItems)[number],
    ) => (
        <Tooltip key={item.type}>
            <TooltipTrigger asChild>
                <div
                    onDragStart={(event) => onDragStart(event, item.type)}
                    draggable
                >
                    <Button
                        onClick={() => addNodeWithType(item.type as NodeType)}
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
    );

    return (
        <div className="relative flex h-full flex-1">
            {isEditable && (
                <aside className="border-border bg-card z-10 flex w-14 flex-col items-center gap-2 overflow-y-auto border-r py-4">
                    <TooltipProvider>
                        {/* Native Nodes */}
                        {nativeItems.map(renderNodeButton)}

                        {/* Workflow I/O - only show in custom node editor */}
                        {isCustomNodeEditor && (
                            <>
                                <div className="border-border my-2 w-8 border-t" />
                                {workflowIOItems.map(renderNodeButton)}
                            </>
                        )}

                        {/* Custom Nodes Section - only show in flow editor */}
                        {!isCustomNodeEditor && customNodes.length > 0 && (
                            <>
                                <div className="border-border my-2 w-8 border-t" />
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            onClick={() =>
                                                setCustomNodesExpanded(
                                                    !customNodesExpanded,
                                                )
                                            }
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-purple-500"
                                        >
                                            {customNodesExpanded ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        <p>Custom Nodes</p>
                                    </TooltipContent>
                                </Tooltip>
                                {customNodesExpanded &&
                                    customNodes.map((customNode) => (
                                        <Tooltip key={customNode.id}>
                                            <TooltipTrigger asChild>
                                                <div
                                                    onDragStart={(event) =>
                                                        onCustomNodeDragStart(
                                                            event,
                                                            customNode,
                                                        )
                                                    }
                                                    draggable
                                                >
                                                    <Button
                                                        onClick={() =>
                                                            handleAddCustomNode(
                                                                customNode,
                                                            )
                                                        }
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-10 w-10 cursor-grab text-purple-500 hover:bg-purple-50 hover:text-purple-600 active:cursor-grabbing dark:hover:bg-purple-950/20"
                                                    >
                                                        <Box className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="right">
                                                <p>{customNode.name}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    ))}
                            </>
                        )}
                    </TooltipProvider>
                </aside>
            )}

            <div
                className="relative h-full flex-1"
                onDrop={onDrop}
                onDragOver={onDragOver}
            >
                <ContextMenu>
                    <ContextMenuTrigger asChild disabled={!isEditable}>
                        <div
                            className="h-full w-full"
                            onContextMenu={handleContextMenu}
                        >
                            <ReactFlow
                                nodes={nodes}
                                edges={highlightedEdges}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                onConnect={isEditable ? onConnect : undefined}
                                onConnectStart={
                                    isEditable ? onConnectStart : undefined
                                }
                                onConnectEnd={
                                    isEditable ? onConnectEnd : undefined
                                }
                                onNodeClick={onNodeClick}
                                onEdgeClick={onEdgeClick}
                                onPaneClick={onPaneClick}
                                panOnDrag={mode === "hand" ? true : [2]}
                                selectionOnDrag={mode === "selection"}
                                selectionMode={SelectionMode.Partial}
                                panOnScroll={true}
                                onInit={setRfInstance}
                                nodeTypes={nodeTypes}
                                nodesDraggable={isEditable}
                                nodesConnectable={isEditable}
                                elementsSelectable={true}
                                isValidConnection={isValidConnection}
                                proOptions={{ hideAttribution: true }}
                                defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
                                minZoom={0.1}
                                maxZoom={2}
                                className="react-flow"
                            >
                                <Background
                                    color={
                                        resolvedTheme === "dark"
                                            ? "#ffffff"
                                            : "#000000"
                                    }
                                    variant={BackgroundVariant.Dots}
                                />
                                <Controls>
                                    <ControlButton
                                        onClick={() => setMode("selection")}
                                        className={
                                            mode === "selection"
                                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                                : ""
                                        }
                                        title="Selection Mode"
                                    >
                                        <MousePointer2 className="h-4 w-4" />
                                    </ControlButton>
                                    <ControlButton
                                        onClick={() => setMode("hand")}
                                        className={
                                            mode === "hand"
                                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                                : ""
                                        }
                                        title="Hand Mode"
                                    >
                                        <Hand className="h-4 w-4" />
                                    </ControlButton>
                                </Controls>
                                <Panel
                                    position="top-right"
                                    className="bg-card border-border flex gap-2 rounded-lg border p-2"
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
                                    {nodes.some((n) => n.selected) && (
                                        <Button
                                            onClick={runSelectedNodes}
                                            disabled={isRunning}
                                            size="sm"
                                            variant="outline"
                                            className="border-green-500 text-green-500 hover:bg-green-50 dark:hover:bg-green-950/20"
                                        >
                                            <Play className="mr-2 h-4 w-4" />
                                            Run Selected
                                        </Button>
                                    )}
                                </Panel>

                                {dropdownVisualPosition && dropdownPosition && (
                                    <div
                                        style={{
                                            position: "fixed",
                                            left: dropdownVisualPosition.x,
                                            top: dropdownVisualPosition.y,
                                            zIndex: 1000,
                                            pointerEvents: "none",
                                        }}
                                    >
                                        <div style={{ pointerEvents: "auto" }}>
                                            <DropdownMenu
                                                open={dropdownOpen}
                                                onOpenChange={(open) => {
                                                    setDropdownOpen(open);
                                                    if (!open) {
                                                        clearConnectionParams();
                                                    }
                                                }}
                                            >
                                                <DropdownMenuTrigger asChild>
                                                    <div className="h-0 w-0" />
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    className="w-56"
                                                    align="start"
                                                    sideOffset={0}
                                                >
                                                    <DropdownMenuLabel>
                                                        Connect to Node
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    {compatibleNodes.native.map(
                                                        (item) => (
                                                            <DropdownMenuItem
                                                                key={item.type}
                                                                onClick={() =>
                                                                    handleSelectDropdownNode(
                                                                        item.type as NodeType,
                                                                    )
                                                                }
                                                            >
                                                                <item.icon className="mr-2 h-4 w-4" />
                                                                <span>
                                                                    {item.label}
                                                                </span>
                                                            </DropdownMenuItem>
                                                        ),
                                                    )}

                                                    {compatibleNodes.custom
                                                        .length > 0 && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuSub>
                                                                <DropdownMenuSubTrigger>
                                                                    <Box className="mr-2 h-4 w-4" />
                                                                    <span>
                                                                        Custom
                                                                        Nodes
                                                                    </span>
                                                                </DropdownMenuSubTrigger>
                                                                <DropdownMenuSubContent className="w-48">
                                                                    {compatibleNodes.custom.map(
                                                                        (
                                                                            node,
                                                                        ) => (
                                                                            <DropdownMenuItem
                                                                                key={
                                                                                    node.id
                                                                                }
                                                                                onClick={() =>
                                                                                    handleSelectDropdownNode(
                                                                                        "custom-workflow",
                                                                                        node,
                                                                                    )
                                                                                }
                                                                            >
                                                                                <Box className="mr-2 h-4 w-4" />
                                                                                <span>
                                                                                    {
                                                                                        node.name
                                                                                    }
                                                                                </span>
                                                                            </DropdownMenuItem>
                                                                        ),
                                                                    )}
                                                                </DropdownMenuSubContent>
                                                            </DropdownMenuSub>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                )}
                            </ReactFlow>
                        </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                        <ContextMenuLabel>Add Node</ContextMenuLabel>
                        <ContextMenuSeparator />
                        {nativeItems.map((item) => (
                            <ContextMenuItem
                                key={item.type}
                                onClick={() =>
                                    handleContextMenuAddNode(
                                        item.type as NodeType,
                                    )
                                }
                            >
                                <item.icon className="mr-2 h-4 w-4" />
                                <span>{item.label}</span>
                            </ContextMenuItem>
                        ))}

                        {isCustomNodeEditor && (
                            <>
                                <ContextMenuSeparator />
                                {workflowIOItems.map((item) => (
                                    <ContextMenuItem
                                        key={item.type}
                                        onClick={() =>
                                            handleContextMenuAddNode(
                                                item.type as NodeType,
                                            )
                                        }
                                    >
                                        <item.icon className="mr-2 h-4 w-4" />
                                        <span>{item.label}</span>
                                    </ContextMenuItem>
                                ))}
                            </>
                        )}

                        {!isCustomNodeEditor && customNodes.length > 0 && (
                            <>
                                <ContextMenuSeparator />
                                <ContextMenuSub>
                                    <ContextMenuSubTrigger>
                                        <Box className="mr-2 h-4 w-4" />
                                        <span>Custom Nodes</span>
                                    </ContextMenuSubTrigger>
                                    <ContextMenuSubContent className="w-48">
                                        {customNodes.map((node) => (
                                            <ContextMenuItem
                                                key={node.id}
                                                onClick={() =>
                                                    handleContextMenuAddCustomNode(
                                                        node,
                                                    )
                                                }
                                            >
                                                <Box className="mr-2 h-4 w-4" />
                                                <span>{node.name}</span>
                                            </ContextMenuItem>
                                        ))}
                                    </ContextMenuSubContent>
                                </ContextMenuSub>
                            </>
                        )}
                    </ContextMenuContent>
                </ContextMenu>
            </div>
        </div>
    );
}
