"use client";

import type { NodeType } from "@/lib/types";
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
} from "../ui/dropdown-menu";
import { Box } from "lucide-react";
import { nativeItems, type CustomNodeItem } from "./flow-constants";

interface NodeConnectionDropdownProps {
    dropdownOpen: boolean;
    dropdownVisualPosition: { x: number; y: number } | null;
    dropdownPosition: { x: number; y: number } | null;
    compatibleNodes: {
        native: (typeof nativeItems)[number][];
        custom: CustomNodeItem[];
    };
    onOpenChange: (open: boolean) => void;
    onClearConnectionParams: () => void;
    onSelectNode: (type: NodeType, customNode?: CustomNodeItem) => void;
}

export function NodeConnectionDropdown({
    dropdownOpen,
    dropdownVisualPosition,
    dropdownPosition,
    compatibleNodes,
    onOpenChange,
    onClearConnectionParams,
    onSelectNode,
}: NodeConnectionDropdownProps) {
    if (!dropdownVisualPosition || !dropdownPosition) return null;

    return (
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
                        onOpenChange(open);
                        if (!open) {
                            onClearConnectionParams();
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
                        <DropdownMenuLabel>Connect to Node</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {compatibleNodes.native.map(
                            (item: (typeof nativeItems)[number]) => (
                                <DropdownMenuItem
                                    key={item.type}
                                    onClick={() =>
                                        onSelectNode(item.type as NodeType)
                                    }
                                >
                                    <item.icon className="mr-2 h-4 w-4" />
                                    <span>{item.label}</span>
                                </DropdownMenuItem>
                            ),
                        )}

                        {compatibleNodes.custom.length > 0 && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                        <Box className="mr-2 h-4 w-4" />
                                        <span>Custom Nodes</span>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="w-48">
                                        {compatibleNodes.custom.map(
                                            (node: CustomNodeItem) => (
                                                <DropdownMenuItem
                                                    key={node.id}
                                                    onClick={() =>
                                                        onSelectNode(
                                                            "custom-workflow",
                                                            node,
                                                        )
                                                    }
                                                >
                                                    <Box className="mr-2 h-4 w-4" />
                                                    <span>{node.name}</span>
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
    );
}
