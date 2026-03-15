"use client";

import type React from "react";

import { useCallback, useState, useEffect, useMemo } from "react";
import {
    ReactFlow,
    Controls,
    type Node,
    type ReactFlowInstance,
    Background,
    BackgroundVariant,
    SelectionMode,
    ControlButton,
} from "@xyflow/react";
import { useSession } from "next-auth/react";
import "@xyflow/react/dist/style.css";
import { type NodeData, type CustomWorkflowData } from "@/lib/types";
import { FloatingNodePalette } from "./floating-node-palette";
import { getSourcePortType, getTargetPortType } from "@/lib/node-registry";
import { isTypeCompatible } from "@/lib/utils";
import { MousePointer2, Hand } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import { useShallow } from "zustand/react/shallow";
import { useFlowExecution } from "@/hooks/use-flow-execution";
import { useTheme } from "next-themes";
import logger from "@/app/logger";
import { TooltipProvider } from "@/components/ui/tooltip";

import {
    nodeTypes,
    NODE_COLORS,
    nativeItems,
    workflowIOItems,
    type CustomNodeItem,
} from "./flow-canvas/flow-constants";
import { FlowContextMenu } from "./flow-canvas/flow-context-menu";
import { NodeConnectionDropdown } from "./flow-canvas/node-connection-dropdown";
import { FlowRunPanel } from "./flow-canvas/flow-run-panel";
import { useFlowShortcuts } from "@/hooks/use-flow-shortcuts";
import { useFlowDragDrop } from "@/hooks/use-flow-drag-drop";
import { useNodeConnection } from "@/hooks/use-node-connection";

export function FlowCanvas() {
    const nodes = useFlowStore((state: FlowState) => state.nodes);
    const edges = useFlowStore((state: FlowState) => state.edges);
    const onNodesChange = useFlowStore(
        (state: FlowState) => state.onNodesChange,
    );
    const onEdgesChange = useFlowStore(
        (state: FlowState) => state.onEdgesChange,
    );
    const {
        onConnect,
        selectNode,
        selectedNode,
        flowId,
        entityType,
        addNodeWithType,
        isRunning,
        ownerId,
        sharedWith,
    } = useFlowStore(
        useShallow((state: FlowState) => ({
            onConnect: state.onConnect,
            selectNode: state.selectNode,
            selectedNode: state.selectedNode,
            flowId: state.flowId,
            entityType: state.entityType,
            addNodeWithType: state.addNodeWithType,
            isRunning: state.isRunning,
            ownerId: state.ownerId,
            sharedWith: state.sharedWith,
        })),
    );
    const { runFlow, runSelectedNodes } = useFlowExecution();
    const { resolvedTheme } = useTheme();
    const { data: session } = useSession();

    const nodeDataMap = useFlowStore(
        useShallow((state: FlowState) => {
            const map: Record<string, NodeData> = {};
            state.nodes.forEach((n) => {
                map[n.id] = n.data;
            });
            return map;
        }),
    );

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
    const isCustomNodeEditor = entityType === "custom-node";

    useEffect(() => {
        const fetchCustomNodes = async () => {
            try {
                const response = await fetch("/api/custom-nodes");
                if (response.ok) {
                    const data = await response.json();
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
    }, [flowId, entityType]);

    const isValidConnection = useCallback(
        (connection: {
            source: string;
            target: string;
            sourceHandle?: string | null;
            targetHandle?: string | null;
        }) => {
            const sourceNodeData = nodeDataMap[connection.source];
            const targetNodeData = nodeDataMap[connection.target];

            if (!sourceNodeData || !targetNodeData) return false;

            const sourceType = getSourcePortType(
                { data: sourceNodeData } as Node<NodeData>,
                connection.sourceHandle,
            );
            const targetType = getTargetPortType(
                { data: targetNodeData } as Node<NodeData>,
                connection.targetHandle,
            );

            return isTypeCompatible(sourceType, targetType);
        },
        [nodeDataMap],
    );

    const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(
        null,
    );
    const [fittedFlowId, setFittedFlowId] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState<{
        x: number;
        y: number;
    } | null>(null);

    // Extracted hooks
    useFlowShortcuts(rfInstance);
    const { onDragStart, onCustomNodeDragStart, onDragOver, onDrop } =
        useFlowDragDrop(rfInstance);
    const {
        dropdownOpen,
        setDropdownOpen,
        dropdownPosition,
        dropdownVisualPosition,
        clearConnectionParams,
        onConnectStart,
        onConnectEnd,
        compatibleNodes,
        handleSelectDropdownNode,
    } = useNodeConnection(rfInstance, nodeDataMap, edges, customNodes);

    useEffect(() => {
        if (
            rfInstance &&
            nodes.length > 0 &&
            fittedFlowId !== flowId &&
            flowId
        ) {
            window.requestAnimationFrame(() => {
                rfInstance.fitView({ padding: 0.2 });
                setFittedFlowId(flowId);
            });
        }
    }, [rfInstance, nodes.length, fittedFlowId, flowId]);

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
        useFlowStore.getState().setIsConfigSidebarOpen(false);
    }, [selectNode]);

    const handleContextMenu = (event: React.MouseEvent) => {
        if (!rfInstance) return;
        const position = rfInstance.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });
        setMenuPosition(position);
    };

    const handleAddCustomNode = (customNode: CustomNodeItem) => {
        addNodeWithType("custom-workflow", undefined, {
            subWorkflowId: customNode.id,
            name: customNode.name,
        } as Partial<CustomWorkflowData>);
    };

    const highlightedEdges = useMemo(() => {
        const selectedId = selectedNode?.id;

        return edges.map((edge) => {
            const isHighlighted =
                selectedId === edge.source ||
                selectedId === edge.target ||
                edge.selected;

            const sourceNodeData = nodeDataMap[edge.source];
            if (!sourceNodeData) return edge;

            const mockNode = { data: sourceNodeData } as Node<NodeData>;

            const isCollection = getSourcePortType(
                mockNode,
                edge.sourceHandle,
            ).startsWith("collection:");

            if (!isHighlighted && !isCollection) return edge;

            const baseStyle: Record<string, unknown> = { ...edge.style };
            const sourceNodeType = sourceNodeData.type;

            if (isCollection) {
                baseStyle.strokeWidth = isHighlighted ? 10 : 8;
                baseStyle.strokeDasharray = "8 4";
                if (sourceNodeType) {
                    baseStyle.stroke = NODE_COLORS[sourceNodeType] || "#3b82f6";
                }
            } else if (isHighlighted) {
                baseStyle.stroke = sourceNodeType
                    ? NODE_COLORS[sourceNodeType]
                    : "#3b82f6";
                baseStyle.strokeWidth = 6;
            }

            return {
                ...edge,
                animated: isHighlighted,
                style: baseStyle,
            };
        });
    }, [edges, nodeDataMap, selectedNode?.id]);

    const flowBackground = useMemo(
        () => (
            <Background
                color={resolvedTheme === "dark" ? "#ffffff" : "#000000"}
                variant={BackgroundVariant.Dots}
            />
        ),
        [resolvedTheme],
    );

    const flowControls = useMemo(
        () => (
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
        ),
        [mode],
    );

    return (
        <div className="relative flex h-full flex-1">
            {isEditable && (
                <FloatingNodePalette
                    nativeItems={nativeItems}
                    workflowIOItems={workflowIOItems}
                    customNodes={customNodes}
                    isCustomNodeEditor={isCustomNodeEditor}
                    addNodeWithType={addNodeWithType}
                    onDragStart={onDragStart}
                    onCustomNodeDragStart={onCustomNodeDragStart}
                    handleAddCustomNode={handleAddCustomNode}
                />
            )}

            <div
                className="relative h-full flex-1"
                onDrop={onDrop}
                onDragOver={onDragOver}
            >
                <FlowContextMenu
                    isEditable={isEditable}
                    isCustomNodeEditor={isCustomNodeEditor}
                    customNodes={customNodes}
                    onContextMenu={handleContextMenu}
                    menuPosition={menuPosition}
                    addNodeWithType={addNodeWithType}
                    onMenuPositionClear={() => setMenuPosition(null)}
                >
                    <TooltipProvider>
                        <ReactFlow
                            nodes={nodes}
                            edges={highlightedEdges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={isEditable ? onConnect : undefined}
                            onConnectStart={
                                isEditable ? onConnectStart : undefined
                            }
                            onConnectEnd={isEditable ? onConnectEnd : undefined}
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
                            onlyRenderVisibleElements={false}
                            className="react-flow"
                        >
                            {flowBackground}
                            {flowControls}
                            <FlowRunPanel
                                isRunning={isRunning}
                                hasSelectedNodes={nodes.some((n) => n.selected)}
                                onRunFlow={runFlow}
                                onRunSelectedNodes={runSelectedNodes}
                            />

                            <NodeConnectionDropdown
                                dropdownOpen={dropdownOpen}
                                dropdownVisualPosition={dropdownVisualPosition}
                                dropdownPosition={dropdownPosition}
                                compatibleNodes={compatibleNodes}
                                onOpenChange={setDropdownOpen}
                                onClearConnectionParams={clearConnectionParams}
                                onSelectNode={handleSelectDropdownNode}
                            />
                        </ReactFlow>
                    </TooltipProvider>
                </FlowContextMenu>
            </div>
        </div>
    );
}
