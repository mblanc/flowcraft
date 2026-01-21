import { describe, it, expect } from "vitest";
import { createNode } from "../lib/node-factory";

describe("Node Factory", () => {
    it("should create a workflow-input node", () => {
        const node = createNode("workflow-input");
        expect(node.type).toBe("workflow-input");
        expect(node.data.type).toBe("workflow-input");
        expect(node.data.name).toBe("Workflow Input");
        expect((node.data as any).portName).toBe("input");
    });

    it("should create a workflow-output node", () => {
        const node = createNode("workflow-output");
        expect(node.type).toBe("workflow-output");
        expect(node.data.type).toBe("workflow-output");
        expect(node.data.name).toBe("Workflow Output");
        expect((node.data as any).portName).toBe("output");
    });

    it("should create a custom-workflow node", () => {
        const node = createNode("custom-workflow");
        expect(node.type).toBe("custom-workflow");
        expect(node.data.type).toBe("custom-workflow");
        expect(node.data.name).toBe("Custom Workflow");
        expect((node.data as any).subWorkflowId).toBe("");
    });

    it("should throw error for unknown type", () => {
        expect(() => createNode("unknown" as any)).toThrow("Unknown node type: unknown");
    });
});
