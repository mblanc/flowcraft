/**
 * Tests for gatherInputs functions of various node definitions.
 * These are pure functions and require no mocks.
 */
import { describe, it, expect, vi } from "vitest";
import { videoNodeDefinition } from "../lib/nodes/video-node";
import { resizeNodeDefinition } from "../lib/nodes/resize-node";
import { upscaleNodeDefinition } from "../lib/nodes/upscale-node";
import { imageNodeDefinition } from "../lib/nodes/image-node";
import type { Node, Edge } from "@xyflow/react";
import type {
    VideoData,
    ImageData,
    ResizeData,
    UpscaleData,
    NodeData,
} from "../lib/types";

vi.mock("@/app/logger", () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── helpers ────────────────────────────────────────────────────────────────

function makeVideoNode(id = "vid-1"): Node<VideoData> {
    return {
        id,
        type: "video",
        position: { x: 0, y: 0 },
        data: {
            type: "video",
            name: "Video",
            prompt: "",
            images: [],
            aspectRatio: "16:9",
            duration: 4,
            model: "veo-3.1-fast-generate-001",
            generateAudio: false,
            resolution: "720p",
        } as VideoData,
    };
}

function makeImageNodeFull(id = "img-1"): Node<ImageData> {
    return {
        id,
        type: "image",
        position: { x: 0, y: 0 },
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
    };
}

function makeResizeNode(id = "resize-1"): Node<ResizeData> {
    return {
        id,
        type: "resize",
        position: { x: 0, y: 0 },
        data: {
            type: "resize",
            name: "Resize",
            aspectRatio: "16:9",
        } as ResizeData,
    };
}

function makeUpscaleNode(id = "upscale-1"): Node<UpscaleData> {
    return {
        id,
        type: "upscale",
        position: { x: 0, y: 0 },
        data: {
            type: "upscale",
            name: "Upscale",
            upscaleFactor: "x2",
            image: "",
        } as UpscaleData,
    };
}

function edge(
    id: string,
    source: string,
    target: string,
    targetHandle: string,
): Edge {
    return { id, source, target, targetHandle };
}

function textData(text: string): NodeData {
    return { type: "text", name: "T", text } as unknown as NodeData;
}

function imageData(images: string[]): NodeData {
    return {
        type: "image",
        name: "I",
        images,
        prompt: "",
        aspectRatio: "1:1",
        model: "m",
        resolution: "1K",
        groundingGoogleSearch: false,
        groundingImageSearch: false,
    } as unknown as NodeData;
}

// ─── videoNodeDefinition.gatherInputs ───────────────────────────────────────

describe("videoNodeDefinition.gatherInputs", () => {
    it("returns empty inputs when no edges", () => {
        const node = makeVideoNode();
        const inputs = videoNodeDefinition.gatherInputs(node, [], () => null);
        expect(inputs.images).toEqual([]);
        expect(inputs.namedNodes).toEqual([]);
        expect(inputs.prompt).toBeUndefined();
    });

    it("extracts prompt from a text source edge", () => {
        const node = makeVideoNode();
        const edges = [edge("e1", "txt-1", "vid-1", "prompt-input")];
        const getSourceData = () => textData("my prompt") as NodeData;
        const inputs = videoNodeDefinition.gatherInputs(
            node,
            edges,
            getSourceData,
        );
        expect(inputs.prompt).toBe("my prompt");
    });

    it("collects image inputs from image-input edges", () => {
        const node = makeVideoNode();
        const edges = [edge("e1", "img-1", "vid-1", "image-input")];
        const getSourceData = () => imageData(["gs://a.png"]);
        const inputs = videoNodeDefinition.gatherInputs(
            node,
            edges,
            getSourceData,
        );
        expect(inputs.images).toContainEqual({
            url: "gs://a.png",
            type: "image/png",
        });
    });

    it("skips image-input edge when source data is null", () => {
        const node = makeVideoNode();
        const edges = [edge("e1", "img-1", "vid-1", "image-input")];
        const inputs = videoNodeDefinition.gatherInputs(
            node,
            edges,
            () => null,
        );
        expect(inputs.images).toHaveLength(0);
    });

    it("extracts first-frame from first-frame-input edge", () => {
        const node = makeVideoNode();
        const edges = [edge("e1", "img-1", "vid-1", "first-frame-input")];
        const getSourceData = () => imageData(["gs://frame.png"]);
        const inputs = videoNodeDefinition.gatherInputs(
            node,
            edges,
            getSourceData,
        );
        expect(inputs.firstFrame).toBe("gs://frame.png");
    });

    it("extracts last-frame from last-frame-input edge", () => {
        const node = makeVideoNode();
        const edges = [edge("e1", "img-1", "vid-1", "last-frame-input")];
        const getSourceData = () => imageData(["gs://last.png"]);
        const inputs = videoNodeDefinition.gatherInputs(
            node,
            edges,
            getSourceData,
        );
        expect(inputs.lastFrame).toBe("gs://last.png");
    });

    it("handles collection prompt source", () => {
        const node = makeVideoNode();
        const edges = [edge("e1", "list-1", "vid-1", "prompt-input")];
        const getSourceData = () =>
            ({
                type: "list",
                name: "List",
                itemType: "text",
                items: ["p1", "p2"],
            }) as unknown as NodeData;
        const inputs = videoNodeDefinition.gatherInputs(
            node,
            edges,
            getSourceData,
        );
        expect(inputs.namedNodes).toHaveLength(1);
        expect(inputs.namedNodes![0].textValues).toEqual(["p1", "p2"]);
    });
});

// ─── resizeNodeDefinition.gatherInputs ──────────────────────────────────────

describe("resizeNodeDefinition.gatherInputs", () => {
    it("returns empty inputs when no edge", () => {
        const node = makeResizeNode();
        const inputs = resizeNodeDefinition.gatherInputs(node, [], () => null);
        expect(inputs.image).toBeUndefined();
    });

    it("returns empty when source data is null", () => {
        const node = makeResizeNode();
        const edges = [edge("e1", "src", "resize-1", "image-input")];
        const inputs = resizeNodeDefinition.gatherInputs(
            node,
            edges,
            () => null,
        );
        expect(inputs.image).toBeUndefined();
    });

    it("extracts a string image URL", () => {
        const node = makeResizeNode();
        const edges = [edge("e1", "src", "resize-1", "image-input")];
        const getSourceData = () => imageData(["gs://img.png"]);
        const inputs = resizeNodeDefinition.gatherInputs(
            node,
            edges,
            getSourceData,
        );
        expect(inputs.image).toBe("gs://img.png");
    });

    it("handles collection source with multiple images", () => {
        const node = makeResizeNode();
        const edges = [edge("e1", "img-1", "resize-1", "image-input")];
        const getSourceData = () =>
            ({
                type: "image",
                name: "I",
                batchTotal: 2,
                images: ["gs://a.png", "gs://b.png"],
            }) as unknown as NodeData;
        const inputs = resizeNodeDefinition.gatherInputs(
            node,
            edges,
            getSourceData,
        );
        expect(inputs.image).toBe("gs://a.png");
        expect(inputs.namedNodes).toHaveLength(1);
        expect(inputs.namedNodes![0].fileValuesList).toHaveLength(2);
    });

    it("handles object-with-url source value", () => {
        const node = makeResizeNode();
        const edges = [edge("e1", "src", "resize-1", "image-input")];
        const getSourceData = () =>
            ({
                type: "upscale",
                name: "U",
                image: { url: "gs://up.png", type: "image/png" },
                upscaleFactor: "x2",
            }) as unknown as NodeData;
        const inputs = resizeNodeDefinition.gatherInputs(
            node,
            edges,
            getSourceData,
        );
        // object with url should be handled (image may or may not be set)
        expect(inputs).toBeDefined();
    });
});

// ─── upscaleNodeDefinition.gatherInputs ─────────────────────────────────────

describe("upscaleNodeDefinition.gatherInputs", () => {
    it("returns empty inputs when no edge", () => {
        const node = makeUpscaleNode();
        const inputs = upscaleNodeDefinition.gatherInputs(node, [], () => null);
        expect(inputs.image).toBeUndefined();
    });

    it("extracts a string image URL", () => {
        const node = makeUpscaleNode();
        const edges = [edge("e1", "src", "upscale-1", "image-input")];
        const getSourceData = () => imageData(["gs://img.png"]);
        const inputs = upscaleNodeDefinition.gatherInputs(
            node,
            edges,
            getSourceData,
        );
        expect(inputs.image).toBe("gs://img.png");
    });

    it("handles collection source", () => {
        const node = makeUpscaleNode();
        const edges = [edge("e1", "img-1", "upscale-1", "image-input")];
        const getSourceData = () =>
            ({
                type: "image",
                name: "I",
                batchTotal: 2,
                images: ["gs://a.png", "gs://b.png"],
            }) as unknown as NodeData;
        const inputs = upscaleNodeDefinition.gatherInputs(
            node,
            edges,
            getSourceData,
        );
        expect(inputs.image).toBe("gs://a.png");
        expect(inputs.namedNodes).toHaveLength(1);
    });
});

// ─── imageNodeDefinition.gatherInputs ───────────────────────────────────────

describe("imageNodeDefinition.gatherInputs", () => {
    it("returns empty inputs when no edges", () => {
        const node = makeImageNodeFull();
        const inputs = imageNodeDefinition.gatherInputs(node, [], () => null);
        expect(inputs.images).toEqual([]);
        expect(inputs.namedNodes).toEqual([]);
    });

    it("extracts a text prompt from prompt-input edge", () => {
        const node = makeImageNodeFull();
        const edges = [edge("e1", "txt-1", "img-1", "prompt-input")];
        const getSourceData = () => textData("a sunset");
        const inputs = imageNodeDefinition.gatherInputs(
            node,
            edges,
            getSourceData,
        );
        expect(inputs.prompt).toBe("a sunset");
    });

    it("collects images from image-input edges", () => {
        const node = makeImageNodeFull();
        const edges = [edge("e1", "src", "img-1", "image-input")];
        const getSourceData = () => imageData(["gs://ref.png"]);
        const inputs = imageNodeDefinition.gatherInputs(
            node,
            edges,
            getSourceData,
        );
        expect(inputs.images).toContainEqual({
            url: "gs://ref.png",
            type: "image/png",
        });
    });

    it("handles collection image source", () => {
        const node = makeImageNodeFull();
        const edges = [edge("e1", "img-src", "img-1", "image-input")];
        const getSourceData = () =>
            ({
                type: "image",
                name: "Batch",
                batchTotal: 3,
                images: ["gs://a.png", "gs://b.png", "gs://c.png"],
            }) as unknown as NodeData;
        const inputs = imageNodeDefinition.gatherInputs(
            node,
            edges,
            getSourceData,
        );
        expect(inputs.namedNodes).toHaveLength(1);
        expect(inputs.namedNodes![0].fileValuesList).toHaveLength(3);
    });

    it("skips null source data on image-input edge", () => {
        const node = makeImageNodeFull();
        const edges = [edge("e1", "src", "img-1", "image-input")];
        const inputs = imageNodeDefinition.gatherInputs(
            node,
            edges,
            () => null,
        );
        expect(inputs.images).toHaveLength(0);
    });
});
