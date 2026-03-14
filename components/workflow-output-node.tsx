"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { WorkflowOutputData } from "@/lib/types";
import { LogOut } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { Input } from "./ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { Label } from "./ui/label";

export const WorkflowOutputNode = memo(
    ({ data, selected, id }: NodeProps<Node<WorkflowOutputData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);

        const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            updateNodeData(id, { portName: e.target.value });
        };

        const handleTypeChange = (value: string) => {
            updateNodeData(id, {
                portType: value as WorkflowOutputData["portType"],
            });
        };

        return (
            <div
                className={`bg-card relative w-64 rounded-lg border-2 p-4 shadow-lg transition-all ${
                    selected
                        ? "border-primary shadow-primary/20"
                        : "border-border"
                }`}
            >
                <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-orange-500/10">
                        <LogOut className="h-5 w-5 text-orange-400" />
                    </div>

                    <div className="min-w-0 flex-1 text-left">
                        <h3 className="text-foreground mb-1 truncate text-sm font-semibold">
                            Workflow Output
                        </h3>
                        <p className="text-muted-foreground text-[10px]">
                            Defines a sub-graph output
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label className="text-muted-foreground text-[10px] uppercase">
                            Port Name
                        </Label>
                        <Input
                            value={data.portName || ""}
                            onChange={handleNameChange}
                            placeholder="e.g. result"
                            className="h-8 text-xs"
                        />
                    </div>

                    <div className="space-y-1">
                        <Label className="text-muted-foreground text-[10px] uppercase">
                            Type
                        </Label>
                        <Select
                            value={data.portType}
                            onValueChange={handleTypeChange}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="image">Image</SelectItem>
                                <SelectItem value="video">Video</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Handle
                    type="target"
                    position={Position.Left}
                    className="!bg-orange-500"
                />
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

WorkflowOutputNode.displayName = "WorkflowOutputNode";
