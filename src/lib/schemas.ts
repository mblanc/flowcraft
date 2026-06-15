import { z } from "zod";
import { MODELS, DEFAULTS } from "./constants";

// --- Legacy Model Migration ---
// Maps old preview model strings to their GA equivalents for backward compatibility
// with flows stored in Firestore before the model rename.
const LEGACY_VIDEO_MODEL_MAP: Record<string, string> = {
    "veo-3.1-fast-generate-preview": MODELS.VIDEO.VEO_3_1_FAST,
    "veo-3.1-generate-preview": MODELS.VIDEO.VEO_3_1_PRO,
};

function migrateVideoModel(val: unknown): unknown {
    if (typeof val === "string" && val in LEGACY_VIDEO_MODEL_MAP) {
        return LEGACY_VIDEO_MODEL_MAP[val];
    }
    return val;
}

// --- Shared Types ---

const AspectRatio169_916Schema = z.enum(["16:9", "9:16"]);

const MediaRefSchema = z.object({
    url: z.string(),
    type: z.string(),
});

const NamedNodeInputSchema = z.object({
    nodeId: z.string(),
    name: z.string(),
    textValue: z.string().nullable(),
    textValues: z.array(z.string()).optional(),
    fileValues: z.array(MediaRefSchema),
    fileValuesList: z.array(z.array(MediaRefSchema)).optional(),
});

const ImageDataAspectRatioSchema = z.enum([
    "Auto",
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
    "1:4",
    "1:8",
    "4:1",
    "8:1",
]);

const ImageDataModelSchema = z.enum([
    MODELS.IMAGE.GEMINI_2_5_FLASH_IMAGE,
    MODELS.IMAGE.GEMINI_3_PRO_IMAGE,
    MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE,
]);

const ImageDataSizeSchema = z.enum(["512", "1K", "2K", "4K"]);

// --- Node Data Schemas ---

export const BaseNodeDataSchema = z.object({
    name: z.string(),
    executing: z.boolean().optional(),
    generatedAt: z.number().optional(),
    error: z.string().optional(),
    batchTotal: z.number().optional(),
    batchProgress: z.number().optional(),
    resolvedPrompt: z.string().optional(),
});

export const LLMDataSchema = BaseNodeDataSchema.extend({
    type: z.literal("llm"),
    model: z.string(),
    instructions: z.string(),
    output: z.string().optional(),
    outputs: z.array(z.string()).optional(),
    outputType: z.enum(["text", "json"]).default("text"),
    responseSchema: z.string().optional(), // JSON string for now
    strictMode: z.boolean().default(false),
    width: z.number().optional(),
    height: z.number().optional(),
    visualSchema: z
        .array(
            z.object({
                name: z.string(),
                type: z.enum(["string", "number", "boolean", "array"]),
                description: z.string().optional(),
                required: z.boolean().default(true),
            }),
        )
        .optional(),
    thinkingLevel: z.string().optional(),
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
    imageSize: ImageDataSizeSchema,
    groundingGoogleSearch: z.boolean().default(false),
    groundingImageSearch: z.boolean().default(false),
    width: z.number().optional(),
    height: z.number().optional(),
    mediaInputs: z
        .array(z.object({ url: z.string(), mimeType: z.string().optional() }))
        .optional(),
    thinkingLevel: z.string().optional(),
});

export const VideoDataSchema = BaseNodeDataSchema.extend({
    type: z.literal("video"),
    prompt: z.string(),
    images: z.array(z.string()),
    firstFrame: z.string().optional(),
    lastFrame: z.string().optional(),
    videoUrl: z.string().optional(),
    videoUrls: z.array(z.string()).optional(),
    aspectRatio: AspectRatio169_916Schema,
    duration: z.union([z.literal(4), z.literal(6), z.literal(8)]),
    model: z.preprocess(
        migrateVideoModel,
        z.enum([
            MODELS.VIDEO.VEO_3_1_LITE,
            MODELS.VIDEO.VEO_3_1_FAST,
            MODELS.VIDEO.VEO_3_1_PRO,
        ]),
    ),
    generateAudio: z.boolean(),
    resolution: z.enum(["720p", "1080p", "4K"]),
    width: z.number().optional(),
    height: z.number().optional(),
    mediaInputs: z
        .array(z.object({ url: z.string(), mimeType: z.string().optional() }))
        .optional(),
});

export const FileDataSchema = BaseNodeDataSchema.extend({
    type: z.literal("file"),
    fileType: z.enum(["image", "video", "pdf"]).nullable(),
    fileUrl: z.string(),
    fileName: z.string().max(255),
    gcsUri: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
});

export const UpscaleDataSchema = BaseNodeDataSchema.extend({
    type: z.literal("upscale"),
    image: z.string(),
    images: z.array(z.string()).optional(),
    upscaleFactor: z.enum(["x2", "x3", "x4"]),
    width: z.number().optional(),
    height: z.number().optional(),
});

export const ResizeDataSchema = BaseNodeDataSchema.extend({
    type: z.literal("resize"),
    image: z.string().optional(),
    aspectRatio: AspectRatio169_916Schema,
    output: z.string().optional(),
    outputs: z.array(z.string()).optional(),
    width: z.number().optional(),
    height: z.number().optional(),
});

export const WorkflowInputDataSchema = BaseNodeDataSchema.extend({
    type: z.literal("workflow-input"),
    portName: z.string(),
    portType: z.enum(["text", "image", "video"]),
    portRequired: z.boolean().default(true),
    portDefaultValue: z
        .union([z.string(), z.number(), z.boolean(), z.null()])
        .optional(),
});

export const WorkflowOutputDataSchema = BaseNodeDataSchema.extend({
    type: z.literal("workflow-output"),
    portName: z.string(),
    portType: z.enum(["text", "image", "video"]),
});

export const ListDataSchema = BaseNodeDataSchema.extend({
    type: z.literal("list"),
    itemType: z.enum(["text", "image"]),
    items: z.array(z.string()),
    width: z.number().optional(),
    height: z.number().optional(),
});

export const CustomWorkflowDataSchema = BaseNodeDataSchema.extend({
    type: z.literal("custom-workflow"),
    subWorkflowId: z.string(),
    inputs: z.record(z.string(), z.string()).optional(),
    outputs: z.record(z.string(), z.string()).optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    results: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});

export const RouterDataSchema = BaseNodeDataSchema.extend({
    type: z.literal("router"),
    value: z.unknown().optional(),
    valueMediaType: z.enum(["image", "video", "pdf"]).optional(),
});

export const MusicDataSchema = BaseNodeDataSchema.extend({
    type: z.literal("music"),
    prompt: z.string().default(""),
    model: z
        .enum(["lyria-3-clip-preview", "lyria-3-pro-preview"])
        .optional()
        .default("lyria-3-clip-preview"),
    audioUrl: z.string().optional(),
    mimeType: z.string().optional(),
});

export const NodeDataSchema = z.discriminatedUnion("type", [
    LLMDataSchema,
    TextDataSchema,
    ImageDataSchema,
    VideoDataSchema,
    FileDataSchema,
    UpscaleDataSchema,
    ResizeDataSchema,
    ListDataSchema,
    WorkflowInputDataSchema,
    WorkflowOutputDataSchema,
    CustomWorkflowDataSchema,
    RouterDataSchema,
    MusicDataSchema,
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

export const ContentPartSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("text"), text: z.string() }),
    z.object({
        kind: z.literal("uri"),
        uri: z.string(),
        mimeType: z.string(),
    }),
    z.object({
        kind: z.literal("base64"),
        data: z.string(),
        mimeType: z.string(),
    }),
]);

export const GenerateImageSchema = z
    .object({
        prompt: z.string().optional().default(""),
        parts: z.array(ContentPartSchema).optional(),
        images: z
            .array(
                z.object({
                    url: z.string(),
                    type: z.string(),
                }),
            )
            .optional()
            .default([]),
        aspectRatio: ImageDataAspectRatioSchema.optional().default(
            DEFAULTS.IMAGE_ASPECT_RATIO,
        ),
        model: ImageDataModelSchema.optional().default(
            MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE,
        ),
        imageSize: ImageDataSizeSchema.optional().default(
            DEFAULTS.IMAGE_RESOLUTION,
        ),
        groundingGoogleSearch: z.boolean().optional().default(false),
        groundingImageSearch: z.boolean().optional().default(false),
        thinkingLevel: z.string().optional(),
        namedNodes: z.array(NamedNodeInputSchema).optional(),
    })
    .superRefine((data, ctx) => {
        const hasParts = data.parts && data.parts.length > 0;
        const hasPrompt = data.prompt && data.prompt.length > 0;
        if (!hasParts && !hasPrompt) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Either prompt or parts must be provided",
                path: ["prompt"],
            });
        }
    });

export const GenerateTextSchema = z
    .object({
        instructions: z.string().optional(),
        namedNodes: z.array(NamedNodeInputSchema).optional(),
        prompts: z.array(z.string()).optional().default([]),
        parts: z.array(ContentPartSchema).optional(),
        files: z
            .array(
                z.object({
                    url: z.string(),
                    type: z.string(),
                }),
            )
            .optional()
            .default([]),
        model: z.string().optional().default(MODELS.TEXT.GEMINI_3_5_FLASH),
        outputType: z.enum(["text", "json"]).optional().default("text"),
        responseSchema: z.string().optional(),
        strictMode: z.boolean().optional().default(false),
        thinkingLevel: z.string().optional(),
    })
    .superRefine((data, ctx) => {
        const hasParts = data.parts && data.parts.length > 0;
        const hasPrompts = data.prompts && data.prompts.length > 0;
        if (!hasParts && !hasPrompts) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Either prompts or parts must be provided",
                path: ["prompts"],
            });
        }
    });

export const GenerateVideoSchema = z.object({
    prompt: z.string().min(1, "Prompt is required"),
    firstFrame: z.string().optional(),
    lastFrame: z.string().optional(),
    images: z
        .array(
            z.object({
                url: z.string(),
                type: z.string(),
            }),
        )
        .optional()
        .default([]),
    aspectRatio: AspectRatio169_916Schema.optional().default(
        DEFAULTS.ASPECT_RATIO,
    ),
    duration: z
        .union([z.literal(4), z.literal(6), z.literal(8)])
        .optional()
        .default(DEFAULTS.VIDEO_DURATION),
    model: z.preprocess(
        migrateVideoModel,
        z
            .enum([
                MODELS.VIDEO.VEO_3_1_LITE,
                MODELS.VIDEO.VEO_3_1_FAST,
                MODELS.VIDEO.VEO_3_1_PRO,
            ])
            .optional()
            .default(MODELS.VIDEO.VEO_3_1_LITE),
    ),
    generateAudio: z.boolean().optional().default(true),
    resolution: z.enum(["720p", "1080p", "4K"]).optional().default("720p"),
    namedNodes: z.array(NamedNodeInputSchema).optional(),
});

export const ResizeImageSchema = z.object({
    image: z.string().min(1, "Image is required"),
    aspectRatio: AspectRatio169_916Schema,
    namedNodes: z.array(NamedNodeInputSchema).optional(),
});

export const UpscaleImageSchema = z.object({
    image: z.string().min(1, "Image is required"),
    upscaleFactor: z.enum(["x2", "x3", "x4"]).optional().default("x2"),
    namedNodes: z.array(NamedNodeInputSchema).optional(),
});

export const FlowCreateSchema = z.object({
    name: z.string().min(1, "Name is required"),
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
});

export const FlowImportSchema = FlowCreateSchema.extend({
    name: z.string().optional(),
});

export const FlowUpdateSchema = z.object({
    name: z.string().optional(),
    nodes: z.array(NodeSchema).optional(),
    edges: z.array(EdgeSchema).optional(),
    thumbnail: z.string().url().max(2048).optional(),
    visibility: z.enum(["private", "public", "restricted"]).optional(),
    isTemplate: z.boolean().optional(),
    sharedWith: z
        .array(
            z.object({
                email: z.string().email(),
                role: z.enum(["view", "edit"]),
            }),
        )
        .optional(),
});

export const FlowShareSchema = z.object({
    visibility: z.enum(["private", "public", "restricted"]).optional(),
    sharedWith: z
        .array(
            z.object({
                email: z.string().email(),
                role: z.enum(["view", "edit"]),
            }),
        )
        .optional(),
});

const SharedWithSchema = z.array(
    z.object({
        email: z.string().email(),
        role: z.enum(["view", "edit"]),
    }),
);

export const CanvasSharingPatchSchema = z.object({
    visibility: z.enum(["private", "public"]).optional(),
    sharedWith: SharedWithSchema.optional(),
    isTemplate: z.boolean().optional(),
});

export const CanvasUpdateSchema = z.object({
    name: z.string().optional(),
    nodes: z.array(z.unknown()).optional(),
    viewport: z
        .object({ x: z.number(), y: z.number(), zoom: z.number() })
        .optional(),
    messages: z.array(z.unknown()).optional(),
    thumbnail: z.string().url().max(2048).optional(),
    activeStyleId: z.string().nullable().optional(),
    visibility: z.enum(["private", "public"]).optional(),
    sharedWith: SharedWithSchema.optional(),
    isTemplate: z.boolean().optional(),
});

export const StyleSharingPatchSchema = z.object({
    visibility: z.enum(["private", "public"]).optional(),
    sharedWith: SharedWithSchema.optional(),
    isTemplate: z.boolean().optional(),
});

export const StyleUpdateSchema = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    content: z.string().optional(),
    referenceImageUris: z.array(z.string()).optional(),
    visibility: z.enum(["private", "public"]).optional(),
    sharedWith: SharedWithSchema.optional(),
    isTemplate: z.boolean().optional(),
});

export const AssetSharingPatchSchema = z
    .object({
        visibility: z.enum(["private", "public"]),
    })
    .strict();

// --- Custom Node Schemas ---

export const CustomNodePortSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
});

export const CustomNodeCreateSchema = z.object({
    name: z.string().min(1, "Name is required"),
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
});

export const CustomNodeUpdateSchema = z.object({
    name: z.string().optional(),
    nodes: z.array(NodeSchema).optional(),
    edges: z.array(EdgeSchema).optional(),
    thumbnail: z.string().url().max(2048).optional(),
});

// --- Infer Types ---

export type GenerateImageRequest = z.infer<typeof GenerateImageSchema>;
export type GenerateTextRequest = z.infer<typeof GenerateTextSchema>;
export type GenerateVideoRequest = z.infer<typeof GenerateVideoSchema>;
export type ResizeImageRequest = z.infer<typeof ResizeImageSchema>;
export type UpscaleImageRequest = z.infer<typeof UpscaleImageSchema>;
export type FlowCreateRequest = z.infer<typeof FlowCreateSchema>;
export type FlowUpdateRequest = z.infer<typeof FlowUpdateSchema>;
export type CustomNodeCreateRequest = z.infer<typeof CustomNodeCreateSchema>;
export type CustomNodeUpdateRequest = z.infer<typeof CustomNodeUpdateSchema>;

export type PersistedNode = z.infer<typeof NodeSchema>;
export type PersistedEdge = z.infer<typeof EdgeSchema>;

export type LLMData = z.infer<typeof LLMDataSchema>;
export type TextData = z.infer<typeof TextDataSchema>;
export type ImageData = z.infer<typeof ImageDataSchema>;
export type VideoData = z.infer<typeof VideoDataSchema>;
export type FileData = z.infer<typeof FileDataSchema>;
export type UpscaleData = z.infer<typeof UpscaleDataSchema>;
export type ResizeData = z.infer<typeof ResizeDataSchema>;
export type ListData = z.infer<typeof ListDataSchema>;
export type WorkflowInputData = z.infer<typeof WorkflowInputDataSchema>;
export type WorkflowOutputData = z.infer<typeof WorkflowOutputDataSchema>;
export type CustomWorkflowData = z.infer<typeof CustomWorkflowDataSchema>;
export type RouterData = z.infer<typeof RouterDataSchema>;
export type MusicData = z.infer<typeof MusicDataSchema>;
export type NodeData = z.infer<typeof NodeDataSchema>;
export type CanvasSharingPatch = z.infer<typeof CanvasSharingPatchSchema>;
export type CanvasUpdate = z.infer<typeof CanvasUpdateSchema>;
export type StyleSharingPatch = z.infer<typeof StyleSharingPatchSchema>;
export type StyleUpdate = z.infer<typeof StyleUpdateSchema>;
export type AssetSharingPatch = z.infer<typeof AssetSharingPatchSchema>;
