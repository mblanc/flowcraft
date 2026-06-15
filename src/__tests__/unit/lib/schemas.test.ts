import { describe, it, expect } from "vitest";
import { NodeDataSchema, MusicDataSchema } from "@/lib/schemas";

describe("Schema Validation", () => {
    describe("Workflow Input Node", () => {
        it("should validate a valid workflow input node", () => {
            const data = {
                type: "workflow-input",
                name: "Input Node",
                portName: "prompt",
                portType: "text",
                portRequired: true,
                portDefaultValue: "Hello",
            };
            const result = NodeDataSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it("should fail if portType is invalid", () => {
            const data = {
                type: "workflow-input",
                name: "Input Node",
                portName: "prompt",
                portType: "invalid-type",
            };
            const result = NodeDataSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe("Workflow Output Node", () => {
        it("should validate a valid workflow output node", () => {
            const data = {
                type: "workflow-output",
                name: "Output Node",
                portName: "result",
                portType: "image",
            };
            const result = NodeDataSchema.safeParse(data);
            expect(result.success).toBe(true);
        });
    });

    describe("Custom Workflow Node", () => {
        it("should validate a valid custom workflow node", () => {
            const data = {
                type: "custom-workflow",
                name: "Sub Workflow",
                subWorkflowId: "flow-123",
            };
            const result = NodeDataSchema.safeParse(data);
            expect(result.success).toBe(true);
        });
    });

    describe("MusicDataSchema", () => {
        it("applies defaults for model when omitted", () => {
            const result = MusicDataSchema.safeParse({
                type: "music",
                name: "Music",
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.model).toBe("lyria-3-clip-preview");
                expect(result.data.prompt).toBe("");
            }
        });

        it("accepts a valid model enum value", () => {
            const result = MusicDataSchema.safeParse({
                type: "music",
                name: "Music",
                model: "lyria-3-pro-preview",
            });
            expect(result.success).toBe(true);
        });

        it("rejects an invalid model enum value", () => {
            const result = MusicDataSchema.safeParse({
                type: "music",
                name: "Music",
                model: "lyria-unknown",
            });
            expect(result.success).toBe(false);
        });

        it("NodeDataSchema discriminates correctly on type: music", () => {
            const result = NodeDataSchema.safeParse({
                type: "music",
                name: "Music",
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe("music");
            }
        });
    });
});
