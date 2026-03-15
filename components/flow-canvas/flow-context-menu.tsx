"use client";

import type { NodeType, CustomWorkflowData } from "@/lib/types";
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
} from "../ui/context-menu";
import { Box } from "lucide-react";
import {
    nativeItems,
    workflowIOItems,
    type CustomNodeItem,
} from "./flow-constants";

interface FlowContextMenuProps {
    children: React.ReactNode;
    isEditable: boolean;
    isCustomNodeEditor: boolean;
    customNodes: CustomNodeItem[];
    onContextMenu: (event: React.MouseEvent) => void;
    menuPosition: { x: number; y: number } | null;
    addNodeWithType: (
        type: NodeType,
        position?: { x: number; y: number },
        data?: Partial<CustomWorkflowData>,
    ) => void;
    onMenuPositionClear: () => void;
}

export function FlowContextMenu({
    children,
    isEditable,
    isCustomNodeEditor,
    customNodes,
    onContextMenu,
    menuPosition,
    addNodeWithType,
    onMenuPositionClear,
}: FlowContextMenuProps) {
    const handleContextMenuAddNode = (type: NodeType) => {
        if (!menuPosition) return;
        addNodeWithType(type, menuPosition);
        onMenuPositionClear();
    };

    const handleContextMenuAddCustomNode = (customNode: CustomNodeItem) => {
        if (!menuPosition) return;
        addNodeWithType("custom-workflow", menuPosition, {
            subWorkflowId: customNode.id,
            name: customNode.name,
        } as Partial<CustomWorkflowData>);
        onMenuPositionClear();
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild disabled={!isEditable}>
                <div
                    className="h-full w-full"
                    onContextMenu={onContextMenu}
                >
                    {children}
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-48">
                <ContextMenuLabel>Add Node</ContextMenuLabel>
                <ContextMenuSeparator />
                {nativeItems.map((item) => (
                    <ContextMenuItem
                        key={item.type}
                        onClick={() =>
                            handleContextMenuAddNode(item.type as NodeType)
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
                                            handleContextMenuAddCustomNode(node)
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
    );
}
