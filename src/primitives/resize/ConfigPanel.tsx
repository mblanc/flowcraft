"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import type { ResizeData } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Scaling } from "lucide-react";

export function ConfigPanel({
    data,
    nodeId,
}: {
    data: ResizeData;
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
                    placeholder="Resize node name"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="aspectRatio">Aspect Ratio</Label>
                <Select
                    value={data.aspectRatio}
                    onValueChange={(value) =>
                        updateNodeData(nodeId, {
                            aspectRatio: value as "16:9" | "9:16",
                        })
                    }
                >
                    <SelectTrigger id="aspectRatio">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="16:9">Horizontal (16:9)</SelectItem>
                        <SelectItem value="9:16">Vertical (9:16)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="bg-muted/30 border-border flex items-start gap-3 rounded-lg border p-4">
                <Scaling className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                    <h4 className="text-xs font-semibold">About Resizing</h4>
                    <p className="text-muted-foreground text-[10px] leading-relaxed">
                        This node crops or resizes the input image to fit the
                        selected aspect ratio. Connect an image output to this
                        node&apos;s input.
                    </p>
                </div>
            </div>
        </div>
    );
}
