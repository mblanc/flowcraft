"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import type { CustomWorkflowData } from "@/lib/types";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export function CustomWorkflowConfig({
    data,
    nodeId,
}: {
    data: CustomWorkflowData;
    nodeId: string;
}) {
    const updateNodeData = useFlowStore(
        (state: FlowState) => state.updateNodeData,
    );

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                    id="name"
                    value={data.name}
                    onChange={(e) =>
                        updateNodeData(nodeId, { name: e.target.value })
                    }
                    placeholder="Workflow name"
                />
            </div>
        </div>
    );
}
