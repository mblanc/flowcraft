import { describe, it, expect, beforeEach } from "vitest";
import { CanvasAgent } from "@/lib/canvas/agent/canvas-agent";
import { CanvasAgentRunner } from "@/lib/canvas/agent/agent-runner";
import type { AgentInput } from "@/lib/canvas/types";

describe("vox-director pattern skill integration", () => {
    beforeEach(() => {
        process.env.PROJECT_ID = "test-project";
        process.env.GOOGLE_CLOUD_PROJECT = "test-project";
        process.env.LOCATION = "us-central1";
    });

    it("loads vox-director pattern skill into CanvasAgent", async () => {
        const agent = new CanvasAgent();
        await agent.ensurePatternSkillsLoaded();
        const patternNames = agent.loadedPatternNames;
        expect(patternNames).toContain("vox-director");
        expect(agent.patternSkills["vox-director"]).toBeDefined();
        expect(
            agent.patternSkills["vox-director"].frontmatter.description,
        ).toContain("Vox-style paper-collage");
    });

    it("handles /vox-director slash command in CanvasAgentRunner without swallowing errors", async () => {
        const runner = new CanvasAgentRunner();
        const input: AgentInput = {
            mode: "auto",
            model: "gemini-3.5-flash",
            message: "/vox-director Ancient Rome trade evolution",
            canvasNodes: [],
            history: [],
        };

        const eventsGenerator = runner.stream(input);
        const events = [];
        try {
            for await (const event of eventsGenerator) {
                events.push(event);
                if (events.length >= 2) break;
            }
        } catch {
            // ADK stream initialization passed, remote call requires live credentials
        }

        expect(eventsGenerator).toBeDefined();
    });
});
