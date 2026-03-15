"use client";

import { memo, useEffect, useState, useRef } from "react";
import { useNodeResize } from "@/hooks/use-node-resize";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Box, Play } from "lucide-react";
import { CustomWorkflowData } from "@/lib/types";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { NodeTitle } from "@/components/node-title";
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
    const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

    // Extract the actual value, unwrapping if it came from a workflow-output node
    const actualValue =
        value && typeof value === "object" && "value" in value
            ? (value.value as Record<string, unknown>)
            : (value as Record<string, unknown>);

    // Extract URIs based on type
    const extractUris = (): string[] => {
        if (!actualValue) return [];

        if (type === "image") {
            // Handle array of images or single image
            const images = actualValue.images as string[] | undefined;
            const image = actualValue.image as string | undefined;
            if (images && Array.isArray(images)) return images;
            if (image) return [image];
            return [];
        }

        if (type === "video") {
            const videoUrl = actualValue.videoUrl as string | undefined;
            if (videoUrl) return [videoUrl];
            return [];
        }

        return [];
    };

    const uris = extractUris();

    useEffect(() => {
        const fetchSignedUrls = async () => {
            const newSignedUrls: Record<string, string> = {};

            for (const uri of uris) {
                if (!uri) continue;

                if (uri.startsWith("gs://")) {
                    try {
                        const res = await fetch(
                            `/api/signed-url?gcsUri=${encodeURIComponent(uri)}`,
                        );
                        const result = await res.json();
                        if (result.signedUrl) {
                            newSignedUrls[uri] = result.signedUrl;
                        }
                    } catch (error) {
                        logger.error("Error fetching signed URL:", error);
                    }
                } else {
                    // Non-GCS URLs can be used directly
                    newSignedUrls[uri] = uri;
                }
            }

            if (Object.keys(newSignedUrls).length > 0) {
                setSignedUrls((prev) => ({ ...prev, ...newSignedUrls }));
            }
        };

        if (uris.length > 0) {
            fetchSignedUrls();
        }
    }, [JSON.stringify(uris)]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!value) return null;

    if (type === "image" && uris.length > 0) {
        return (
            <div className="flex flex-col gap-2">
                {uris.map((uri, index) => {
                    const displayUrl = signedUrls[uri];
                    if (!displayUrl) {
                        return (
                            <div
                                key={index}
                                className="border-border bg-muted/30 flex items-center justify-center overflow-hidden rounded-md border"
                                style={{ height: maxHeight / uris.length }}
                            >
                                <span className="text-muted-foreground text-xs">
                                    Loading...
                                </span>
                            </div>
                        );
                    }
                    return (
                        <div
                            key={index}
                            className="border-border overflow-hidden rounded-md border"
                            style={{ maxHeight: maxHeight / uris.length }}
                        >
                            <Image
                                src={displayUrl}
                                alt={`Output ${index + 1}`}
                                width={400}
                                height={300}
                                className="h-auto w-full object-contain"
                                style={{ maxHeight: maxHeight / uris.length }}
                            />
                        </div>
                    );
                })}
            </div>
        );
    }

    if (type === "video" && uris.length > 0) {
        const displayUrl = signedUrls[uris[0]];
        return (
            <div
                className="border-border overflow-hidden rounded-md border"
                style={{ maxHeight }}
            >
                {displayUrl ? (
                    <video
                        src={displayUrl}
                        controls
                        className="h-auto w-full object-contain"
                        style={{ maxHeight }}
                    />
                ) : (
                    <div className="bg-muted/30 flex items-center justify-center p-4">
                        <span className="text-muted-foreground text-xs">
                            Loading video...
                        </span>
                    </div>
                )}
            </div>
        );
    }

    // Default to text/json
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
        const { executeNode } = useFlowExecution();

        const [interfaceData, setInterfaceData] = useState<{
            inputs: { id: string; name: string; type: string }[];
            outputs: { id: string; name: string; type: string }[];
        } | null>(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);

        const { dimensions, handleResizeStart } = useNodeResize(
            id,
            data.width,
            data.height,
            {
                defaultWidth: 300,
                defaultHeight: 400,
                minWidth: 250,
                minHeight: 200,
            },
        );
        const lastFetchedRef = useRef<string | null>(null);

        const subWorkflowId = data.subWorkflowId;

        useEffect(() => {
            const fetchInterface = async () => {
                if (!subWorkflowId) return;

                // Use subWorkflowId as cache key
                const fetchKey = `${subWorkflowId}`;
                if (lastFetchedRef.current === fetchKey) return;

                setLoading(true);
                try {
                    // Fetch from the new custom-nodes API
                    const res = await fetch(
                        `/api/custom-nodes/${subWorkflowId}`,
                    );
                    if (!res.ok)
                        throw new Error(
                            "Failed to fetch custom node interface",
                        );
                    const customNode = await res.json();
                    lastFetchedRef.current = fetchKey;

                    // The new API returns inputs and outputs directly
                    const inputs = customNode.inputs || [];
                    const outputs = customNode.outputs || [];

                    setInterfaceData({ inputs, outputs });

                    const { edges } = useFlowStore.getState();

                    // Clean up stale edges (breaking changes)
                    const staleEdges = edges.filter((edge) => {
                        if (edge.target === id && edge.targetHandle) {
                            const input = inputs.find(
                                (i: { id: string }) =>
                                    i.id === edge.targetHandle,
                            );
                            if (!input) return true;
                            return false;
                        }
                        if (edge.source === id && edge.sourceHandle) {
                            const output = outputs.find(
                                (o: { id: string }) =>
                                    o.id === edge.sourceHandle,
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
                    inputs.forEach(
                        (i: { id: string; type: string }) =>
                            (inputTypes[i.id] = i.type),
                    );
                    const outputTypes: Record<string, string> = {};
                    outputs.forEach(
                        (o: { id: string; type: string }) =>
                            (outputTypes[o.id] = o.type),
                    );

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
        }, [subWorkflowId, id, removeEdges, updateNodeData]);

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
                }`}
                style={{ width: dimensions.width }}
            >
                {data.executing && (
                    <div
                        className="border-beam-glow"
                        style={
                            { "--beam-color": "#3b82f6" } as React.CSSProperties
                        }
                    />
                )}

                <div className="border-border mb-2 flex items-center gap-3 border-b pb-2">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                        <Box className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                        <NodeTitle
                            name={data.name}
                            onRename={(n) => updateNodeData(id, { name: n })}
                            className="text-foreground"
                        />
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
                                            className={`port-${input.type}`}
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
                                            className={`port-${output.type}`}
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
    (prevProps, nextProps) => {
        return (
            prevProps.id === nextProps.id &&
            prevProps.selected === nextProps.selected &&
            prevProps.data === nextProps.data
        );
    },
);

CustomWorkflowNode.displayName = "CustomWorkflowNode";
