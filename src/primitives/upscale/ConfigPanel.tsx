"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import type { UpscaleData } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ZoomIn } from "lucide-react";

export function ConfigPanel({
    data,
    nodeId,
}: {
    data: UpscaleData;
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
                    placeholder="Upscale node name"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="upscaleFactor">Scale Factor</Label>
                <Select
                    value={data.upscaleFactor}
                    onValueChange={(value) =>
                        updateNodeData(nodeId, {
                            upscaleFactor: value as "x2" | "x3" | "x4",
                        })
                    }
                >
                    <SelectTrigger id="upscaleFactor">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="x2">2x Upscale</SelectItem>
                        <SelectItem value="x3">3x Upscale</SelectItem>
                        <SelectItem value="x4">4x Upscale</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="bg-muted/30 border-border flex items-start gap-3 rounded-lg border p-4">
                <ZoomIn className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                    <h4 className="text-xs font-semibold">About Upscaling</h4>
                    <p className="text-muted-foreground text-[10px] leading-relaxed">
                        This node uses Gemini/Imagen&apos;s super-resolution to
                        increase the width and height of the input image while
                        preserving details and clarity. Connect an image node
                        output to this node&apos;s input.
                    </p>
                </div>
            </div>
        </div>
    );
}
