import { describe, it, expect, vi, beforeEach } from "vitest";
import { PromptEngineer } from "@/lib/canvas/agent/prompt-engineer";
import { geminiService } from "@/lib/services/gemini.service";
import type { GenerationStep } from "@/lib/canvas/types";
import path from "path";

vi.mock("@/lib/services/gemini.service", () => ({
    geminiService: {
        generateText: vi.fn(),
    },
}));

describe("PromptEngineer with vox-collage reference", () => {
    let engineer: PromptEngineer;

    beforeEach(() => {
        vi.clearAllMocks();
        const skillsDir = path.join(
            process.cwd(),
            "src/lib/canvas/agent/skills/primitives",
        );
        engineer = new PromptEngineer(skillsDir);
    });

    it("includes vox-collage.md reference in PromptEngineer request for image steps", async () => {
        vi.mocked(geminiService.generateText).mockResolvedValue(
            "[GENERAL DESCRIPTION]\nA paper collage poster...\n\n[STRUCTURED FEATURES]\nSUBJECT: Merchants...",
        );

        const step: GenerationStep = {
            id: "step-1",
            type: "image",
            prompt: "VOX PAPER COLLAGE KEYFRAME POSTER: Ancient merchants trading grain, headline 'BEFORE MONEY', American Retro 1950s style",
        };

        const result = await engineer.engineerPrompt(step, []);

        expect(geminiService.generateText).toHaveBeenCalledTimes(1);
        const callArgs = vi.mocked(geminiService.generateText).mock.calls[0][0];
        const sentPrompt = callArgs.prompts?.[0] ?? "";

        // Verify vox-collage.md content is injected in skill specification
        expect(sentPrompt).toContain("vox-collage");
        expect(sentPrompt).toContain(
            "Special Case: Vox Paper-Collage Keyframe Posters",
        );
        expect(result).toContain("[GENERAL DESCRIPTION]");
    });

    it("loads t2s/SKILL.md (not music-generation) for steps with operation 't2s'", async () => {
        vi.mocked(geminiService.generateText).mockResolvedValue(
            "Narration script for ancient trade routes.",
        );

        const speechStep: GenerationStep = {
            id: "step-speech",
            type: "audio",
            operation: "t2s",
            prompt: "Narrate the history of trade in the Roman Empire",
            voice: "Charon",
        };

        const result = await engineer.engineerPrompt(speechStep, []);

        expect(geminiService.generateText).toHaveBeenCalledTimes(1);
        const callArgs = vi.mocked(geminiService.generateText).mock.calls[0][0];
        const sentPrompt = callArgs.prompts?.[0] ?? "";

        // Must load t2s SKILL.md specification
        expect(sentPrompt).toContain("name: t2s");
        expect(sentPrompt).toContain("Text-to-speech generation");
        expect(sentPrompt).toContain("gemini-3.1-flash-tts-preview");
        expect(result).toBe("Narration script for ancient trade routes.");
    });
});
