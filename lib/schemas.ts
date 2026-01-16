import { z } from "zod";
import { MODELS, DEFAULTS } from "./constants";

// --- Shared Types ---

const AspectRatio169_916Schema = z.enum(["16:9", "9:16"]);

const ImageDataAspectRatioSchema = z.enum([
    "16:9",
    "9:16",
    "1:1",
    "3:2",
    "2:3",
    "4:3",
    "3:4",
    "5:4",
    "4:5",
    "21:9",
]);

const ImageDataModelSchema = z.enum([
    MODELS.IMAGE.GEMINI_2_5_FLASH_IMAGE,
    MODELS.IMAGE.GEMINI_3_PRO_IMAGE_PREVIEW,
]);

const ImageDataResolutionSchema = z.enum(["1K", "2K", "4K"]);

// --- Node Data Schemas ---

export const BaseNodeDataSchema = z.object({
    name: z.string(),
    executing: z.boolean().optional(),
    generatedAt: z.number().optional(),
});

export const AgentDataSchema = BaseNodeDataSchema.extend({
    type: z.literal("agent"),
    model: z.string(),
    instructions: z.string(),
    output: z.string().optional(),
});

export const TextDataSchema = BaseNodeDataSchema.extend({
    type: z.literal("text"),
    text: z.string(),
    width: z.number().optional(),
    height: z.number().optional(),
});

export const ImageDataSchema = BaseNodeDataSchema.extend({
    type: z.literal("image"),
    prompt: z.string(),
    images: z.array(z.string()),
    aspectRatio: ImageDataAspectRatioSchema,
    model: ImageDataModelSchema,
    resolution: ImageDataResolutionSchema,
    width: z.number().optional(),
    height: z.number().optional(),
});

export const VideoDataSchema = BaseNodeDataSchema.extend({
    type: z.literal("video"),
    prompt: z.string(),
    images: z.array(z.string()),
    firstFrame: z.string().optional(),
    lastFrame: z.string().optional(),
    videoUrl: z.string().optional(),
    aspectRatio: AspectRatio169_916Schema,
    duration: z.union([z.literal(4), z.literal(6), z.literal(8)]),
    model: z.enum([
        MODELS.VIDEO.VEO_3_1_FAST_PREVIEW,
        MODELS.VIDEO.VEO_3_1_PRO_PREVIEW,
    ]),
    generateAudio: z.boolean(),
    resolution: z.enum(["720p", "1080p"]),
    width: z.number().optional(),
    height: z.number().optional(),
});

export const FileDataSchema = BaseNodeDataSchema.extend({
    type: z.literal("file"),
    fileType: z.enum(["image", "video"]).nullable(),
    fileUrl: z.string(),
    fileName: z.string(),
    gcsUri: z.string().optional(),
});

export const UpscaleDataSchema = BaseNodeDataSchema.extend({
    type: z.literal("upscale"),
    image: z.string(),
    upscaleFactor: z.enum(["x2", "x3", "x4"]),
    width: z.number().optional(),
    height: z.number().optional(),
});

export const ResizeDataSchema = BaseNodeDataSchema.extend({
    type: z.literal("resize"),
    image: z.string().optional(),
    aspectRatio: AspectRatio169_916Schema,
    output: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
});

export const NodeDataSchema = z.discriminatedUnion("type", [
    AgentDataSchema,
    TextDataSchema,
    ImageDataSchema,
    VideoDataSchema,
    FileDataSchema,
    UpscaleDataSchema,
    ResizeDataSchema,
]);

export const NodeSchema = z.object({
    id: z.string(),
    type: z.string(),
    position: z.object({
        x: z.number(),
        y: z.number(),
    }),
    data: NodeDataSchema,
});

export const EdgeSchema = z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string().optional().nullable(),
    targetHandle: z.string().optional().nullable(),
});

// --- API Schemas ---

export const GenerateImageSchema = z.object({
    prompt: z.string().min(1, "Prompt is required"),
    images: z.array(z.string()).optional().default([]),
    aspectRatio: ImageDataAspectRatioSchema.optional().default(
        DEFAULTS.ASPECT_RATIO,
    ),
    model: ImageDataModelSchema.optional().default(
        MODELS.IMAGE.GEMINI_3_PRO_IMAGE_PREVIEW,
    ),
    resolution: ImageDataResolutionSchema.optional().default(
        DEFAULTS.IMAGE_RESOLUTION,
    ),
});

export const GenerateTextSchema = z.object({
    prompt: z.string().min(1, "Prompt is required"),
    files: z
        .array(
            z.object({
                url: z.string(),
                type: z.string(),
            }),
        )
        .optional()
        .default([]),
    model: z.string().optional().default(MODELS.TEXT.GEMINI_3_FLASH_PREVIEW),
});

export const GenerateVideoSchema = z.object({
    prompt: z.string().min(1, "Prompt is required"),
    firstFrame: z.string().optional(),
    lastFrame: z.string().optional(),
    images: z.array(z.string()).optional().default([]),
    aspectRatio: AspectRatio169_916Schema.optional().default(
        DEFAULTS.ASPECT_RATIO,
    ),
    duration: z
        .union([z.literal(4), z.literal(6), z.literal(8)])
        .optional()
        .default(DEFAULTS.VIDEO_DURATION),
    model: z
        .enum([
            MODELS.VIDEO.VEO_3_1_FAST_PREVIEW,
            MODELS.VIDEO.VEO_3_1_PRO_PREVIEW,
        ])
        .optional()
        .default(MODELS.VIDEO.VEO_3_1_FAST_PREVIEW),
    generateAudio: z.boolean().optional().default(true),
    resolution: z.enum(["720p", "1080p"]).optional().default("720p"),
});

export const ResizeImageSchema = z.object({
    image: z.string().min(1, "Image is required"),
    aspectRatio: AspectRatio169_916Schema,
});

export const UpscaleImageSchema = z.object({
    image: z.string().min(1, "Image is required"),
    upscaleFactor: z.enum(["x2", "x3", "x4"]).optional().default("x2"),
});

export const GetSignedUrlSchema = z.object({
    gcsUri: z.string().min(1, "gcsUri is required"),
});

export const FlowCreateSchema = z.object({
    name: z.string().min(1, "Name is required"),
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
});

export const FlowUpdateSchema = z.object({
    name: z.string().optional(),
    nodes: z.array(NodeSchema).optional(),
    edges: z.array(EdgeSchema).optional(),
    thumbnail: z.string().optional(),
});

// --- Infer Types ---

export type GenerateImageRequest = z.infer<typeof GenerateImageSchema>;
export type GenerateTextRequest = z.infer<typeof GenerateTextSchema>;
export type GenerateVideoRequest = z.infer<typeof GenerateVideoSchema>;
export type ResizeImageRequest = z.infer<typeof ResizeImageSchema>;
export type UpscaleImageRequest = z.infer<typeof UpscaleImageSchema>;
export type GetSignedUrlRequest = z.infer<typeof GetSignedUrlSchema>;
export type FlowCreateRequest = z.infer<typeof FlowCreateSchema>;
export type FlowUpdateRequest = z.infer<typeof FlowUpdateSchema>;

export type AgentData = z.infer<typeof AgentDataSchema>;
export type TextData = z.infer<typeof TextDataSchema>;
export type ImageData = z.infer<typeof ImageDataSchema>;
export type VideoData = z.infer<typeof VideoDataSchema>;
export type FileData = z.infer<typeof FileDataSchema>;
export type UpscaleData = z.infer<typeof UpscaleDataSchema>;
export type ResizeData = z.infer<typeof ResizeDataSchema>;
export type NodeData = z.infer<typeof NodeDataSchema>;
