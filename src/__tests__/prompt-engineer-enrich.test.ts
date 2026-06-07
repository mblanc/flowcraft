import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GenerationStep } from "../lib/canvas/types";

// Mock the prompt engineer before importing the module under test
vi.mock("../lib/canvas/adk/prompt-engineer", () => ({
    runPromptEngineer: vi.fn().mockResolvedValue({
        prompt: "enriched prompt from PE",
        resolvedParams: {},
    }),
}));

vi.mock("@google/adk", async () => {
    const actual =
        await vi.importActual<typeof import("@google/adk")>("@google/adk");
    return {
        ...actual,
        loadAllSkillsInDir: vi.fn().mockResolvedValue({}),
    };
});

vi.mock("@/app/logger", () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("enrichPlanSteps", () => {
    const step1: GenerationStep = {
        id: "s1",
        type: "image",
        prompt: "a cat",
        label: "Cat",
    };
    const step2: GenerationStep = {
        id: "s2",
        type: "video",
        prompt: "a dog running",
        label: "Dog",
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("replaces prompt with PromptEngineer output for each step", async () => {
        const { enrichPlanSteps } =
            await import("../lib/canvas/adk/prompt-engineer-enrich");
        const result = await enrichPlanSteps([step1, step2], {}, null);
        expect(result[0].prompt).toBe("enriched prompt from PE");
        expect(result[1].prompt).toBe("enriched prompt from PE");
    });

    it("returns original step if PromptEngineer throws", async () => {
        const { runPromptEngineer } =
            await import("../lib/canvas/adk/prompt-engineer");
        vi.mocked(runPromptEngineer).mockRejectedValueOnce(
            new Error("PE failed"),
        );

        const { enrichPlanSteps } =
            await import("../lib/canvas/adk/prompt-engineer-enrich");
        const result = await enrichPlanSteps([step1], {}, null);
        expect(result[0].prompt).toBe("a cat");
    });

    it("passes aspectRatio and duration to PromptEngineer", async () => {
        const { runPromptEngineer } =
            await import("../lib/canvas/adk/prompt-engineer");
        const { enrichPlanSteps } =
            await import("../lib/canvas/adk/prompt-engineer-enrich");

        const richStep: GenerationStep = {
            id: "s3",
            type: "video",
            prompt: "a sunset",
            label: "Sunset",
            aspectRatio: "16:9",
            duration: 6,
        };
        await enrichPlanSteps([richStep], {}, null);

        expect(runPromptEngineer).toHaveBeenCalledWith(
            expect.objectContaining({ aspectRatio: "16:9", duration: 6 }),
            undefined,
            null,
        );
    });

    it("passes matching skill to PromptEngineer for image steps", async () => {
        const { runPromptEngineer } =
            await import("../lib/canvas/adk/prompt-engineer");
        const { enrichPlanSteps } =
            await import("../lib/canvas/adk/prompt-engineer-enrich");

        const mockSkill = { frontmatter: { name: "t2i", description: "Test" } };
        const skills = { t2i: mockSkill };
        await enrichPlanSteps([step1], skills as never, null);

        expect(runPromptEngineer).toHaveBeenCalledWith(
            expect.objectContaining({ operation: "t2i" }),
            mockSkill,
            null,
        );
    });
});
