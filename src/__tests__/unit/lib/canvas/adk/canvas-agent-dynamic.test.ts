import { describe, it, expect, vi, beforeEach } from "vitest";
import { CanvasAgent } from "@/lib/canvas/agent/canvas-agent";
import type { UserSkillDocument } from "@/lib/canvas/agent/skills/skill-types";
import { MODELS } from "@/lib/constants";

vi.mock("@/lib/config", () => ({
    config: { PROJECT_ID: "test-project", LOCATION: "us-central1" },
}));

vi.mock("@/app/logger", () => ({
    default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("CanvasAgent — Dynamic User Skills", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockUserSkills: UserSkillDocument[] = [
        {
            id: "brand-campaign",
            userId: "user-1",
            name: "brand-campaign",
            description: "Generate a 3-shot brand campaign workflow",
            instructions:
                "### Phase 1: Hero Shot\nCreate hero shot first\n\n### Phase 2: Lifestyle Shots\nAdd 2 lifestyle shots with brand logo",
            visibility: "private",
            sharedWith: [],
            sharedWithEmails: [],
            isTemplate: false,
            createdAt: "2026-06-25T12:00:00Z",
            updatedAt: "2026-06-25T12:00:00Z",
        },
        {
            id: "cinematic-teaser",
            userId: "user-1",
            name: "cinematic-teaser",
            description: "Generate a cinematic movie teaser",
            instructions: "### Teaser Scene\nCreate dramatic scene",
            visibility: "public",
            sharedWith: [],
            sharedWithEmails: [],
            isTemplate: true,
            createdAt: "2026-06-25T12:00:00Z",
            updatedAt: "2026-06-25T12:00:00Z",
        },
    ];

    it("should build the agent and load built-in skills when no user skills are provided", async () => {
        const agent = new CanvasAgent();
        const llmAgent = await agent.build(
            MODELS.TEXT.GEMINI_3_5_FLASH,
            "test instruction",
            [],
            [],
        );

        expect(llmAgent.name).toBe("Director");

        // Find SkillToolset in tools
        const skillToolset = (llmAgent.tools as unknown[]).find(
            (t) => (t as { skills?: unknown }).skills !== undefined,
        ) as {
            skills: Record<
                string,
                {
                    frontmatter: {
                        name: string;
                        description: string;
                        metadata?: Record<string, unknown>;
                    };
                    instructions: string;
                }
            >;
        };
        expect(skillToolset).toBeDefined();

        // Built-in skills should be present (e.g. character-generation, storyboard, etc.)
        expect(Object.keys(skillToolset.skills).length).toBeGreaterThanOrEqual(
            4,
        );
        expect(skillToolset.skills["character-generation"]).toBeDefined();
    });

    it("should merge user skills into the SkillToolset dynamically", async () => {
        const agent = new CanvasAgent();
        const llmAgent = await agent.build(
            MODELS.TEXT.GEMINI_3_5_FLASH,
            "test instruction",
            mockUserSkills,
            [],
        );

        const skillToolset = (llmAgent.tools as unknown[]).find(
            (t) => (t as { skills?: unknown }).skills !== undefined,
        ) as {
            skills: Record<
                string,
                {
                    frontmatter: {
                        name: string;
                        description: string;
                        metadata?: Record<string, unknown>;
                    };
                    instructions: string;
                }
            >;
        };
        expect(skillToolset).toBeDefined();

        // Should have built-ins AND our user skills
        expect(skillToolset.skills["brand-campaign"]).toBeDefined();
        expect(skillToolset.skills["cinematic-teaser"]).toBeDefined();

        // Check frontmatter and instruction formatting of user skill
        const brandCampaign = skillToolset.skills["brand-campaign"];
        expect(brandCampaign.frontmatter.name).toBe("brand-campaign");
        expect(brandCampaign.frontmatter.description).toBe(
            "Generate a 3-shot brand campaign workflow",
        );
        expect(brandCampaign.frontmatter.metadata!.userCreated).toBe(true);

        expect(brandCampaign.instructions).toBe(
            "### Phase 1: Hero Shot\nCreate hero shot first\n\n### Phase 2: Lifestyle Shots\nAdd 2 lifestyle shots with brand logo",
        );
    });

    it("should filter out disabled skills (both built-in and user-created)", async () => {
        const agent = new CanvasAgent();

        // Disable "character-generation" (built-in) and "cinematic-teaser" (user-created)
        const disabledSkills = ["character-generation", "cinematic-teaser"];

        const llmAgent = await agent.build(
            MODELS.TEXT.GEMINI_3_5_FLASH,
            "test instruction",
            mockUserSkills,
            disabledSkills,
        );

        const skillToolset = (llmAgent.tools as unknown[]).find(
            (t) => (t as { skills?: unknown }).skills !== undefined,
        ) as {
            skills: Record<
                string,
                {
                    frontmatter: {
                        name: string;
                        description: string;
                        metadata?: Record<string, unknown>;
                    };
                    instructions: string;
                }
            >;
        };
        expect(skillToolset).toBeDefined();

        // brand-campaign should be enabled (present)
        expect(skillToolset.skills["brand-campaign"]).toBeDefined();

        // cinematic-teaser and character-generation should be disabled (filtered out)
        expect(skillToolset.skills["cinematic-teaser"]).toBeUndefined();
        expect(skillToolset.skills["character-generation"]).toBeUndefined();
    });
});
