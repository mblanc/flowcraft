import { LLMNode } from "../llm-node";
import { TextNode } from "../text-node";
import { ImageNode } from "../image-node";
import { VideoNode } from "../video-node";
import { FileNode } from "../file-node";
import { UpscaleNode } from "../upscale-node";
import { ResizeNode } from "../resize-node";
import { WorkflowInputNode } from "../workflow-input-node";
import { WorkflowOutputNode } from "../workflow-output-node";
import { CustomWorkflowNode } from "../custom-workflow-node";
import { ListNode } from "../list-node";
import type { CustomNodePort } from "@/lib/types";
import {
    Bot,
    FileText,
    ImageIcon,
    Video,
    FileUp,
    ZoomIn,
    Scaling,
    LogIn,
    LogOut,
    ListOrdered,
} from "lucide-react";

export interface CustomNodeItem {
    id: string;
    name: string;
    inputs: CustomNodePort[];
    outputs: CustomNodePort[];
}

export const nodeTypes = {
    llm: LLMNode,
    text: TextNode,
    image: ImageNode,
    video: VideoNode,
    file: FileNode,
    upscale: UpscaleNode,
    resize: ResizeNode,
    list: ListNode,
    "workflow-input": WorkflowInputNode,
    "workflow-output": WorkflowOutputNode,
    "custom-workflow": CustomWorkflowNode,
};

export const NODE_COLORS: Record<string, string> = {
    llm: "oklch(0.65 0.25 252)",
    text: "#a855f7", // purple-500
    image: "#f97316", // orange-500
    video: "#ec4899", // pink-500
    file: "#06b6d4", // cyan-500
    upscale: "#ef4444", // red-500
    resize: "#3b82f6", // blue-500
    list: "#14b8a6", // teal-500
    "workflow-input": "#60a5fa", // blue-400
    "workflow-output": "#fb923c", // orange-400
    "custom-workflow": "#3b82f6", // blue-500
};

export const nativeItems = [
    {
        type: "text",
        icon: FileText,
        color: "text-purple-500 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-950/20",
        label: "Text",
    },
    {
        type: "list",
        icon: ListOrdered,
        color: "text-teal-500 hover:bg-teal-50 hover:text-teal-600 dark:hover:bg-teal-950/20",
        label: "List",
    },
    {
        type: "file",
        icon: FileUp,
        color: "text-cyan-500 hover:bg-cyan-50 hover:text-cyan-600 dark:hover:bg-cyan-950/20",
        label: "File",
    },
    {
        type: "llm",
        icon: Bot,
        color: "text-primary hover:text-primary/80 hover:bg-primary/10",
        label: "LLM",
    },
    {
        type: "image",
        icon: ImageIcon,
        color: "text-orange-500 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950/20",
        label: "Image",
    },
    {
        type: "video",
        icon: Video,
        color: "text-pink-500 hover:bg-pink-50 hover:text-pink-600 dark:hover:bg-pink-950/20",
        label: "Video",
    },
    {
        type: "upscale",
        icon: ZoomIn,
        color: "text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20",
        label: "Upscale",
    },
    {
        type: "resize",
        icon: Scaling,
        color: "text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/20",
        label: "Resize",
    },
] as const;

export const workflowIOItems = [
    {
        type: "workflow-input",
        icon: LogIn,
        color: "text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/20",
        label: "Input",
    },
    {
        type: "workflow-output",
        icon: LogOut,
        color: "text-orange-500 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950/20",
        label: "Output",
    },
] as const;
