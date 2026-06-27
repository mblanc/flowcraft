/**
 * Integration test for GeminiService.generateMusic against the real Lyria API.
 *
 * Run:
 *   bun run test:eval -- music-generation
 *
 * Requires Google ADC credentials and PROJECT_ID env var.
 * Skipped automatically when PROJECT_ID is not set.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/config", () => ({
    config: {
        PROJECT_ID: process.env.PROJECT_ID ?? "",
        LOCATION: process.env.LOCATION ?? "global",
        GCS_STORAGE_URI: process.env.GCS_STORAGE_URI ?? "",
    },
}));

vi.mock("@/app/logger", () => ({
    default: {
        info: console.info.bind(console),
        debug: () => {},
        warn: console.warn.bind(console),
        error: console.error.bind(console),
    },
}));

import { GeminiService } from "../../lib/services/gemini.service";

const hasCredentials = !!process.env.PROJECT_ID;

describe.runIf(hasCredentials)(
    "GeminiService.generateMusic — integration",
    () => {
        const service = new GeminiService();

        it(
            "returns base64 audio data for a simple prompt",
            { timeout: 60_000 },
            async () => {
                const result = await service.generateMusic({
                    prompt: "A short upbeat acoustic guitar melody, 10 seconds",
                });

                expect(result.audioData).toBeTruthy();
                expect(typeof result.audioData).toBe("string");
                // Verify it's valid base64
                expect(() =>
                    Buffer.from(result.audioData, "base64"),
                ).not.toThrow();
                expect(result.mimeType).toMatch(/^audio\//);

                console.log(
                    `✓ Received ${Buffer.from(result.audioData, "base64").length} bytes of audio (${result.mimeType})`,
                );
            },
        );

        it(
            "generates music with descriptive prompt",
            { timeout: 60_000 },
            async () => {
                const result = await service.generateMusic({
                    prompt: "Calm ambient piano music, no drums, no percussion",
                });

                expect(result.audioData).toBeTruthy();
                expect(result.mimeType).toMatch(/^audio\//);
            },
        );
    },
);
