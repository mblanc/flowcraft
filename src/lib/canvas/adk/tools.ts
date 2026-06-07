import { FunctionTool } from "@google/adk";
import { z } from "zod";
import {
    MODELS,
    IMAGE_MODEL_CONFIGS,
    IMAGE_SIZES,
    VIDEO_RESOLUTIONS,
} from "@/lib/constants";
import { MEDIA_OPERATIONS, EDGE_ROLES } from "../types";

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

const imageStepSchema = z.object({
    id: z.string(),
    type: z.literal("image"),
    prompt: z.string(),
    label: z.string(),
    aspectRatio: z.enum(IMAGE_ASPECT_RATIOS).optional(),
    imageSize: z.enum(IMAGE_SIZES).optional(),
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
    resolution: z.enum(VIDEO_RESOLUTIONS).optional(),
    model: z.enum(VIDEO_MODELS).optional(),
    duration: z
        .enum(["4", "6", "8"])
        .describe("Duration in seconds.")
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

const planNodeSchema = z.object({
    id: z
        .string()
        .describe(
            "Unique identifier for this node — must be distinct across all nodes in this plan",
        ),
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
    imageSize: z
        .enum(IMAGE_SIZES)
        .optional()
        .describe("For image operations only: image output size."),
    resolution: z
        .enum(VIDEO_RESOLUTIONS)
        .optional()
        .describe("For video operations only: video output resolution."),
    model: z
        .enum([...IMAGE_MODELS, ...VIDEO_MODELS])
        .optional()
        .describe("Leave unset to use the canvas default model"),
    duration: z
        .enum(["4", "6", "8"])
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
    execute: async ({ nodes, edges, clarifications }) => {
        const seen = new Set<string>();
        const deduped = nodes.map((node) => {
            if (!seen.has(node.id)) {
                seen.add(node.id);
                return node;
            }
            let suffix = 2;
            while (seen.has(`${node.id}-${suffix}`)) suffix++;
            const newId = `${node.id}-${suffix}`;
            seen.add(newId);
            return { ...node, id: newId };
        });
        // Edges keep their original IDs — first-occurrence nodes retain their IDs,
        // so existing edge references remain valid after deduplication.
        const remappedEdges = edges.map((e) => ({ ...e }));
        return {
            nodes: deduped,
            edges: remappedEdges,
            ...(clarifications ? { clarifications } : {}),
        };
    },
});

const textNodeSchema = z.object({
    id: z
        .string()
        .describe(
            "Unique node id — must not collide with other nodes emitted in this turn",
        ),
    title: z
        .string()
        .describe(
            "Short human-readable title, e.g. 'Lumino — Trailer Architecture'",
        ),
    content: z.string().describe("Full markdown content of the document"),
    format: z
        .enum(["scenario", "synopsis", "brief", "notes"])
        .optional()
        .describe(
            "'scenario' for shot-by-shot plans, 'synopsis' for narrative summaries",
        ),
});

export const planTextNodesTool = new FunctionTool({
    name: "plan_text_nodes",
    description:
        "Create one or more text document nodes on the canvas. Use for scenarios, synopses, shot lists, or any structured text that grounds future media generation. Call this BEFORE plan_production when the user requests a film, trailer, or ad from scratch.",
    parameters: z.object({ nodes: z.array(textNodeSchema) }),
    execute: async ({ nodes }) => ({ nodes }),
});

export const suggestActionsTool = new FunctionTool({
    name: "suggest_actions",
    description:
        "Suggest 2-3 follow-up actions the user can take. Call this at the end of every response.",
    parameters: z.object({ actions: z.array(actionSchema) }),
    execute: async ({ actions }) => ({ actions }),
});
