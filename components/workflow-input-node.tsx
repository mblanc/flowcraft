"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { WorkflowInputData } from "@/lib/types";
import { LogIn } from "lucide-react";
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
import { Switch } from "./ui/switch";

export const WorkflowInputNode = memo(
    ({ data, selected, id }: NodeProps<Node<WorkflowInputData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);

        const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            updateNodeData(id, { portName: e.target.value });
        };

        const handleTypeChange = (value: string) => {
            updateNodeData(id, {
                portType: value as WorkflowInputData["portType"],
            });
        };

        const handleRequiredChange = (checked: boolean) => {
            updateNodeData(id, { portRequired: checked });
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
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                        <LogIn className="h-5 w-5 text-blue-400" />
                    </div>

                    <div className="min-w-0 flex-1 text-left">
                        <h3 className="text-foreground mb-1 truncate text-sm font-semibold">
                            Workflow Input
                        </h3>
                        <p className="text-muted-foreground text-[10px]">
                            Defines a sub-graph input
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
                            placeholder="e.g. prompt"
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
                                <SelectItem value="string">String</SelectItem>
                                <SelectItem value="image">Image</SelectItem>
                                <SelectItem value="video">Video</SelectItem>
                                <SelectItem value="json">JSON</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        <Label className="text-muted-foreground text-[10px] uppercase">
                            Required
                        </Label>
                        <Switch
                            checked={data.portRequired}
                            onCheckedChange={handleRequiredChange}
                        />
                    </div>
                </div>

                <Handle
                    type="source"
                    position={Position.Right}
                    className="!bg-blue-500"
                />
            </div>
        );
    },
);

WorkflowInputNode.displayName = "WorkflowInputNode";
