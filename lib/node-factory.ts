import { type Node } from "@xyflow/react";
import {
    type NodeType,
    type NodeData,
    type LLMData,
    type TextData,
    type ImageData,
    type VideoData,
    type FileData,
    type UpscaleData,
    type ResizeData,
    type WorkflowInputData,
    type WorkflowOutputData,
} from "./types";
import { MODELS, DEFAULTS } from "./constants";

export function createNode(
    type: NodeType,
    position: { x: number; y: number } = { x: 250, y: 250 },
): Node<NodeData> {
    const id = `${type}-${Date.now()}`;

    switch (type) {
        case "llm":
            return {
                id,
                type: "llm",
                position,
                data: {
                    type: "llm",
                    name: "LLM",
                    model: MODELS.TEXT.GEMINI_3_FLASH_PREVIEW,
                    instructions: "",
                    outputType: "text",
                    strictMode: false,
                    visualSchema: [],
                } as LLMData,
            };
        case "text":
            return {
                id,
                type: "text",
                position,
                data: {
                    type: "text",
                    name: "Text",
                    text: "",
                } as TextData,
            };
        case "image":
            return {
                id,
                type: "image",
                position,
                data: {
                    type: "image",
                    name: "Image",
                    prompt: "",
                    images: [],
                    aspectRatio: DEFAULTS.ASPECT_RATIO,
                    model: MODELS.IMAGE.GEMINI_3_PRO_IMAGE_PREVIEW,
                    resolution: DEFAULTS.IMAGE_RESOLUTION,
                } as ImageData,
            };
        case "video":
            return {
                id,
                type: "video",
                position,
                data: {
                    type: "video",
                    name: "Video",
                    prompt: "",
                    images: [],
                    aspectRatio: DEFAULTS.ASPECT_RATIO,
                    duration: DEFAULTS.VIDEO_DURATION,
                    model: MODELS.VIDEO.VEO_3_1_FAST_PREVIEW,
                    generateAudio: false,
                    resolution: "720p",
                } as VideoData,
            };
        case "file":
            return {
                id,
                type: "file",
                position,
                data: {
                    type: "file",
                    name: "File",
                    fileType: null,
                    fileUrl: "",
                    fileName: "",
                } as FileData,
            };
        case "upscale":
            return {
                id,
                type: "upscale",
                position,
                data: {
                    type: "upscale",
                    name: "Upscale",
                    image: "",
                    upscaleFactor: "x2",
                } as UpscaleData,
            };
        case "resize":
            return {
                id,
                type: "resize",
                position,
                data: {
                    type: "resize",
                    name: "Resize",
                    aspectRatio: DEFAULTS.ASPECT_RATIO,
                } as ResizeData,
            };
        case "workflow-input":
            return {
                id,
                type: "workflow-input",
                position,
                data: {
                    type: "workflow-input",
                    name: "Workflow Input",
                    portName: "input",
                    portType: "string",
                    portRequired: true,
                } as WorkflowInputData,
            };
        case "workflow-output":
            return {
                id,
                type: "workflow-output",
                position,
                data: {
                    type: "workflow-output",
                    name: "Workflow Output",
                    portName: "output",
                    portType: "string",
                } as WorkflowOutputData,
            };
        case "custom-workflow":
            return {
                id,
                type: "custom-workflow",
                position,
                data: {
                    type: "custom-workflow",
                    name: "Custom Workflow",
                    subWorkflowId: "",
                    subWorkflowVersion: "",
                } as any,
            };
        default:
            throw new Error(`Unknown node type: ${type}`);
    }
}
