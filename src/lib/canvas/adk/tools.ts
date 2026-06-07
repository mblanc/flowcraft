import { FunctionTool } from "@google/adk";
import { z } from "zod";

const IMAGE_MODELS = [
    "gemini-2.5-flash-image",
    "gemini-3-pro-image",
    "gemini-3.1-flash-image",
] as const;

const VIDEO_MODELS = [
    "veo-3.1-lite-generate-001",
    "veo-3.1-fast-generate-001",
    "veo-3.1-generate-001",
] as const;

const imageStepSchema = z.object({
    id: z.string(),
    type: z.literal("image"),
    prompt: z.string(),
    label: z.string(),
    aspectRatio: z.string().optional(),
    resolution: z.string().optional(),
    model: z.enum(IMAGE_MODELS).optional(),
    referenceNodeIds: z.array(z.string()).optional(),
    dependsOn: z.array(z.string()).optional(),
});

const videoStepSchema = z.object({
    id: z.string(),
    type: z.literal("video"),
    prompt: z.string(),
    label: z.string(),
    aspectRatio: z.string().optional(),
    resolution: z.string().optional(),
    model: z.enum(VIDEO_MODELS).optional(),
    duration: z
        .number()
        .int()
        .describe("Duration in seconds. Valid values: 4, 6, 8.")
        .optional(),
    generateAudio: z.boolean().optional(),
    referenceNodeIds: z.array(z.string()).optional(),
    firstFrameNodeId: z.string().optional(),
    lastFrameNodeId: z.string().optional(),
    dependsOn: z.array(z.string()).optional(),
});

const actionSchema = z.object({
    label: z.string(),
    prompt: z.string(),
});

export const planImageGenerationTool = new FunctionTool({
    name: "plan_image_generation",
    description:
        "Declare a list of image generation steps. Call this when the user wants to generate one or more images. Each step becomes a node on the canvas.",
    parameters: z.object({ steps: z.array(imageStepSchema) }),
    execute: async ({ steps }) => ({ steps }),
});

export const planVideoGenerationTool = new FunctionTool({
    name: "plan_video_generation",
    description:
        "Declare a list of video generation steps. Call this when the user wants to generate one or more videos. Each step becomes a node on the canvas.",
    parameters: z.object({ steps: z.array(videoStepSchema) }),
    execute: async ({ steps }) => ({ steps }),
});

export const suggestActionsTool = new FunctionTool({
    name: "suggest_actions",
    description:
        "Suggest 2-3 follow-up actions the user can take. Call this at the end of every response.",
    parameters: z.object({ actions: z.array(actionSchema) }),
    execute: async ({ actions }) => ({ actions }),
});
