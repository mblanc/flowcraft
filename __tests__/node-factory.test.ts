import { describe, it, expect } from "vitest";
import { createNode } from "../lib/node-factory";
import {
    LLMData,
    TextData,
    ImageData,
    VideoData,
    FileData,
    UpscaleData,
    ResizeData,
    ListData,
    WorkflowInputData,
    WorkflowOutputData,
    CustomWorkflowData,
    NodeType,
} from "../lib/types";

describe("Node Factory", () => {
    it("should create an llm node with correct defaults", () => {
        const node = createNode("llm");
        expect(node.type).toBe("llm");
        expect(node.data.type).toBe("llm");
        expect(node.data.name).toBe("LLM");
        expect((node.data as LLMData).outputType).toBe("text");
        expect((node.data as LLMData).strictMode).toBe(false);
    });

    it("should create a text node with correct defaults", () => {
        const node = createNode("text");
        expect(node.type).toBe("text");
        expect(node.data.type).toBe("text");
        expect(node.data.name).toBe("Text");
        expect((node.data as TextData).text).toBe("");
    });

    it("should create an image node with correct defaults", () => {
        const node = createNode("image");
        expect(node.type).toBe("image");
        expect(node.data.type).toBe("image");
        expect(node.data.name).toBe("Image");
        expect((node.data as ImageData).prompt).toBe("");
        expect((node.data as ImageData).images).toEqual([]);
        expect((node.data as ImageData).groundingGoogleSearch).toBe(false);
    });

    it("should create a video node with correct defaults", () => {
        const node = createNode("video");
        expect(node.type).toBe("video");
        expect(node.data.type).toBe("video");
        expect(node.data.name).toBe("Video");
        expect((node.data as VideoData).generateAudio).toBe(false);
        expect((node.data as VideoData).resolution).toBe("720p");
    });

    it("should create a file node with correct defaults", () => {
        const node = createNode("file");
        expect(node.type).toBe("file");
        expect(node.data.type).toBe("file");
        expect(node.data.name).toBe("File");
        expect((node.data as FileData).fileType).toBeNull();
        expect((node.data as FileData).fileUrl).toBe("");
    });

    it("should create an upscale node with correct defaults", () => {
        const node = createNode("upscale");
        expect(node.type).toBe("upscale");
        expect(node.data.type).toBe("upscale");
        expect(node.data.name).toBe("Upscale");
        expect((node.data as UpscaleData).upscaleFactor).toBe("x2");
        expect((node.data as UpscaleData).image).toBe("");
    });

    it("should create a resize node with correct defaults", () => {
        const node = createNode("resize");
        expect(node.type).toBe("resize");
        expect(node.data.type).toBe("resize");
        expect(node.data.name).toBe("Resize");
    });

    it("should create a list node with correct defaults", () => {
        const node = createNode("list");
        expect(node.type).toBe("list");
        expect(node.data.type).toBe("list");
        expect(node.data.name).toBe("List");
        expect((node.data as ListData).itemType).toBe("text");
        expect((node.data as ListData).items).toEqual([""]);
    });

    it("should create a workflow-input node", () => {
        const node = createNode("workflow-input");
        expect(node.type).toBe("workflow-input");
        expect(node.data.type).toBe("workflow-input");
        expect(node.data.name).toBe("Workflow Input");
        expect((node.data as WorkflowInputData).portName).toBe("input");
    });

    it("should create a workflow-output node", () => {
        const node = createNode("workflow-output");
        expect(node.type).toBe("workflow-output");
        expect(node.data.type).toBe("workflow-output");
        expect(node.data.name).toBe("Workflow Output");
        expect((node.data as WorkflowOutputData).portName).toBe("output");
    });

    it("should create a custom-workflow node", () => {
        const node = createNode("custom-workflow");
        expect(node.type).toBe("custom-workflow");
        expect(node.data.type).toBe("custom-workflow");
        expect(node.data.name).toBe("Custom Workflow");
        expect((node.data as CustomWorkflowData).subWorkflowId).toBe("");
    });

    it("should use provided position", () => {
        const node = createNode("text", { x: 100, y: 200 });
        expect(node.position).toEqual({ x: 100, y: 200 });
    });

    it("should throw error for unknown type", () => {
        expect(() => createNode("unknown" as NodeType)).toThrow(
            "Unknown node type: unknown",
        );
    });
});
