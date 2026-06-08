"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import type { TextData } from "@/lib/types";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

export function TextConfig({
    data,
    nodeId,
}: {
    data: TextData;
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
                    placeholder="Text node name"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="text">Text</Label>
                <Textarea
                    id="text"
                    value={data.text}
                    onChange={(e) =>
                        updateNodeData(nodeId, { text: e.target.value })
                    }
                    placeholder="Enter text content..."
                    rows={8}
                />
            </div>
        </div>
    );
}
