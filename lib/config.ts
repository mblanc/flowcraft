import { z } from "zod";

const envSchema = z.object({
    PROJECT_ID: z.string().min(1, "PROJECT_ID is required"),
    LOCATION: z.string().default("global"),
    GCS_STORAGE_URI: z
        .string()
        .startsWith("gs://", "GCS_STORAGE_URI must start with gs://"),
    FIRESTORE_DATABASE_ID: z.string().optional(),
    AUTH_GOOGLE_ID: z.string().min(1, "AUTH_GOOGLE_ID is required"),
    AUTH_GOOGLE_SECRET: z.string().min(1, "AUTH_GOOGLE_SECRET is required"),
    LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
    ADMIN_EMAILS: z.string().default(""), // Comma-separated list
});

const _env = envSchema.safeParse({
    PROJECT_ID: process.env.PROJECT_ID,
    LOCATION: process.env.LOCATION,
    GCS_STORAGE_URI: process.env.GCS_STORAGE_URI,
    FIRESTORE_DATABASE_ID: process.env.FIRESTORE_DATABASE_ID,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    LOG_LEVEL: process.env.LOG_LEVEL,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
});

const isBuildTime =
    process.env.SKIP_ENV_VALIDATION === "1" || process.env.NODE_ENV === "test";

if (!_env.success) {
    if (isBuildTime) {
        console.warn(
            "⚠️  Skipping environment variable validation during build/test.",
        );
    } else {
        console.error("❌ Invalid environment variables:", _env.error.format());
        throw new Error("Invalid environment variables");
    }
}

export const config = _env.success
    ? _env.data
    : ({} as z.infer<typeof envSchema>);
