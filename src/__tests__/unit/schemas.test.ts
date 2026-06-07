import { describe, it, expect } from "vitest";
import { NodeDataSchema } from "../lib/schemas";

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
});
