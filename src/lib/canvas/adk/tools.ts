import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { MODELS, IMAGE_MODEL_CONFIGS } from "@/lib/constants";

// Derive valid values directly from constants so there's one source of truth.

const IMAGE_MODELS = [
    MODELS.IMAGE.GEMINI_2_5_FLASH_IMAGE,
    MODELS.IMAGE.GEMINI_3_PRO_IMAGE,
    MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE,
] as const;

const VIDEO_MODELS = [
    MODELS.VIDEO.VEO_3_1_LITE,
    MODELS.VIDEO.VEO_3_1_FAST,
    MODELS.VIDEO.VEO_3_1_PRO,
] as const;

// Union of all aspect ratios across every image model config.
const IMAGE_ASPECT_RATIOS = [
    ...new Set(
        Object.values(IMAGE_MODEL_CONFIGS).flatMap((c) =>
            c.ratios.filter((r) => r !== "Auto"),
        ),
    ),
] as const;

const VIDEO_ASPECT_RATIOS = ["16:9", "9:16"] as const;

const ALL_ASPECT_RATIOS = [
    ...new Set([...IMAGE_ASPECT_RATIOS, ...VIDEO_ASPECT_RATIOS]),
] as const;

const RESOLUTIONS = ["512", "1K", "2K", "4K"] as const;

// Agent A tools (unchanged — used by buildAgentA)

const imageStepSchema = z.object({
    id: z.string(),
    type: z.literal("image"),
    prompt: z.string(),
    label: z.string(),
    aspectRatio: z.enum(IMAGE_ASPECT_RATIOS).optional(),
    resolution: z.enum(RESOLUTIONS).optional(),
    model: z.enum(IMAGE_MODELS).optional(),
    referenceNodeIds: z.array(z.string()).optional(),
    dependsOn: z.array(z.string()).optional(),
});

const videoStepSchema = z.object({
    id: z.string(),
    type: z.literal("video"),
    prompt: z.string(),
    label: z.string(),
    aspectRatio: z.enum(VIDEO_ASPECT_RATIOS).optional(),
    resolution: z.enum(RESOLUTIONS).optional(),
    model: z.enum(VIDEO_MODELS).optional(),
    duration: z
        .union([z.literal(4), z.literal(6), z.literal(8)])
        .describe("Duration in seconds. Valid values: 4, 6, or 8.")
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

// Director tools (used by buildAgentB)

const MEDIA_OPERATIONS = [
    "t2i",
    "i2i",
    "t2v",
    "i2v",
    "i2v2",
    "t2s",
    "t2m",
    "sfx",
    "concat",
    "edit",
    "upscale",
] as const;

const EDGE_ROLES = ["depends_on", "style_ref", "subject_ref"] as const;

const planNodeSchema = z.object({
    id: z.string(),
    operation: z.enum(MEDIA_OPERATIONS),
    promptIntent: z
        .string()
        .describe(
            "Plain-language description of what this node should produce",
        ),
    prompt: z
        .string()
        .optional()
        .describe("Fully-engineered prompt (filled by PromptEngineer)"),
    label: z.string().optional(),
    aspectRatio: z.enum(ALL_ASPECT_RATIOS).optional(),
    resolution: z.enum(RESOLUTIONS).optional(),
    model: z
        .enum([...IMAGE_MODELS, ...VIDEO_MODELS])
        .optional()
        .describe("Leave unset to use the canvas default model"),
    duration: z
        .union([z.literal(4), z.literal(6), z.literal(8)])
        .optional()
        .describe("Video duration in seconds. MUST be exactly 4, 6, or 8."),
    generateAudio: z.boolean().optional(),
    skill: z.string().optional(),
});

const planEdgeSchema = z.object({
    from: z.string(),
    to: z.string(),
    role: z.enum(EDGE_ROLES),
});

export const planProductionTool = new FunctionTool({
    name: "plan_production",
    description:
        "Emit a production plan as a DAG of typed media operation nodes and edges. Call this once after deciding the full plan. Nodes represent media operations; edges express dependencies and references between them.",
    parameters: z.object({
        nodes: z.array(planNodeSchema),
        edges: z.array(planEdgeSchema),
        clarifications: z
            .array(z.string())
            .optional()
            .describe(
                "Questions to surface to the user when the intent is ambiguous",
            ),
    }),
    execute: async ({ nodes, edges, clarifications }) => ({
        nodes,
        edges,
        ...(clarifications ? { clarifications } : {}),
    }),
});

export const suggestActionsTool = new FunctionTool({
    name: "suggest_actions",
    description:
        "Suggest 2-3 follow-up actions the user can take. Call this at the end of every response.",
    parameters: z.object({ actions: z.array(actionSchema) }),
    execute: async ({ actions }) => ({ actions }),
});
