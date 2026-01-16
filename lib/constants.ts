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
        IMAGEN_4_0_UPSCALE: "imagen-4.0-upscale-preview",
    },
    VIDEO: {
        VEO_3_1_FAST_PREVIEW: "veo-3.1-fast-generate-preview",
        VEO_3_1_PRO_PREVIEW: "veo-3.1-generate-preview",
    },
} as const;

export const DEFAULTS = {
    ASPECT_RATIO: "16:9",
    VIDEO_DURATION: 4,
    IMAGE_RESOLUTION: "1K",
} as const;

export const COLLECTIONS = {
    FLOWS: "flows",
} as const;
