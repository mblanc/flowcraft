"use client";

import { memo, useEffect, useState, useRef } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Box, Play } from "lucide-react";
import {
    CustomWorkflowData,
    WorkflowInputData,
    WorkflowOutputData,
    NodeData,
} from "@/lib/types";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { toast } from "sonner";
import Image from "next/image";
import logger from "@/app/logger";
import { useFlowExecution } from "@/hooks/use-flow-execution";
import { shallowEqual } from "@/lib/utils";

function SubWorkflowOutputPreview({
    type,
    value,
    maxHeight,
}: {
    type: string;
    value: { value?: unknown } | unknown; // Value can be wrapped or direct
    maxHeight: number;
}) {
    const [signedUrl, setSignedUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchSignedUrl = async (uri: string) => {
            try {
                const res = await fetch(
                    `/api/signed-url?gcsUri=${encodeURIComponent(uri)}`,
                );
                const result = await res.json();
                if (result.signedUrl) setSignedUrl(result.signedUrl);
            } catch (error) {
                logger.error("Error fetching signed URL:", error);
            }
        };

        // For WorkflowOutput nodes, the value is wrapped in a 'value' object: { value: { images: [...], output: "..." } }
        const actualValue =
            value && typeof value === "object" && "value" in value
                ? (value.value as Record<string, unknown>)
                : (value as Record<string, unknown>);
        const uri =
            type === "image"
                ? (actualValue?.images as string[])?.[0] ||
                  (actualValue?.image as string)
                : type === "video"
                  ? (actualValue?.videoUrl as string)
                  : null;

        if (uri && uri.startsWith("gs://")) {
            fetchSignedUrl(uri);
        } else if (uri !== signedUrl) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSignedUrl(uri);
        }
    }, [type, value, signedUrl]);

    if (!value) return null;

    if (type === "image") {
        return (
            <div
                className="border-border overflow-hidden rounded-md border"
                style={{ maxHeight }}
            >
                <Image
                    src={signedUrl || "/placeholder.svg"}
                    alt="Output"
                    width={400}
                    height={300}
                    className="h-auto w-full object-contain"
                    style={{ maxHeight }}
                />
            </div>
        );
    }

    if (type === "video") {
        return (
            <div
                className="border-border overflow-hidden rounded-md border"
                style={{ maxHeight }}
            >
                <video
                    src={signedUrl || undefined}
                    controls
                    className="h-auto w-full object-contain"
                    style={{ maxHeight }}
                />
            </div>
        );
    }

    // Default to text/json
    const actualValue =
        value && typeof value === "object" && "value" in value
            ? (value.value as Record<string, unknown>)
            : (value as Record<string, unknown>);
    const textValue =
        typeof actualValue === "object"
            ? (actualValue?.output as string) ||
              (actualValue?.text as string) ||
              JSON.stringify(actualValue, null, 2)
            : String(actualValue);
    return (
        <div
            className="text-foreground bg-muted/30 overflow-y-auto rounded-md p-2 text-[10px] break-words whitespace-pre-wrap"
            style={{ maxHeight }}
        >
            {textValue}
        </div>
    );
}

export const CustomWorkflowNode = memo(
    ({ data, selected, id }: NodeProps<Node<CustomWorkflowData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const removeEdges = useFlowStore((state) => state.removeEdges);
        const edges = useFlowStore((state) => state.edges);
        const { executeNode } = useFlowExecution();

        const [interfaceData, setInterfaceData] = useState<{
            inputs: { id: string; name: string; type: string }[];
            outputs: { id: string; name: string; type: string }[];
        } | null>(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);

        const [dimensions, setDimensions] = useState({
            width: data.width || 300,
            height: data.height || 400,
        });
        const [isResizing, setIsResizing] = useState(false);
        const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
        const lastFetchedRef = useRef<string | null>(null);

        useEffect(() => {
            if (data.width && data.height) {
                setDimensions({ width: data.width, height: data.height });
            }
        }, [data.width, data.height]);

        const subWorkflowId = data.subWorkflowId;
        const subWorkflowVersion = data.subWorkflowVersion;

        useEffect(() => {
            const fetchInterface = async () => {
                if (!subWorkflowId || !subWorkflowVersion) return;

                const fetchKey = `${subWorkflowId}-${subWorkflowVersion}`;
                if (lastFetchedRef.current === fetchKey) return;

                setLoading(true);
                try {
                    const res = await fetch(
                        `/api/flows/${subWorkflowId}/versions/${subWorkflowVersion}`,
                    );
                    if (!res.ok)
                        throw new Error(
                            "Failed to fetch sub-workflow interface",
                        );
                    const flow = await res.json();
                    lastFetchedRef.current = fetchKey;

                    const nodes =
                        (flow.nodes as (Node<NodeData> & {
                            data: NodeData;
                        })[]) || [];
                    const inputs = nodes
                        .filter(
                            (n) =>
                                n.type === "workflow-input" ||
                                n.data?.type === "workflow-input",
                        )
                        .map((n) => ({
                            id: n.id,
                            name: (n.data as WorkflowInputData).portName,
                            type: (n.data as WorkflowInputData).portType,
                        }));

                    const outputs = nodes
                        .filter(
                            (n) =>
                                n.type === "workflow-output" ||
                                n.data?.type === "workflow-output",
                        )
                        .map((n) => ({
                            id: n.id,
                            name: (n.data as WorkflowOutputData).portName,
                            type: (n.data as WorkflowOutputData).portType,
                        }));

                    setInterfaceData({ inputs, outputs });

                    const { edges } = useFlowStore.getState();

                    // Clean up stale edges (breaking changes)
                    const staleEdges = edges.filter((edge) => {
                        if (edge.target === id && edge.targetHandle) {
                            const input = inputs.find(
                                (i) => i.id === edge.targetHandle,
                            );
                            if (!input) return true;
                            // Note: we can't easily check prevType here without 'data'
                            // but we can trust the interface update.
                            return false;
                        }
                        if (edge.source === id && edge.sourceHandle) {
                            const output = outputs.find(
                                (o) => o.id === edge.sourceHandle,
                            );
                            if (!output) return true;
                            return false;
                        }
                        return false;
                    });

                    if (staleEdges.length > 0) {
                        removeEdges(staleEdges.map((e) => e.id));
                        toast.error(
                            `Removed ${staleEdges.length} connections due to breaking interface changes`,
                        );
                    }

                    const inputTypes: Record<string, string> = {};
                    inputs.forEach((i) => (inputTypes[i.id] = i.type));
                    const outputTypes: Record<string, string> = {};
                    outputs.forEach((o) => (outputTypes[o.id] = o.type));

                    // Get current data from store for comparison
                    const currentNode = useFlowStore
                        .getState()
                        .nodes.find((n) => n.id === id);
                    const currentData = currentNode?.data as CustomWorkflowData;

                    // Only update if actually changed to prevent loops
                    if (
                        !currentData ||
                        !shallowEqual(currentData.inputs, inputTypes) ||
                        !shallowEqual(currentData.outputs, outputTypes)
                    ) {
                        updateNodeData(id, {
                            inputs: inputTypes,
                            outputs: outputTypes,
                        });
                    }
                } catch (err) {
                    setError(err instanceof Error ? err.message : "Error");
                    lastFetchedRef.current = null; // Reset on error to allow retry
                } finally {
                    setLoading(false);
                }
            };

            fetchInterface();
        }, [subWorkflowId, subWorkflowVersion, id, removeEdges, updateNodeData]);

        const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            setIsResizing(true);
            resizeStartRef.current = {
                x: e.clientX,
                y: e.clientY,
                width: dimensions.width,
                height: dimensions.height,
            };
        };

        useEffect(() => {
            if (!isResizing) return;
            const handleMouseMove = (e: MouseEvent) => {
                const deltaX = e.clientX - resizeStartRef.current.x;
                const deltaY = e.clientY - resizeStartRef.current.y;
                setDimensions({
                    width: Math.max(250, resizeStartRef.current.width + deltaX),
                    height: Math.max(
                        200,
                        resizeStartRef.current.height + deltaY,
                    ),
                });
            };
            const handleMouseUp = () => {
                setIsResizing(false);
                updateNodeData(id, {
                    width: dimensions.width,
                    height: dimensions.height,
                });
            };
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
            return () => {
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
            };
        }, [isResizing, id, updateNodeData, dimensions]);

        const handleExecute = (e: React.MouseEvent) => {
            e.stopPropagation();
            executeNode(id);
        };

        // Results in custom-workflow are stored by output node ID
        const results = data.results || {};

        return (
            <div
                className={`bg-card custom-workflow-node relative rounded-lg border-2 p-4 shadow-lg transition-all ${
                    selected
                        ? "border-primary shadow-primary/20"
                        : "border-border"
                } ${data.executing ? "animate-pulse-bg" : ""}`}
                style={{ width: dimensions.width }}
            >
                <div className="border-border mb-2 flex items-center gap-3 border-b pb-2">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                        <Box className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                        <h3 className="text-foreground truncate text-sm font-semibold">
                            {data.name}
                        </h3>
                        <p className="text-muted-foreground text-[10px]">
                            v{data.subWorkflowVersion}
                        </p>
                    </div>
                </div>

                {loading && (
                    <div className="text-muted-foreground py-2 text-center text-[10px] italic">
                        Loading interface...
                    </div>
                )}

                {error && (
                    <div className="text-destructive py-2 text-center text-[10px] italic">
                        {error}
                    </div>
                )}

                {interfaceData && (
                    <div className="mt-2 flex flex-col gap-4">
                        {/* Ports Row */}
                        <div className="flex justify-between gap-4">
                            {/* Inputs */}
                            <div className="flex flex-col gap-3">
                                {interfaceData.inputs.map((input) => (
                                    <div
                                        key={input.id}
                                        className="relative flex items-center gap-2"
                                    >
                                        <Handle
                                            type="target"
                                            position={Position.Left}
                                            id={input.id}
                                            className={`!-left-6 !h-3 !w-3 port-${input.type}`}
                                        />
                                        <span className="text-foreground text-[10px] font-medium">
                                            {input.name}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Outputs */}
                            <div className="flex flex-col items-end gap-3">
                                {interfaceData.outputs.map((output) => (
                                    <div
                                        key={output.id}
                                        className="relative flex items-center gap-2"
                                    >
                                        <span className="text-foreground text-[10px] font-medium">
                                            {output.name}
                                        </span>
                                        <Handle
                                            type="source"
                                            position={Position.Right}
                                            id={output.id}
                                            className={`!-right-6 !h-3 !w-3 port-${output.type}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Previews Area */}
                        {interfaceData.outputs.length > 0 && (
                            <div className="border-border/50 mt-2 flex flex-col gap-2 border-t pt-3">
                                {interfaceData.outputs.map((output) => (
                                    <div
                                        key={`preview-${output.id}`}
                                        className="space-y-1"
                                    >
                                        <div className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase">
                                            {output.name}
                                        </div>
                                        <SubWorkflowOutputPreview
                                            type={output.type}
                                            value={results[output.id]}
                                            maxHeight={dimensions.height / 2}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <button
                    onClick={handleExecute}
                    disabled={data.executing}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Play className="h-3 w-3" />
                    {data.executing
                        ? "Executing Sub-graph..."
                        : "Execute Workflow"}
                </button>

                {/* Resize handle */}
                <div
                    className="nodrag absolute right-0 bottom-0 h-4 w-4 cursor-se-resize"
                    onMouseDown={handleResizeStart}
                    style={{ touchAction: "none" }}
                >
                    <div className="border-muted-foreground/30 absolute right-1 bottom-1 h-3 w-3 rounded-br border-r-2 border-b-2" />
                </div>
            </div>
        );
    },
);

CustomWorkflowNode.displayName = "CustomWorkflowNode";
