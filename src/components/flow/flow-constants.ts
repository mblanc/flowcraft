import { LLMNode } from "../nodes/llm-node";
import { TextNode } from "../nodes/text-node";
import { ImageNode } from "../nodes/image-node";
import { VideoNode } from "../nodes/video-node";
import { FileNode } from "../nodes/file-node";
import { UpscaleNode } from "../nodes/upscale-node";
import { ResizeNode } from "../nodes/resize-node";
import { WorkflowInputNode } from "../nodes/workflow-input-node";
import { WorkflowOutputNode } from "../nodes/workflow-output-node";
import { CustomWorkflowNode } from "../nodes/custom-workflow-node";
import { ListNode } from "../nodes/list-node";
import { RouterNode } from "../nodes/router-node";
import type { CustomNodePort } from "@/lib/types";
import {
    Bot,
    FileText,
    GitMerge,
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
    router: RouterNode,
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
    router: "#6b7280", // gray-500
};

export const nativeItems = [
    {
        type: "text",
        icon: FileText,
        color: "text-muted-foreground hover:bg-accent hover:text-foreground",
        label: "Text",
    },
    {
        type: "list",
        icon: ListOrdered,
        color: "text-muted-foreground hover:bg-accent hover:text-foreground",
        label: "List",
    },
    {
        type: "router",
        icon: GitMerge,
        color: "text-muted-foreground hover:bg-accent hover:text-foreground",
        label: "Router",
    },
    {
        type: "file",
        icon: FileUp,
        color: "text-muted-foreground hover:bg-accent hover:text-foreground",
        label: "File",
    },
    {
        type: "llm",
        icon: Bot,
        color: "text-primary hover:bg-primary/10 hover:text-primary",
        label: "LLM",
    },
    {
        type: "image",
        icon: ImageIcon,
        color: "text-muted-foreground hover:bg-accent hover:text-foreground",
        label: "Image",
    },
    {
        type: "video",
        icon: Video,
        color: "text-muted-foreground hover:bg-accent hover:text-foreground",
        label: "Video",
    },
    {
        type: "upscale",
        icon: ZoomIn,
        color: "text-muted-foreground hover:bg-accent hover:text-foreground",
        label: "Upscale",
    },
    {
        type: "resize",
        icon: Scaling,
        color: "text-muted-foreground hover:bg-accent hover:text-foreground",
        label: "Resize",
    },
] as const;

export const workflowIOItems = [
    {
        type: "workflow-input",
        icon: LogIn,
        color: "text-muted-foreground hover:bg-accent hover:text-foreground",
        label: "Input",
    },
    {
        type: "workflow-output",
        icon: LogOut,
        color: "text-muted-foreground hover:bg-accent hover:text-foreground",
        label: "Output",
    },
] as const;
