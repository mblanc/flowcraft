/**
 * Application-wide constants
 */

export const MODELS = {
    TEXT: {
        GEMINI_3_1_PRO_PREVIEW: "gemini-3.1-pro-preview",
        GEMINI_3_5_FLASH: "gemini-3.5-flash",
        GEMINI_3_1_FLASH_LITE: "gemini-3.1-flash-lite",
    },
    IMAGE: {
        GEMINI_2_5_FLASH_IMAGE: "gemini-2.5-flash-image",
        GEMINI_3_PRO_IMAGE: "gemini-3-pro-image",
        GEMINI_3_1_FLASH_IMAGE: "gemini-3.1-flash-image",
        IMAGEN_4_0_UPSCALE: "imagen-4.0-upscale-preview",
    },
    VIDEO: {
        VEO_3_1_LITE: "veo-3.1-lite-generate-001",
        VEO_3_1_FAST: "veo-3.1-fast-generate-001",
        VEO_3_1_PRO: "veo-3.1-generate-001",
    },
    MUSIC: {
        LYRIA_3_CLIP: "lyria-3-clip-preview",
        LYRIA_3_PRO: "lyria-3-pro-preview",
    },
} as const;

export const MODEL_THINKING_LEVELS: Record<string, string[]> = {
    [MODELS.TEXT.GEMINI_3_1_PRO_PREVIEW]: ["LOW", "MEDIUM", "HIGH"],
    [MODELS.TEXT.GEMINI_3_1_FLASH_LITE]: ["MINIMAL", "LOW", "MEDIUM", "HIGH"],
    [MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE]: ["MINIMAL", "HIGH"],
    [MODELS.TEXT.GEMINI_3_5_FLASH]: ["MINIMAL", "LOW", "MEDIUM", "HIGH"],
};

export const IMAGE_MODEL_CONFIGS = {
    [MODELS.IMAGE.GEMINI_2_5_FLASH_IMAGE]: {
        ratios: [
            "Auto",
            "1:1",
            "3:2",
            "2:3",
            "3:4",
            "4:3",
            "4:5",
            "5:4",
            "9:16",
            "16:9",
            "21:9",
        ],
        imageSizes: ["1K"],
        grounding: { google: true, image: false },
    },
    [MODELS.IMAGE.GEMINI_3_PRO_IMAGE]: {
        ratios: [
            "Auto",
            "1:1",
            "3:2",
            "2:3",
            "3:4",
            "4:3",
            "4:5",
            "5:4",
            "9:16",
            "16:9",
            "21:9",
        ],
        imageSizes: ["1K", "2K", "4K"],
        grounding: { google: true, image: false },
    },
    [MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE]: {
        ratios: [
            "Auto",
            "1:1",
            "1:4",
            "1:8",
            "3:2",
            "2:3",
            "3:4",
            "4:1",
            "4:3",
            "4:5",
            "5:4",
            "8:1",
            "9:16",
            "16:9",
            "21:9",
        ],
        imageSizes: ["512", "1K", "2K", "4K"],
        grounding: { google: true, image: true },
    },
} as const;

export const IMAGE_SIZES = ["512", "1K", "2K", "4K"] as const;
export const VIDEO_RESOLUTIONS = ["720p", "1080p", "4K"] as const;

export const BATCH_CONCURRENCY = 3;

export const DEFAULTS = {
    ASPECT_RATIO: "16:9",
    IMAGE_ASPECT_RATIO: "Auto",
    VIDEO_DURATION: 4,
    IMAGE_RESOLUTION: "1K",
} as const;

export const COLLECTIONS = {
    FLOWS: "flows",
    CUSTOM_NODES: "custom_nodes",
    CANVASES: "canvases",
    LIBRARY_ASSETS: "library_assets",
    STYLES: "styles",
    USER_SKILLS: "user_skills",
} as const;

export const SUPPORTED_MIME_TYPES = {
    TEXT: [
        "text/plain",
        "text/html",
        "text/css",
        "text/javascript",
        "application/x-javascript",
        "text/vtt",
        "text/markdown",
        "text/x-python",
        "text/x-typescript",
        "application/json",
    ],
    IMAGE: [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/heic",
        "image/heif",
    ],
    AUDIO: [
        "audio/wav",
        "audio/mp3",
        "audio/aiff",
        "audio/aac",
        "audio/ogg",
        "audio/flac",
    ],
    VIDEO: [
        "video/mp4",
        "video/mpeg",
        "video/mov",
        "video/avi",
        "video/x-flv",
        "video/mpg",
        "video/webm",
        "video/wmv",
        "video/3gpp",
    ],
    PDF: ["application/pdf"],
} as const;

export const ALL_SUPPORTED_MIME_TYPES = [
    ...SUPPORTED_MIME_TYPES.TEXT,
    ...SUPPORTED_MIME_TYPES.IMAGE,
    ...SUPPORTED_MIME_TYPES.AUDIO,
    ...SUPPORTED_MIME_TYPES.VIDEO,
    ...SUPPORTED_MIME_TYPES.PDF,
] as const;

export type SupportedMimeType = (typeof ALL_SUPPORTED_MIME_TYPES)[number];
