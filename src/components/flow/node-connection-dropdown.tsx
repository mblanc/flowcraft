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
import {
    Bot,
    Box,
    FileText,
    FileUp,
    GitMerge,
    ImageIcon,
    ListOrdered,
    Music,
    Scaling,
    Video,
    ZoomIn,
} from "lucide-react";
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

    const compatibleMap = new Map(
        compatibleNodes.native.map((item) => [item.type, item]),
    );
    const imageItems = [
        compatibleMap.get("image"),
        compatibleMap.get("upscale"),
        compatibleMap.get("resize"),
    ].filter(Boolean) as (typeof nativeItems)[number][];

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

                        {/* Text Submenu (or items) */}
                        {compatibleMap.has("text") &&
                        compatibleMap.has("llm") ? (
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <FileText className="mr-2 h-4 w-4" />
                                    <span>Text</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-48">
                                    <DropdownMenuItem
                                        onClick={() => onSelectNode("text")}
                                    >
                                        <FileText className="mr-2 h-4 w-4" />
                                        <span>Text</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => onSelectNode("llm")}
                                    >
                                        <Bot className="mr-2 h-4 w-4" />
                                        <span>LLM</span>
                                    </DropdownMenuItem>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        ) : (
                            <>
                                {compatibleMap.has("text") && (
                                    <DropdownMenuItem
                                        onClick={() => onSelectNode("text")}
                                    >
                                        <FileText className="mr-2 h-4 w-4" />
                                        <span>Text</span>
                                    </DropdownMenuItem>
                                )}
                                {compatibleMap.has("llm") && (
                                    <DropdownMenuItem
                                        onClick={() => onSelectNode("llm")}
                                    >
                                        <Bot className="mr-2 h-4 w-4" />
                                        <span>LLM</span>
                                    </DropdownMenuItem>
                                )}
                            </>
                        )}

                        {/* Image Submenu (or items) */}
                        {imageItems.length > 1 ? (
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <ImageIcon className="mr-2 h-4 w-4" />
                                    <span>Image</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-48">
                                    {compatibleMap.has("image") && (
                                        <DropdownMenuItem
                                            onClick={() =>
                                                onSelectNode("image")
                                            }
                                        >
                                            <ImageIcon className="mr-2 h-4 w-4" />
                                            <span>Image</span>
                                        </DropdownMenuItem>
                                    )}
                                    {compatibleMap.has("upscale") && (
                                        <DropdownMenuItem
                                            onClick={() =>
                                                onSelectNode("upscale")
                                            }
                                        >
                                            <ZoomIn className="mr-2 h-4 w-4" />
                                            <span>Upscale</span>
                                        </DropdownMenuItem>
                                    )}
                                    {compatibleMap.has("resize") && (
                                        <DropdownMenuItem
                                            onClick={() =>
                                                onSelectNode("resize")
                                            }
                                        >
                                            <Scaling className="mr-2 h-4 w-4" />
                                            <span>Resize</span>
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        ) : (
                            imageItems.map((item) => (
                                <DropdownMenuItem
                                    key={item.type}
                                    onClick={() =>
                                        onSelectNode(item.type as NodeType)
                                    }
                                >
                                    <item.icon className="mr-2 h-4 w-4" />
                                    <span>{item.label}</span>
                                </DropdownMenuItem>
                            ))
                        )}

                        {/* Video */}
                        {compatibleMap.has("video") && (
                            <DropdownMenuItem
                                onClick={() => onSelectNode("video")}
                            >
                                <Video className="mr-2 h-4 w-4" />
                                <span>Video</span>
                            </DropdownMenuItem>
                        )}

                        {/* Music */}
                        {compatibleMap.has("music") && (
                            <DropdownMenuItem
                                onClick={() => onSelectNode("music")}
                            >
                                <Music className="mr-2 h-4 w-4" />
                                <span>Music</span>
                            </DropdownMenuItem>
                        )}

                        {/* File */}
                        {compatibleMap.has("file") && (
                            <DropdownMenuItem
                                onClick={() => onSelectNode("file")}
                            >
                                <FileUp className="mr-2 h-4 w-4" />
                                <span>File</span>
                            </DropdownMenuItem>
                        )}

                        {/* List */}
                        {compatibleMap.has("list") && (
                            <DropdownMenuItem
                                onClick={() => onSelectNode("list")}
                            >
                                <ListOrdered className="mr-2 h-4 w-4" />
                                <span>List</span>
                            </DropdownMenuItem>
                        )}

                        {/* Router */}
                        {compatibleMap.has("router") && (
                            <DropdownMenuItem
                                onClick={() => onSelectNode("router")}
                            >
                                <GitMerge className="mr-2 h-4 w-4" />
                                <span>Router</span>
                            </DropdownMenuItem>
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
