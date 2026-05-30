"use client";

import { useCallback } from "react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Pencil, Trash2, Copy, ClipboardCopy } from "lucide-react";
import { useCanvasStore } from "@/lib/store/use-canvas-store";

interface CanvasNodeContextMenuProps {
    children: React.ReactNode;
    nodeId: string;
    onStartRename: () => void;
}

export function CanvasNodeContextMenu({
    children,
    nodeId,
    onStartRename,
}: CanvasNodeContextMenuProps) {
    const removeNode = useCanvasStore((s) => s.removeNode);
    const nodes = useCanvasStore((s) => s.nodes);

    const node = nodes.find((n) => n.id === nodeId);
    const hasPrompt =
        node?.data &&
        "prompt" in node.data &&
        typeof node.data.prompt === "string" &&
        node.data.prompt.length > 0;

    const handleDelete = useCallback(() => {
        removeNode(nodeId);
    }, [removeNode, nodeId]);

    const handleCopyPrompt = useCallback(() => {
        if (node?.data && "prompt" in node.data && node.data.prompt) {
            void navigator.clipboard.writeText(node.data.prompt as string);
        }
    }, [node]);

    const handleCopyLabel = useCallback(() => {
        if (node?.data?.label) {
            void navigator.clipboard.writeText(node.data.label);
        }
    }, [node]);

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
            <ContextMenuContent className="w-48">
                <ContextMenuItem onClick={onStartRename}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Rename
                </ContextMenuItem>
                <ContextMenuItem onClick={handleCopyLabel}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Label
                </ContextMenuItem>
                {hasPrompt && (
                    <ContextMenuItem onClick={handleCopyPrompt}>
                        <ClipboardCopy className="mr-2 h-4 w-4" />
                        Copy Prompt
                    </ContextMenuItem>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem
                    onClick={handleDelete}
                    className="text-destructive focus:text-destructive"
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}
