/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { toNodeDefinition } from "@/primitives/node-adapters";
import { Primitive } from "@/primitives/types";
import { z } from "zod";

describe("toNodeDefinition Adapter", () => {
    const mockPrimitive: Primitive<any, any, any, any> = {
        id: "test-primitive",
        label: "Test Primitive",
        mediaType: "image",
        requestSchema: z.object({ prompt: z.string() }),
        outputShape: z.object({ url: z.string() }),
        execute: async () => ({ url: "http://example.com" }),
        flow: {
            type: "flow-test",
            inputs: { input: "text" },
            outputs: { output: "image" },
            gatherInputs: () => ({ prompt: "test" }),
            mergeResults: (results) => results[0] || {},
            saveToLibrary: async () => {},
        },
        canvas: null,
        agent: null,
    };

    it("should correctly convert a Primitive to a NodeDefinition", () => {
        const nodeDef = toNodeDefinition(mockPrimitive);
        expect(nodeDef).toBeDefined();
        expect(nodeDef.type).toBe("flow-test");
        expect(nodeDef.inputs).toEqual({ input: "text" });
        expect(nodeDef.outputs).toEqual({ output: "image" });
        expect(nodeDef.gatherInputs).toBeDefined();
        expect(nodeDef.execute).toBeDefined();
    });

    it("should call unified endpoint on execution", async () => {
        const nodeDef = toNodeDefinition(mockPrimitive);
        const mockFetch = async (url: string, init?: RequestInit) => {
            expect(url).toBe("/api/primitives/test-primitive/execute");
            expect(init?.method).toBe("POST");
            expect(JSON.parse(init?.body as string)).toEqual({
                prompt: "hello",
            });
            return {
                ok: true,
                json: async () => ({ url: "http://example.com/mocked" }),
            } as Response;
        };

        const result = await nodeDef.execute(
            {
                id: "node-1",
                type: "flow-test",
                data: {},
                position: { x: 0, y: 0 },
            },
            { prompt: "hello" },
            { fetch: mockFetch as any },
        );

        expect(result).toEqual({ url: "http://example.com/mocked" });
    });

    it("should throw if the primitive has no flow configuration", () => {
        const invalidPrimitive = { ...mockPrimitive, flow: null };
        expect(() => toNodeDefinition(invalidPrimitive)).toThrow(
            "Primitive test-primitive has no flow surface",
        );
    });
});
