import { describe, it, expect, vi } from "vitest";
import { LLMDataSchema } from "../lib/schemas";
import { LLMNode } from "../components/llm-node";
import { migrateNodes } from "../lib/migration";
import { executeLLMNode } from "../lib/executors";
import { Node } from "@xyflow/react";
import { LLMData } from "../lib/types";

describe("LLMNode Refactoring", () => {
    it("should have LLMDataSchema defined", () => {
        expect(LLMDataSchema).toBeDefined();
    });

    it("should have LLMNode component defined", () => {
        expect(LLMNode).toBeDefined();
    });

    it("LLMDataSchema should validate correct data", () => {
        const validData = {
            name: "Test LLM",
            type: "llm",
            model: "gemini-2.0-flash",
            instructions: "Be helpful",
            outputType: "json",
            responseSchema: "{}",
        };
        const result = LLMDataSchema.safeParse(validData);
        expect(result.success).toBe(true);
    });

    it("LLMDataSchema should have default outputType as text", () => {
        const data = {
            name: "Test LLM",
            type: "llm",
            model: "gemini-2.0-flash",
            instructions: "Be helpful",
        };
        const result = LLMDataSchema.parse(data);
        expect(result.outputType).toBe("text");
    });

    it("migrateNodes should migrate agent type to llm", () => {
        const oldNodes = [
            {
                id: "1",
                type: "agent",
                data: {
                    type: "agent",
                    name: "Old Agent",
                    model: "gemini-pro",
                    instructions: "test",
                },
                position: { x: 0, y: 0 },
            },
        ];
        const migratedNodes = migrateNodes(oldNodes);
        expect(migratedNodes[0].type).toBe("llm");
        expect(migratedNodes[0].data.type).toBe("llm");
        expect(migratedNodes[0].data.name).toBe("Old Agent");
    });

    it("executeLLMNode should handle JSON output type and stringify it", async () => {
        const mockNode = {
            id: "test-node",
            data: {
                type: "llm",
                name: "Test LLM",
                model: "gemini-pro",
                instructions: "Generate list",
                outputType: "json",
                responseSchema: JSON.stringify({
                    type: "object",
                    properties: {
                        items: { type: "array", items: { type: "string" } },
                    },
                }),
            } as LLMData,
        } as Node<LLMData>;

        const mockInputs = { prompt: "test prompt" };

        // Mock fetch
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ text: { items: ["a", "b"] } }),
        });

        const result = await executeLLMNode(mockNode, mockInputs, {
            fetch: mockFetch as unknown as typeof fetch,
        });

        expect(mockFetch).toHaveBeenCalledWith(
            "/api/generate-text",
            expect.objectContaining({
                method: "POST",
                body: expect.stringContaining('"outputType":"json"'),
            }),
        );

        // Should be stringified JSON
        expect(typeof result.output).toBe("string");
        expect(JSON.parse(result.output!)).toEqual({ items: ["a", "b"] });
    });
});
