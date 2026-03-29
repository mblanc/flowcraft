/**
 * Application-wide constants
 */

export const MODELS = {
    TEXT: {
        GEMINI_3_PRO_PREVIEW: "gemini-3-pro-preview",
        GEMINI_3_FLASH_PREVIEW: "gemini-3-flash-preview",
        GEMINI_2_5_FLASH: "gemini-2.5-flash",
        GEMINI_2_5_PRO: "gemini-2.5-pro",
        GEMINI_2_5_FLASH_LITE: "gemini-2.5-flash-lite",
    },
    IMAGE: {
        GEMINI_2_5_FLASH_IMAGE: "gemini-2.5-flash-image",
        GEMINI_3_PRO_IMAGE_PREVIEW: "gemini-3-pro-image-preview",
        GEMINI_3_1_FLASH_IMAGE_PREVIEW: "gemini-3.1-flash-image-preview",
        IMAGEN_4_0_UPSCALE: "imagen-4.0-upscale-preview",
    },
    VIDEO: {
        VEO_3_1_FAST_PREVIEW: "veo-3.1-fast-generate-preview",
        VEO_3_1_PRO_PREVIEW: "veo-3.1-generate-preview",
    },
} as const;

export const IMAGE_MODEL_CONFIGS = {
    [MODELS.IMAGE.GEMINI_2_5_FLASH_IMAGE]: {
        ratios: [
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
        resolutions: ["1K"],
        grounding: { google: true, image: false },
    },
    [MODELS.IMAGE.GEMINI_3_PRO_IMAGE_PREVIEW]: {
        ratios: [
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
        resolutions: ["1K", "2K", "4K"],
        grounding: { google: true, image: false },
    },
    [MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE_PREVIEW]: {
        ratios: [
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
        resolutions: ["512", "1K", "2K", "4K"],
        grounding: { google: true, image: true },
    },
} as const;

export const BATCH_CONCURRENCY = 3;

export const DEFAULTS = {
    ASPECT_RATIO: "16:9",
    VIDEO_DURATION: 4,
    IMAGE_RESOLUTION: "1K",
} as const;

export const COLLECTIONS = {
    FLOWS: "flows",
    CUSTOM_NODES: "custom_nodes",
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
