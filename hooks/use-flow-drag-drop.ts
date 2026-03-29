import { useCallback } from "react";
import type React from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import {
    type NodeType,
    type FileData,
    type CustomWorkflowData,
} from "@/lib/types";
import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import { useShallow } from "zustand/react/shallow";
import { createNode } from "@/lib/node-factory";
import logger from "@/app/logger";
import type { CustomNodeItem } from "@/components/flow/flow-constants";

export function useFlowDragDrop(rfInstance: ReactFlowInstance | null) {
    const { addNodeWithType, addNode, updateNodeData } = useFlowStore(
        useShallow((state: FlowState) => ({
            addNodeWithType: state.addNodeWithType,
            addNode: state.addNode,
            updateNodeData: state.updateNodeData,
        })),
    );

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

            if (!rfInstance) {
                return;
            }

            const position = rfInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            if (
                event.dataTransfer.files &&
                event.dataTransfer.files.length > 0
            ) {
                const file = event.dataTransfer.files[0];
                const fileType = file.type.startsWith("image/")
                    ? "image"
                    : file.type.startsWith("video/")
                      ? "video"
                      : file.type === "application/pdf"
                        ? "pdf"
                        : null;

                if (fileType) {
                    const newNode = createNode("file", position);
                    newNode.data = {
                        ...newNode.data,
                        fileName: file.name,
                        fileType,
                    } as FileData;
                    addNode(newNode);

                    const formData = new FormData();
                    formData.append("file", file);

                    fetch("/api/upload-file", {
                        method: "POST",
                        body: formData,
                    })
                        .then((res) => {
                            if (!res.ok) throw new Error("Upload failed");
                            return res.json();
                        })
                        .then((data) => {
                            updateNodeData(newNode.id, {
                                fileUrl: data.signedUrl,
                                gcsUri: data.gcsUri,
                            });
                        })
                        .catch((error) => {
                            logger.error("Drop upload error:", error);
                        });
                    return;
                }
            }

            const type = event.dataTransfer.getData(
                "application/reactflow",
            ) as NodeType;

            if (typeof type === "undefined" || !type) {
                return;
            }

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
        [rfInstance, addNodeWithType, addNode, updateNodeData],
    );

    return { onDragStart, onCustomNodeDragStart, onDragOver, onDrop };
}
