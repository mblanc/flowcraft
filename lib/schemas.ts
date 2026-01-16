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
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
});

export const FlowUpdateSchema = z.object({
    name: z.string().optional(),
    nodes: z.array(z.any()).optional(),
    edges: z.array(z.any()).optional(),
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
