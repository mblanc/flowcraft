import { describe, it, expect, vi, beforeEach } from "vitest";
import { CanvasAgentRunner } from "@/lib/canvas/agent/agent-runner";
import { CanvasAgent } from "@/lib/canvas/agent/canvas-agent";
import { skillService } from "@/lib/services/skill.service";
import type { AgentInput, AgentEvent } from "@/lib/canvas/types";
import type { Event } from "@google/adk";

// Mock dependencies
vi.mock("@/lib/config", () => ({
    config: { PROJECT_ID: "test-project", LOCATION: "us-central1" },
}));

vi.mock("@/app/logger", () => ({
    default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/services/skill.service", () => ({
    skillService: {
        listSkills: vi.fn(),
    },
}));

vi.mock("@google/adk", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@google/adk")>();

    class MockRunner {
        runAsync(): AsyncGenerator<Event> {
            return (async function* () {
                yield {
                    id: "evt_done",
                    invocationId: "inv_new",
                    timestamp: Date.now(),
                    actions: { stateDelta: {}, artifactDelta: {} },
                    author: "Director",
                    content: {
                        role: "model",
                        parts: [{ text: "Understood." }],
                    },
                    turnComplete: true,
                } as Event;
            })();
        }
    }

    return {
        ...actual,
        Runner: MockRunner,
        loadAllSkillsInDir: vi.fn().mockResolvedValue({
            "character-generation": {
                frontmatter: {
                    name: "character-generation",
                    description: "Character reference sheet",
                },
                instructions: "Built-in character gen steps",
            },
            storyboard: {
                frontmatter: {
                    name: "storyboard",
                    description: "Storyboard visual director",
                },
                instructions: "Built-in storyboard steps",
            },
        }),
        createSessionService: vi.fn().mockReturnValue({
            getOrCreateSession: vi.fn().mockResolvedValue({ events: [] }),
            appendEvent: vi.fn(),
        }),
    };
});

describe("CanvasAgentRunner — Slash Commands Interception", () => {
    let runner: CanvasAgentRunner;
    let buildSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock listSkills to return a custom user skill
        vi.mocked(skillService.listSkills).mockResolvedValue([
            {
                id: "custom-brand-skill",
                userId: "user-1",
                name: "custom-brand-skill",
                description: "Brand campaign creator",
                triggerHints: ["brand promotion"],
                phases: [{ title: "Shot 1", rules: "Logo top-right" }],
                visibility: "private",
                sharedWith: [],
                sharedWithEmails: [],
                isTemplate: false,
                createdAt: "2026-06-25T12:00:00Z",
                updatedAt: "2026-06-25T12:00:00Z",
            },
        ]);

        runner = new CanvasAgentRunner();
        buildSpy = vi.spyOn(CanvasAgent.prototype, "build");
    });

    async function collectEvents(
        generator: AsyncGenerator<AgentEvent>,
    ): Promise<AgentEvent[]> {
        const events: AgentEvent[] = [];
        for await (const event of generator) {
            events.push(event);
        }
        return events;
    }

    it("should intercept /skills and list all built-in and user-defined skills with correct toggle states", async () => {
        const input: AgentInput = {
            message: "/skills",
            mode: "auto",
            history: [],
            canvasNodes: [],
            userId: "user-1",
            disabledSkills: ["character-generation", "custom-brand-skill"], // disable one built-in and one custom
        };

        const events = await collectEvents(runner.stream(input));

        // Bypasses ADK LLM build
        expect(buildSpy).not.toHaveBeenCalled();

        // Check text event output
        const textEvent = events.find((e) => e.type === "text") as {
            type: "text";
            delta: string;
        };
        expect(textEvent).toBeDefined();

        const content = textEvent.delta;
        expect(content).toContain("Here are the available pattern skills");

        // Check built-in skill presence and its toggle status
        expect(content).toContain("character-generation");
        expect(content).toContain("❌ [Disabled]"); // disabled in input

        expect(content).toContain("storyboard");
        expect(content).toContain("✅ [Enabled]"); // default enabled

        // Check user skill presence and its toggle status
        expect(content).toContain("custom-brand-skill");
        expect(content).toContain("❌ [Disabled]"); // disabled in input

        const doneEvent = events.find((e) => e.type === "done");
        expect(doneEvent).toBeDefined();
    });

    it("should intercept /[skill-name], strip prefix, and force execution on a valid enabled skill", async () => {
        const input: AgentInput = {
            message: "/character-generation a cool sci-fi character",
            mode: "auto",
            history: [],
            canvasNodes: [],
            userId: "user-1",
            disabledSkills: [],
        };

        // We run stream, collecting events (it will resolve instantly because Runner is mocked to return empty generator)
        await collectEvents(runner.stream(input));

        // It should build the agent
        expect(buildSpy).toHaveBeenCalled();

        const [, instruction, ,] = buildSpy.mock.calls[0];

        // Should force execution of the specified skill
        expect(instruction).toContain(
            "CRITICAL: The user has explicitly forced the use of the skill: 'character-generation'",
        );
        expect(instruction).toContain("You MUST invoke this skill immediately");

        // The prompt passed inside input (though modified in place or sent to ADK) should be stripped
        expect(input.message).toBe("a cool sci-fi character");
    });

    it("should strip prefix and assign default prompt if only /[skill-name] is typed with no prompt", async () => {
        const input: AgentInput = {
            message: "/custom-brand-skill",
            mode: "auto",
            history: [],
            canvasNodes: [],
            userId: "user-1",
            disabledSkills: [],
        };

        await collectEvents(runner.stream(input));

        expect(buildSpy).toHaveBeenCalled();
        const [, instruction, ,] = buildSpy.mock.calls[0];

        expect(instruction).toContain(
            "CRITICAL: The user has explicitly forced the use of the skill: 'custom-brand-skill'",
        );
        expect(input.message).toBe("Run the custom-brand-skill skill.");
    });

    it("should yield an error and done when forcing a disabled skill", async () => {
        const input: AgentInput = {
            message: "/custom-brand-skill a brand poster",
            mode: "auto",
            history: [],
            canvasNodes: [],
            userId: "user-1",
            disabledSkills: ["custom-brand-skill"], // disabled
        };

        const events = await collectEvents(runner.stream(input));

        // Should NOT build agent
        expect(buildSpy).not.toHaveBeenCalled();

        // Check error event
        const errorEvent = events.find((e) => e.type === "error") as {
            type: "error";
            message: string;
        };
        expect(errorEvent).toBeDefined();
        expect(errorEvent.message).toContain(
            "is currently disabled on this canvas",
        );

        const doneEvent = events.find((e) => e.type === "done");
        expect(doneEvent).toBeDefined();
    });

    it("should yield an error and done when typing an unknown slash command", async () => {
        const input: AgentInput = {
            message: "/unknown-slash-command a simple request",
            mode: "auto",
            history: [],
            canvasNodes: [],
            userId: "user-1",
            disabledSkills: [],
        };

        const events = await collectEvents(runner.stream(input));

        // Should NOT build agent
        expect(buildSpy).not.toHaveBeenCalled();

        // Check error event
        const errorEvent = events.find((e) => e.type === "error") as {
            type: "error";
            message: string;
        };
        expect(errorEvent).toBeDefined();
        expect(errorEvent.message).toContain(
            "Unknown command '/unknown-slash-command'",
        );

        const doneEvent = events.find((e) => e.type === "done");
        expect(doneEvent).toBeDefined();
    });
});
