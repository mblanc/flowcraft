"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import type { MusicData } from "@/lib/types";
import { MODELS } from "@/lib/constants";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export function ConfigPanel({
    data,
    nodeId,
}: {
    data: MusicData;
    nodeId: string;
}) {
    const updateNodeData = useFlowStore(
        (state: FlowState) => state.updateNodeData,
    );

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1.5">
                <Label>Prompt</Label>
                <Textarea
                    className="min-h-[100px] resize-none"
                    placeholder="Describe the music to generate…"
                    value={data.prompt}
                    onChange={(e) =>
                        updateNodeData(nodeId, { prompt: e.target.value })
                    }
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <Label>Model</Label>
                <Select
                    value={data.model ?? MODELS.MUSIC.LYRIA_3_CLIP}
                    onValueChange={(model) => updateNodeData(nodeId, { model })}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={MODELS.MUSIC.LYRIA_3_CLIP}>
                            Lyria 3 Clip
                        </SelectItem>
                        <SelectItem value={MODELS.MUSIC.LYRIA_3_PRO}>
                            Lyria 3 Pro
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
