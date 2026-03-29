"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import type {
    LLMData,
    TextData,
    ImageData,
    VideoData,
    FileData,
} from "@/lib/types";
import { LLMConfig } from "./llm-config";
import { TextConfig } from "./text-config";
import { ImageConfig } from "./image-config";
import { VideoConfig } from "./video-config";
import { FileConfig } from "./file-config";
import { CustomWorkflowConfig } from "./custom-workflow-config";

export function ConfigPanel() {
    const selectedNode = useFlowStore((state: FlowState) => state.selectedNode);

    if (!selectedNode) return null;

    const { data, id } = selectedNode;

    if (data.type === "llm") {
        return <LLMConfig data={data as LLMData} nodeId={id} />;
    }

    if (data.type === "text") {
        return <TextConfig data={data as TextData} nodeId={id} />;
    }

    if (data.type === "image") {
        return <ImageConfig data={data as ImageData} nodeId={id} />;
    }

    if (data.type === "video") {
        return <VideoConfig data={data as VideoData} nodeId={id} />;
    }

    if (data.type === "file") {
        return <FileConfig data={data as FileData} nodeId={id} />;
    }

    if (data.type === "custom-workflow") {
        return <CustomWorkflowConfig data={data} nodeId={id} />;
    }

    return null;
}
