/**
 * Integration test for GeminiService.generateSpeech against real Gemini API.
 *
 * Run:
 *   bun run test:eval -- speech-generation
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/config", () => ({
    config: {
        PROJECT_ID: process.env.PROJECT_ID ?? "",
        LOCATION: process.env.LOCATION ?? "us-central1",
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
    "GeminiService.generateSpeech — integration",
    () => {
        const service = new GeminiService();

        it(
            "generates speech audio data for default voice",
            { timeout: 30_000 },
            async () => {
                const result = await service.generateSpeech({
                    prompt: "Hello, welcome to Flowcraft. This is a text to speech test.",
                });

                expect(result.audioData).toBeTruthy();
                expect(typeof result.audioData).toBe("string");
                expect(() =>
                    Buffer.from(result.audioData, "base64"),
                ).not.toThrow();
                expect(result.mimeType).toMatch(/^audio\//);

                console.log(
                    `✓ Received ${Buffer.from(result.audioData, "base64").length} bytes of speech audio (${result.mimeType})`,
                );
            },
        );

        const voices = ["Puck", "Charon", "Kore", "Fenrir", "Aoede"];
        for (const voice of voices) {
            it(
                `generates speech audio data with prebuilt voice ${voice}`,
                { timeout: 30_000 },
                async () => {
                    const result = await service.generateSpeech({
                        prompt: "Ancient Rome was defined by trade, law, and conquest.",
                        voice,
                    });

                    expect(result.audioData).toBeTruthy();
                    expect(typeof result.audioData).toBe("string");
                    expect(result.mimeType).toMatch(/^audio\//);

                    console.log(
                        `✓ Voice ${voice}: Received ${Buffer.from(result.audioData, "base64").length} bytes (${result.mimeType})`,
                    );
                },
            );
        }
    },
);
