"use client";

import { memo, useEffect, useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Box } from "lucide-react";
import { CustomWorkflowData, WorkflowInputData, WorkflowOutputData } from "@/lib/types";
import { useFlowStore } from "@/lib/store/use-flow-store";

export const CustomWorkflowNode = memo(
    ({ data, selected, id }: NodeProps<Node<CustomWorkflowData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const [interfaceData, setInterfaceData] = useState<{
            inputs: { id: string; name: string; type: string }[];
            outputs: { id: string; name: string; type: string }[];
        } | null>(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);

        useEffect(() => {
            const fetchInterface = async () => {
                setLoading(true);
                try {
                    const res = await fetch(`/api/flows/${data.subWorkflowId}/versions/${data.subWorkflowVersion}`);
                    if (!res.ok) throw new Error("Failed to fetch sub-workflow interface");
                    const flow = await res.json();
                    
                    const nodes = flow.nodes as any[];
                    const inputs = nodes
                        .filter(n => n.type === 'workflow-input')
                        .map(n => ({
                            id: n.id,
                            name: (n.data as WorkflowInputData).portName,
                            type: (n.data as WorkflowInputData).portType
                        }));
                    
                    const outputs = nodes
                        .filter(n => n.type === 'workflow-output')
                        .map(n => ({
                            id: n.id,
                            name: (n.data as WorkflowOutputData).portName,
                            type: (n.data as WorkflowOutputData).portType
                        }));

                    setInterfaceData({ inputs, outputs });

                    // Store types in node data for connection validation (getSourcePortType/getTargetPortType)
                    const inputTypes: Record<string, string> = {};
                    inputs.forEach(i => inputTypes[i.id] = i.type);
                    const outputTypes: Record<string, string> = {};
                    outputs.forEach(o => outputTypes[o.id] = o.type);

                    updateNodeData(id, {
                        inputs: inputTypes,
                        outputs: outputTypes
                    } as any);
                } catch (err) {
                    setError(err instanceof Error ? err.message : "Error");
                } finally {
                    setLoading(false);
                }
            };

            if (data.subWorkflowId && data.subWorkflowVersion) {
                fetchInterface();
            }
        }, [data.subWorkflowId, data.subWorkflowVersion]);

        return (
            <div
                className={`bg-card relative min-w-[200px] rounded-lg border-2 p-4 shadow-lg transition-all ${
                    selected
                        ? "border-primary shadow-primary/20"
                        : "border-border"
                }`}
            >
                <div className="flex items-center gap-3 border-b border-border pb-2 mb-2">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                        <Box className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                        <h3 className="text-foreground truncate text-sm font-semibold">
                            {data.name}
                        </h3>
                        <p className="text-[10px] text-muted-foreground">
                            v{data.subWorkflowVersion}
                        </p>
                    </div>
                </div>

                {loading && (
                    <div className="py-2 text-[10px] text-muted-foreground italic text-center">
                        Loading interface...
                    </div>
                )}

                {error && (
                    <div className="py-2 text-[10px] text-destructive italic text-center">
                        {error}
                    </div>
                )}

                {interfaceData && (
                    <div className="flex justify-between gap-4 mt-2">
                        {/* Inputs */}
                        <div className="flex flex-col gap-3">
                            {interfaceData.inputs.map((input) => (
                                <div key={input.id} className="relative flex items-center gap-2">
                                    <Handle
                                        type="target"
                                        position={Position.Left}
                                        id={input.id}
                                        className={`!w-3 !h-3 !-left-6 !bg-blue-500 port-${input.type}`}
                                    />
                                    <span className="text-[10px] font-medium text-foreground">{input.name}</span>
                                </div>
                            ))}
                        </div>

                        {/* Outputs */}
                        <div className="flex flex-col gap-3 items-end">
                            {interfaceData.outputs.map((output) => (
                                <div key={output.id} className="relative flex items-center gap-2">
                                    <span className="text-[10px] font-medium text-foreground">{output.name}</span>
                                    <Handle
                                        type="source"
                                        position={Position.Right}
                                        id={output.id}
                                        className={`!w-3 !h-3 !-right-6 !bg-blue-500 port-${output.type}`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    },
);

CustomWorkflowNode.displayName = "CustomWorkflowNode";
