import { describe, it, expect, vi } from "vitest";
import type { PlanNode } from "../lib/canvas/types";
import {
    parseLlmResponse,
    runPromptEngineer,
} from "../lib/canvas/adk/prompt-engineer";

async function* emptyGen() {}

vi.mock("@google/adk", async () => {
    const actual =
        await vi.importActual<typeof import("@google/adk")>("@google/adk");
    return {
        ...actual,
        LlmAgent: vi.fn().mockImplementation(() => ({})),
        Runner: vi.fn().mockImplementation(() => ({
            runAsync: vi.fn(() => emptyGen()),
        })),
        Gemini: vi.fn().mockImplementation(() => ({})),
        InMemorySessionService: vi.fn().mockImplementation(() => ({
            createSession: vi.fn().mockResolvedValue(undefined),
        })),
    };
});

vi.mock("@/lib/config", () => ({
    config: { PROJECT_ID: "test-project", LOCATION: "us-central1" },
}));

vi.mock("@/app/logger", () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const baseNode: PlanNode = {
    id: "node_0",
    operation: "t2i",
    promptIntent: "a golden retriever puppy playing in a sunlit meadow",
    label: "Puppy",
    aspectRatio: "16:9",
};

describe("parseLlmResponse", () => {
    const node: PlanNode = {
        id: "node_0",
        operation: "t2i",
        promptIntent: "a golden retriever puppy",
    };

    it("extracts prompt and negativePrompt from valid JSON", () => {
        const raw = JSON.stringify({
            prompt: "A golden retriever puppy, photorealistic, 85mm",
            negativePrompt: "cartoon, illustration",
        });
        const result = parseLlmResponse(raw, node);
        expect(result.prompt).toBe(
            "A golden retriever puppy, photorealistic, 85mm",
        );
        expect(result.negativePrompt).toBe("cartoon, illustration");
    });

    it("strips markdown code fences before parsing", () => {
        const raw = "```json\n" + JSON.stringify({ prompt: "A cat" }) + "\n```";
        const result = parseLlmResponse(raw, node);
        expect(result.prompt).toBe("A cat");
    });

    it("falls back to promptIntent on invalid JSON", () => {
        const result = parseLlmResponse("not json at all", node);
        expect(result.prompt).toBe(node.promptIntent);
    });

    it("falls back to promptIntent when prompt field is missing", () => {
        const result = parseLlmResponse(
            JSON.stringify({ negativePrompt: "x" }),
            node,
        );
        expect(result.prompt).toBe(node.promptIntent);
    });
});

describe("runPromptEngineer", () => {
    it("falls back to promptIntent when LLM returns empty response", async () => {
        const result = await runPromptEngineer(baseNode, undefined, null);
        expect(result.prompt).toBe(baseNode.promptIntent);
    });

    it("returns a prompt string and resolvedParams", async () => {
        const result = await runPromptEngineer(baseNode, undefined, null);
        expect(typeof result.prompt).toBe("string");
        expect(result.prompt.length).toBeGreaterThan(0);
        expect(result).toHaveProperty("resolvedParams");
    });

    it("resolvedParams carries node fields", async () => {
        const result = await runPromptEngineer(baseNode, undefined, null);
        expect(result.resolvedParams.aspectRatio).toBe("16:9");
    });

    it("does not throw when node has no optional fields", async () => {
        const minimal: PlanNode = {
            id: "node_1",
            operation: "t2i",
            promptIntent: "a simple test",
        };
        await expect(
            runPromptEngineer(minimal, undefined, null),
        ).resolves.toBeDefined();
    });
});
