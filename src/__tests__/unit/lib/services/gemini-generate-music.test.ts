import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockGetAccessToken } = vi.hoisted(() => ({
    mockGetAccessToken: vi.fn(),
}));

vi.mock("google-auth-library", () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    GoogleAuth: vi.fn().mockImplementation(function (this: any) {
        this.getClient = vi.fn().mockResolvedValue({
            getAccessToken: mockGetAccessToken,
        });
    }),
}));

vi.mock("@/lib/config", () => ({
    config: { PROJECT_ID: "test-project", LOCATION: "us-central1" },
}));

vi.mock("@/app/logger", () => ({
    default: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

vi.mock("@google/genai", () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    GoogleGenAI: vi.fn().mockImplementation(function (this: any) {
        this.models = { generateContent: vi.fn() };
        this.operations = { get: vi.fn() };
    }),
    ThinkingLevel: { LOW: "LOW" },
}));

import { GeminiService } from "@/lib/services/gemini.service";

describe("GeminiService.generateMusic", () => {
    let geminiService: GeminiService;
    const mockFetch = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAccessToken.mockResolvedValue({ token: "test-token" });
        vi.stubGlobal("fetch", mockFetch);
        geminiService = new GeminiService();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    function okFetch(predictions: unknown[]) {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ predictions }),
        });
    }

    it("returns audioData and mimeType on a valid Lyria response", async () => {
        okFetch([
            { bytesBase64Encoded: "base64audio==", mimeType: "audio/wav" },
        ]);

        const result = await geminiService.generateMusic({
            prompt: "calm jazz",
        });
        expect(result).toEqual({
            audioData: "base64audio==",
            mimeType: "audio/wav",
        });
    });

    it("defaults mimeType to audio/wav when absent in response", async () => {
        okFetch([{ bytesBase64Encoded: "base64audio==" }]);

        const result = await geminiService.generateMusic({
            prompt: "calm jazz",
        });
        expect(result.mimeType).toBe("audio/wav");
    });

    it("throws when getAccessToken returns null", async () => {
        mockGetAccessToken.mockResolvedValue({ token: null });

        await expect(
            geminiService.generateMusic({ prompt: "calm jazz" }),
        ).rejects.toThrow("Failed to get Google access token");
    });

    it("throws with status and body when Lyria response is not ok", async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 429,
            text: async () => '{"error":{"message":"Quota exceeded"}}',
        });

        await expect(
            geminiService.generateMusic({ prompt: "calm jazz" }),
        ).rejects.toThrow("Lyria API error 429");
    });

    it("throws when predictions array is empty", async () => {
        okFetch([]);

        await expect(
            geminiService.generateMusic({ prompt: "calm jazz" }),
        ).rejects.toThrow("No audio data in Lyria response");
    });

    it("throws when bytesBase64Encoded is absent", async () => {
        okFetch([{ mimeType: "audio/wav" }]);

        await expect(
            geminiService.generateMusic({ prompt: "calm jazz" }),
        ).rejects.toThrow("No audio data in Lyria response");
    });

    it("includes negativePrompt and seed in request body when provided", async () => {
        okFetch([{ bytesBase64Encoded: "abc", mimeType: "audio/wav" }]);

        await geminiService.generateMusic({
            prompt: "calm jazz",
            negativePrompt: "loud",
            seed: 42,
        });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.instances[0].negative_prompt).toBe("loud");
        expect(body.instances[0].seed).toBe(42);
    });

    it("omits negativePrompt and seed when not provided", async () => {
        okFetch([{ bytesBase64Encoded: "abc", mimeType: "audio/wav" }]);

        await geminiService.generateMusic({ prompt: "calm jazz" });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.instances[0]).not.toHaveProperty("negative_prompt");
        expect(body.instances[0]).not.toHaveProperty("seed");
    });
});
