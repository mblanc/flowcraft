import { describe, it, expect } from "vitest";
import {
    getNodeDefinition,
    getSourcePortType,
    getTargetPortType,
} from "../lib/node-registry";
import { Node, Edge } from "@xyflow/react";
import {
    NodeData,
    LLMData,
    FileData,
    VideoData,
    ImageData,
    ResizeData,
    UpscaleData,
    WorkflowOutputData,
} from "../lib/types";

describe("NodeRegistry - Node Definitions", () => {
    it("should retrieve workflow-input definition", () => {
        const definition = getNodeDefinition("workflow-input");
        expect(definition).toBeDefined();
        expect(definition?.type).toBe("workflow-input");
    });

    it("should retrieve workflow-output definition", () => {
        const definition = getNodeDefinition("workflow-output");
        expect(definition).toBeDefined();
        expect(definition?.type).toBe("workflow-output");
    });
});

describe("NodeRegistry - Port Type Resolution", () => {
    it("should correctly resolve source port type for image node with null handle", () => {
        const node: Node<NodeData> = {
            id: "img-1",
            type: "image",
            data: {
                type: "image",
                name: "Image",
                prompt: "",
                images: [],
                aspectRatio: "1:1",
                model: "gemini-2.5-flash-image",
                resolution: "1K",
                groundingGoogleSearch: false,
                groundingImageSearch: false,
            } as ImageData,
            position: { x: 0, y: 0 },
        };
        const type = getSourcePortType(node, null);
        expect(type).toBe("image");
    });

    it("should correctly resolve target port type for workflow-output node with null handle", () => {
        const node: Node<NodeData> = {
            id: "out-1",
            type: "workflow-output",
            data: {
                type: "workflow-output",
                name: "Out",
                portName: "out",
                portType: "video",
            } as WorkflowOutputData,
            position: { x: 0, y: 0 },
        };
        const type = getTargetPortType(node, null);
        expect(type).toBe("video");
    });
});

describe("NodeRegistry - LLMNode gatherInputs", () => {
    const llmDefinition = getNodeDefinition("llm")!;

    it("should aggregate files from various source nodes", () => {
        const llmNode: Node<LLMData> = {
            id: "llm-1",
            type: "llm",
            data: {
                type: "llm",
                name: "LLM",
                model: "m",
                instructions: "i",
                outputType: "text",
                strictMode: false,
            },
            position: { x: 0, y: 0 },
        };

        const nodes: Node<NodeData>[] = [
            {
                id: "file-pdf",
                type: "file",
                data: {
                    type: "file",
                    name: "PDF",
                    fileType: "pdf",
                    gcsUri: "gs://pdf",
                    fileUrl: "",
                    fileName: "test.pdf",
                } as FileData,
                position: { x: 0, y: 0 },
            },
            {
                id: "file-img",
                type: "file",
                data: {
                    type: "file",
                    name: "IMG",
                    fileType: "image",
                    gcsUri: "gs://img",
                    fileUrl: "",
                    fileName: "test.png",
                } as FileData,
                position: { x: 0, y: 0 },
            },
            {
                id: "video-1",
                type: "video",
                data: {
                    type: "video",
                    name: "VID",
                    prompt: "p",
                    videoUrl: "gs://vid",
                    images: [],
                    aspectRatio: "16:9",
                    duration: 4,
                    model: "veo-3.1-fast-generate-preview",
                    generateAudio: true,
                    resolution: "720p",
                } as VideoData,
                position: { x: 0, y: 0 },
            },
            {
                id: "image-1",
                type: "image",
                data: {
                    type: "image",
                    name: "IMG-GEN",
                    prompt: "p",
                    images: ["gs://img-gen"],
                    aspectRatio: "1:1",
                    model: "gemini-2.5-flash-image",
                    resolution: "1K",
                    groundingGoogleSearch: false,
                    groundingImageSearch: false,
                } as ImageData,
                position: { x: 0, y: 0 },
            },
            {
                id: "resize-1",
                type: "resize",
                data: {
                    type: "resize",
                    name: "RESIZE",
                    aspectRatio: "16:9",
                    output: "gs://resized",
                } as ResizeData,
                position: { x: 0, y: 0 },
            },
            {
                id: "upscale-1",
                type: "upscale",
                data: {
                    type: "upscale",
                    name: "UPSCALE",
                    upscaleFactor: "x2",
                    image: "gs://upscaled",
                } as UpscaleData,
                position: { x: 0, y: 0 },
            },
        ];

        const edges: Edge[] = [
            {
                id: "e1",
                source: "file-pdf",
                target: "llm-1",
                targetHandle: "file-input",
            },
            {
                id: "e2",
                source: "file-img",
                target: "llm-1",
                targetHandle: "file-input",
            },
            {
                id: "e3",
                source: "video-1",
                target: "llm-1",
                targetHandle: "file-input",
            },
            {
                id: "e4",
                source: "image-1",
                target: "llm-1",
                targetHandle: "file-input",
            },
            {
                id: "e5",
                source: "resize-1",
                target: "llm-1",
                targetHandle: "file-input",
            },
            {
                id: "e6",
                source: "upscale-1",
                target: "llm-1",
                targetHandle: "file-input",
            },
        ];

        const getSourceData = (id: string) =>
            nodes.find((n) => n.id === id)?.data || null;

        const inputs = llmDefinition.gatherInputs(
            llmNode,
            edges,
            getSourceData,
        );

        expect(inputs.files).toContainEqual({
            url: "gs://pdf",
            type: "application/pdf",
        });
        expect(inputs.files).toContainEqual({
            url: "gs://img",
            type: "image/png",
        });
        expect(inputs.files).toContainEqual({
            url: "gs://vid",
            type: "video/mp4",
        });
        expect(inputs.files).toContainEqual({
            url: "gs://img-gen",
            type: "image/png",
        });
        expect(inputs.files).toContainEqual({
            url: "gs://resized",
            type: "image/png",
        });
        expect(inputs.files).toContainEqual({
            url: "gs://upscaled",
            type: "image/png",
        });
    });
});
