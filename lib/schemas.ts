import { z } from "zod";

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
    "gemini-2.5-flash-image",
    "gemini-3-pro-image-preview",
    "imagen-4.0-generate-001",
    "imagen-4.0-fast-generate-001",
    "imagen-4.0-ultra-generate-001",
]);

const ImageDataResolutionSchema = z.enum(["1K", "2K", "4K"]);

// --- API Schemas ---

export const GenerateImageSchema = z.object({
    prompt: z.string().min(1, "Prompt is required"),
    images: z.array(z.string()).optional().default([]),
    aspectRatio: ImageDataAspectRatioSchema.optional().default("16:9"),
    model: ImageDataModelSchema.optional().default("gemini-2.5-flash-image"),
    resolution: ImageDataResolutionSchema.optional().default("1K"),
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
    model: z.string().optional().default("gemini-2.0-flash-exp"),
});

export const GenerateVideoSchema = z.object({
    prompt: z.string().min(1, "Prompt is required"),
    firstFrame: z.string().optional(),
    lastFrame: z.string().optional(),
    images: z.array(z.string()).optional().default([]),
    aspectRatio: AspectRatio169_916Schema.optional().default("16:9"),
    duration: z
        .union([z.literal(4), z.literal(6), z.literal(8)])
        .optional()
        .default(4),
    model: z
        .enum(["veo-3.1-fast-generate-preview", "veo-3.1-generate-preview"])
        .optional()
        .default("veo-3.1-fast-generate-preview"),
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
