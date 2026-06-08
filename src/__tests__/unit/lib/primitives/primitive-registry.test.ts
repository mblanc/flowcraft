/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from "vitest";
import { PrimitiveRegistry } from "@/primitives/registry";
import { Primitive } from "@/primitives/types";
import { z } from "zod";

describe("PrimitiveRegistry", () => {
    let registry: PrimitiveRegistry;

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
        canvas: {
            type: "canvas-test",
            toCanvasData: () => ({}),
            toRequest: () => ({ prompt: "canvas" }),
        },
        agent: {
            skillPath: "skills/test/SKILL.md",
            operationId: "test_op",
        },
    };

    beforeEach(() => {
        registry = new PrimitiveRegistry();
    });

    it("should allow registering and retrieving a primitive", () => {
        registry.register(mockPrimitive);
        expect(registry.get("test-primitive")).toBe(mockPrimitive);
    });

    it("should retrieve primitive by flow type", () => {
        registry.register(mockPrimitive);
        expect(registry.getByFlowType("flow-test")).toBe(mockPrimitive);
    });

    it("should retrieve primitive by canvas type", () => {
        registry.register(mockPrimitive);
        expect(registry.getByCanvasType("canvas-test")).toBe(mockPrimitive);
    });

    it("should return lists of registered types", () => {
        registry.register(mockPrimitive);
        expect(registry.flowTypes()).toContain("flow-test");
        expect(registry.canvasTypes()).toContain("canvas-test");
        expect(registry.primitiveIds()).toContain("test-primitive");
        expect(registry.operationIds()).toContain("test_op");
    });
});
