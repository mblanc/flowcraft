import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/config", () => ({
    config: { PROJECT_ID: "test-project", LOCATION: "global" },
}));

vi.mock("@/app/logger", () => ({
    default: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

const mockGenerateContent = vi.fn();

vi.mock("@google/genai", () => ({
    GoogleGenAI: vi.fn().mockImplementation(function (
        this: { _opts?: unknown; models?: unknown; operations?: unknown },
        opts: unknown,
    ) {
        this._opts = opts;
        this.models = { generateContent: mockGenerateContent };
        this.operations = { get: vi.fn() };
    }),
    ThinkingLevel: { LOW: "LOW" },
    createPartFromText: vi.fn((t: string) => ({ text: t })),
    createPartFromUri: vi.fn(),
    createPartFromBase64: vi.fn(),
}));

import { GeminiService } from "@/lib/services/gemini.service";

function makeResponse(parts: unknown[]) {
    return { candidates: [{ content: { parts } }] };
}

describe("GeminiService.generateMusic", () => {
    let service: GeminiService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new GeminiService();
    });

    it("calls generateContent with responseModalities AUDIO", async () => {
        mockGenerateContent.mockResolvedValue(
            makeResponse([
                { inlineData: { data: "abc==", mimeType: "audio/wav" } },
            ]),
        );

        await service.generateMusic({ prompt: "epic theme" });

        expect(mockGenerateContent).toHaveBeenCalledWith(
            expect.objectContaining({
                model: "lyria-3-clip-preview",
                config: expect.objectContaining({
                    responseModalities: ["AUDIO", "TEXT"],
                }),
            }),
        );
    });

    it("uses global when LOCATION is global", async () => {
        mockGenerateContent.mockResolvedValue(
            makeResponse([
                { inlineData: { data: "abc==", mimeType: "audio/wav" } },
            ]),
        );

        const { GoogleGenAI } = await import("@google/genai");
        await service.generateMusic({ prompt: "jazz" });

        // The GoogleGenAI instance must use global
        const instances = vi.mocked(GoogleGenAI).mock
            .instances as unknown as Array<{ _opts?: { location?: string } }>;
        const instance = instances.find((i) => i._opts?.location === "global");
        expect(instance).toBeDefined();
    });

    it("returns audioData and mimeType on valid response", async () => {
        mockGenerateContent.mockResolvedValue(
            makeResponse([
                {
                    inlineData: {
                        data: "base64audio==",
                        mimeType: "audio/mp3",
                    },
                },
            ]),
        );

        const result = await service.generateMusic({ prompt: "calm jazz" });

        expect(result).toEqual({
            audioData: "base64audio==",
            mimeType: "audio/mp3",
        });
    });

    it("defaults mimeType to audio/wav when absent", async () => {
        mockGenerateContent.mockResolvedValue(
            makeResponse([{ inlineData: { data: "abc==" } }]),
        );

        const result = await service.generateMusic({ prompt: "calm jazz" });
        expect(result.mimeType).toBe("audio/wav");
    });

    it("passes prompt as contents", async () => {
        mockGenerateContent.mockResolvedValue(
            makeResponse([
                { inlineData: { data: "abc==", mimeType: "audio/wav" } },
            ]),
        );

        await service.generateMusic({ prompt: "jazz" });

        const call = mockGenerateContent.mock.calls[0][0];
        expect(call.contents).toBe("jazz");
    });

    it("throws when no inlineData part is returned", async () => {
        mockGenerateContent.mockResolvedValue(
            makeResponse([{ text: "some text, no audio" }]),
        );

        await expect(service.generateMusic({ prompt: "jazz" })).rejects.toThrow(
            "No audio data in Lyria response",
        );
    });

    it("throws when candidates array is empty", async () => {
        mockGenerateContent.mockResolvedValue({ candidates: [] });

        await expect(service.generateMusic({ prompt: "jazz" })).rejects.toThrow(
            "No audio data in Lyria response",
        );
    });
});
