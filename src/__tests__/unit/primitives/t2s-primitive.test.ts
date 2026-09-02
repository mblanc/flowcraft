import { describe, it, expect, vi, beforeEach } from "vitest";
import { t2sPrimitive } from "@/primitives/t2s/definition";
import { t2sExecute } from "@/primitives/t2s/execute";
import { registry } from "@/primitives/registry";
import { serverRegistry } from "@/primitives/server-registry";
import { geminiService } from "@/lib/services/gemini.service";
import { storageService } from "@/lib/services/storage.service";
import { MODELS } from "@/lib/constants";
import type { GenerationStep } from "@/lib/canvas/types";

vi.mock("@/lib/services/gemini.service", () => ({
    geminiService: {
        generateSpeech: vi.fn(),
    },
}));

vi.mock("@/lib/services/storage.service", () => ({
    storageService: {
        uploadFile: vi.fn(),
    },
}));

describe("t2s primitive", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("is registered in client and server registries", () => {
        expect(registry.get("t2s")).toBeDefined();
        expect(registry.getByCanvasType("canvas-t2s")).toBeDefined();
        expect(serverRegistry.get("t2s")).toBeDefined();
    });

    it("validates request schema bounds (rejects empty or oversized script prompt)", () => {
        const schema = t2sPrimitive.requestSchema!;
        expect(() => schema.parse({ prompt: "" })).toThrow();
        expect(() => schema.parse({ prompt: "a".repeat(5001) })).toThrow();
        expect(schema.parse({ prompt: "Valid narration text" })).toEqual({
            prompt: "Valid narration text",
            model: MODELS.AUDIO.GEMINI_3_1_FLASH_TTS_PREVIEW,
        });
    });

    it("maps flow node gatherInputs from edge output or fallback node data", () => {
        const node = {
            id: "node-1",
            data: { prompt: "Default prompt", model: "model-1" },
        };

        // Test fallback to node data
        const fallbackInputs = t2sPrimitive.flow!.gatherInputs(
            node,
            [],
            () => null,
        );
        expect(fallbackInputs).toEqual({
            prompt: "Default prompt",
            model: "model-1",
        });

        // Test resolving prompt from upstream edge source
        const edge = {
            source: "node-0",
            sourceHandle: "out",
            target: "node-1",
            targetHandle: "prompt-input",
        };
        const edgeInputs = t2sPrimitive.flow!.gatherInputs(
            node,
            [edge],
            (srcId) =>
                srcId === "node-0" ? { text: "Upstream script text" } : null,
        );
        expect(edgeInputs.prompt).toBe("Upstream script text");
    });

    it("maps canvas step and execution result to CanvasAudioData accurately", () => {
        const step: GenerationStep = {
            id: "step-1",
            type: "audio",
            prompt: "Hello, this is a narration.",
            voice: "Puck",
            label: "Intro Narration",
            operation: "t2s",
            planNodeId: "plan-node-1",
        };

        const req = t2sPrimitive.canvas!.toRequest(step, {
            userId: "user-123",
        });
        expect(req).toEqual({
            prompt: "Hello, this is a narration.",
            voice: "Puck",
            model: MODELS.AUDIO.GEMINI_3_1_FLASH_TTS_PREVIEW,
        });

        const canvasData = t2sPrimitive.canvas!.toCanvasData(step, {
            audioUrl: "gs://bucket/audio.wav",
            mimeType: "audio/wav",
        });

        expect(canvasData).toEqual({
            type: "canvas-audio",
            label: "Intro Narration",
            sourceUrl: "gs://bucket/audio.wav",
            mimeType: "audio/wav",
            prompt: "Hello, this is a narration.",
            voice: "Puck",
            model: undefined,
            status: "ready",
            operation: "t2s",
            planNodeId: "plan-node-1",
            derivedFrom: undefined,
        });
    });

    it("executes t2s audio synthesis and uploads result to GCS", async () => {
        vi.mocked(geminiService.generateSpeech).mockResolvedValue({
            audioData: "base64audiobytes",
            mimeType: "audio/wav",
        });

        vi.mocked(storageService.uploadFile).mockResolvedValue(
            "gs://test-bucket/speech-123.wav",
        );

        const result = await t2sExecute(
            {
                prompt: "Welcome to the Vox paper collage explainer.",
                voice: "Puck",
                model: MODELS.AUDIO.GEMINI_3_1_FLASH_TTS_PREVIEW,
            },
            { userId: "user-123" },
        );

        expect(geminiService.generateSpeech).toHaveBeenCalledWith({
            prompt: "Welcome to the Vox paper collage explainer.",
            voice: "Puck",
            model: MODELS.AUDIO.GEMINI_3_1_FLASH_TTS_PREVIEW,
        });

        expect(storageService.uploadFile).toHaveBeenCalledWith(
            expect.any(Buffer),
            expect.stringMatching(/^speech-.*\.wav$/),
            "audio/wav",
        );

        expect(result).toEqual({
            audioUrl: "gs://test-bucket/speech-123.wav",
            mimeType: "audio/wav",
        });
    });

    it("sanitizes MIME types with parameters and derives correct extensions", async () => {
        vi.mocked(geminiService.generateSpeech).mockResolvedValue({
            audioData: "base64audiobytes",
            mimeType: "audio/mpeg; codecs=mp3",
        });

        vi.mocked(storageService.uploadFile).mockResolvedValue(
            "gs://test-bucket/speech-123.mp3",
        );

        const result = await t2sExecute(
            { prompt: "Testing mp3 extension" },
            { userId: "user-123" },
        );

        expect(storageService.uploadFile).toHaveBeenCalledWith(
            expect.any(Buffer),
            expect.stringMatching(/^speech-.*\.mp3$/),
            "audio/mpeg",
        );
        expect(result.mimeType).toBe("audio/mpeg");
    });

    it("converts raw audio/l16 PCM into playable RIFF WAV audio", async () => {
        const fakePcm = Buffer.from("12345678901234567890", "utf-8").toString(
            "base64",
        );
        vi.mocked(geminiService.generateSpeech).mockResolvedValue({
            audioData: fakePcm,
            mimeType: "audio/l16; rate=24000; channels=1",
        });

        vi.mocked(storageService.uploadFile).mockResolvedValue(
            "gs://test-bucket/speech-pcm.wav",
        );

        const result = await t2sExecute(
            { prompt: "PCM test" },
            { userId: "user-123" },
        );

        expect(storageService.uploadFile).toHaveBeenCalledWith(
            expect.any(Buffer),
            expect.stringMatching(/^speech-.*\.wav$/),
            "audio/wav",
        );
        expect(result.mimeType).toBe("audio/wav");

        // Verify standard RIFF header bytes in uploaded buffer
        const uploadedBuffer = vi.mocked(storageService.uploadFile).mock
            .calls[0][0] as Buffer;
        expect(uploadedBuffer.subarray(0, 4).toString()).toBe("RIFF");
        expect(uploadedBuffer.subarray(8, 12).toString()).toBe("WAVE");
        expect(uploadedBuffer.subarray(12, 16).toString()).toBe("fmt ");
        expect(uploadedBuffer.subarray(36, 40).toString()).toBe("data");
    });
});
