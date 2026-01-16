import { type Node } from "@xyflow/react";
import {
    type NodeType,
    type NodeData,
    type AgentData,
    type TextData,
    type ImageData,
    type VideoData,
    type FileData,
    type UpscaleData,
    type ResizeData,
} from "./types";
import { MODELS, DEFAULTS } from "./constants";

export function createNode(
    type: NodeType,
    position: { x: number; y: number } = { x: 250, y: 250 },
): Node<NodeData> {
    const id = `${type}-${Date.now()}`;

    switch (type) {
        case "agent":
            return {
                id,
                type: "agent",
                position,
                data: {
                    type: "agent",
                    name: "Agent",
                    model: MODELS.TEXT.GEMINI_3_FLASH_PREVIEW,
                    instructions: "",
                } as AgentData,
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
        default:
            throw new Error(`Unknown node type: ${type}`);
    }
}
