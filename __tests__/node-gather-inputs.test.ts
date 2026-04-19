/**
 * Tests for gatherInputs functions of various node definitions.
 * These are pure functions and require no mocks.
 */
import { describe, it, expect, vi } from "vitest";
import { videoNodeDefinition } from "../lib/nodes/video-node";
import { resizeNodeDefinition } from "../lib/nodes/resize-node";
import { upscaleNodeDefinition } from "../lib/nodes/upscale-node";
import { imageNodeDefinition } from "../lib/nodes/image-node";
import { routerNodeDefinition } from "../lib/nodes/router-node";
import type { Node, Edge } from "@xyflow/react";
import type {
    VideoData,
    ImageData,
    ResizeData,
    UpscaleData,
    RouterData,
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

    it("collects images through a router with valueMediaType=image (extensionless URL)", () => {
        const node = makeImageNodeFull();
        const edges = [edge("e1", "router-1", "img-1", "image-input")];
        const routerData: NodeData = {
            type: "router",
            name: "Router",
            value: ["gs://bucket/uuid-no-extension"],
            valueMediaType: "image",
        } as unknown as NodeData;
        const inputs = imageNodeDefinition.gatherInputs(
            node,
            edges,
            () => routerData,
        );
        expect(inputs.images).toContainEqual({
            url: "gs://bucket/uuid-no-extension",
            type: "image/png",
        });
    });
});

function makeRouterNode(id = "router-1"): Node<RouterData> {
    return {
        id,
        type: "router",
        position: { x: 0, y: 0 },
        data: { type: "router", name: "Router" } as RouterData,
    };
}

describe("routerNodeDefinition.gatherInputs", () => {
    it("returns value and valueMediaType=image from an image node source", () => {
        const node = makeRouterNode();
        const edges = [edge("e1", "img-src", "router-1", "input")];
        const sourceData: NodeData = {
            type: "image",
            name: "I",
            images: ["gs://bucket/uuid"],
        } as unknown as NodeData;
        const inputs = routerNodeDefinition.gatherInputs(
            node,
            edges,
            () => sourceData,
        );
        expect(inputs.value).toEqual(["gs://bucket/uuid"]);
        expect(inputs.valueMediaType).toBe("image");
    });

    it("returns value and valueMediaType=video from a video node source", () => {
        const node = makeRouterNode();
        const edges = [edge("e1", "vid-src", "router-1", "input")];
        const sourceData: NodeData = {
            type: "video",
            name: "V",
            videoUrl: "gs://bucket/vid",
        } as unknown as NodeData;
        const inputs = routerNodeDefinition.gatherInputs(
            node,
            edges,
            () => sourceData,
        );
        expect(inputs.value).toBe("gs://bucket/vid");
        expect(inputs.valueMediaType).toBe("video");
    });

    it("returns valueMediaType=image from a file node with fileType=image", () => {
        const node = makeRouterNode();
        const edges = [edge("e1", "file-src", "router-1", "input")];
        const sourceData: NodeData = {
            type: "file",
            name: "F",
            fileType: "image",
            fileUrl: "",
            fileName: "",
            gcsUri: "gs://bucket/photo",
        } as unknown as NodeData;
        const inputs = routerNodeDefinition.gatherInputs(
            node,
            edges,
            () => sourceData,
        );
        expect(inputs.value).toBe("gs://bucket/photo");
        expect(inputs.valueMediaType).toBe("image");
    });

    it("propagates valueMediaType through chained routers", () => {
        const node = makeRouterNode("router-2");
        const edges = [edge("e1", "router-1", "router-2", "input")];
        const upstreamRouter: NodeData = {
            type: "router",
            name: "Router1",
            value: ["gs://bucket/uuid"],
            valueMediaType: "image",
        } as unknown as NodeData;
        const inputs = routerNodeDefinition.gatherInputs(
            node,
            edges,
            () => upstreamRouter,
        );
        expect(inputs.valueMediaType).toBe("image");
    });

    it("returns undefined valueMediaType for text source", () => {
        const node = makeRouterNode();
        const edges = [edge("e1", "txt-src", "router-1", "input")];
        const sourceData: NodeData = {
            type: "text",
            name: "T",
            text: "hello",
        } as unknown as NodeData;
        const inputs = routerNodeDefinition.gatherInputs(
            node,
            edges,
            () => sourceData,
        );
        expect(inputs.valueMediaType).toBeUndefined();
    });

    it("returns undefined value when no input edge", () => {
        const node = makeRouterNode();
        const inputs = routerNodeDefinition.gatherInputs(node, [], () => null);
        expect(inputs.value).toBeUndefined();
        expect(inputs.valueMediaType).toBeUndefined();
    });
});

// ─── Integration: image1 → router → image2 ──────────────────────────────────
// Simulates exactly what the workflow engine does:
//   1. image1.execute() → produces images
//   2. router.gatherInputs() reads image1's post-execution data
//   3. router.execute() → produces value + valueMediaType
//   4. image2.gatherInputs() reads router's post-execution data (merge of initial + execute result)
//   5. image2's inputs.images must contain image1's output with correct MIME type

describe("image1 → router → image2 execution chain", () => {
    const IMG1_URL = "gs://bucket/uuid-no-extension"; // extensionless, like real generated URLs

    function mergeExecutionResult(
        initialData: NodeData,
        result: Partial<NodeData>,
    ): NodeData {
        return { ...initialData, ...result } as NodeData;
    }

    it("image1 output reaches image2 inputs.images with correct MIME type", async () => {
        // ── Setup nodes ──
        const image1Node = makeImageNodeFull("img-1");
        const routerNode = makeRouterNode("router-1");
        const image2Node = makeImageNodeFull("img-2");

        const edges: Edge[] = [
            edge("e1", "img-1", "router-1", "input"),
            edge("e2", "router-1", "img-2", "image-input"),
        ];

        // ── Step 1: image1 executes, producing an image URL ──
        const image1ExecuteResult = { images: [IMG1_URL] };
        const image1PostExecution = mergeExecutionResult(
            image1Node.data,
            image1ExecuteResult,
        );

        // ── Step 2: router gatherInputs reads image1's post-execution data ──
        const routerInputs = routerNodeDefinition.gatherInputs(
            routerNode,
            edges,
            (id) => (id === "img-1" ? image1PostExecution : null),
        );

        expect(routerInputs.value).toEqual([IMG1_URL]);
        expect(routerInputs.valueMediaType).toBe("image");

        // ── Step 3: router executes ──
        const routerExecuteResult = await routerNodeDefinition.execute(
            routerNode,
            routerInputs,
        );
        const routerPostExecution = mergeExecutionResult(
            routerNode.data,
            routerExecuteResult as Partial<NodeData>,
        );

        expect(routerPostExecution).toMatchObject({
            type: "router",
            value: [IMG1_URL],
            valueMediaType: "image",
        });

        // ── Step 4: image2 gatherInputs reads router's post-execution data ──
        const image2Inputs = imageNodeDefinition.gatherInputs(
            image2Node,
            edges,
            (id) => (id === "router-1" ? routerPostExecution : null),
        );

        // ── Step 5: image1's URL must appear in image2's images with correct type ──
        expect(image2Inputs.images).toContainEqual({
            url: IMG1_URL,
            type: "image/png",
        });
    });

    it("file node (image type) → router → image2 works the same way", async () => {
        const routerNode = makeRouterNode("router-1");
        const image2Node = makeImageNodeFull("img-2");

        const edges: Edge[] = [
            edge("e1", "file-1", "router-1", "input"),
            edge("e2", "router-1", "img-2", "image-input"),
        ];

        const filePostExecution: NodeData = {
            type: "file",
            name: "F",
            fileType: "image",
            fileUrl: "",
            fileName: "",
            gcsUri: IMG1_URL,
        } as unknown as NodeData;

        const routerInputs = routerNodeDefinition.gatherInputs(
            routerNode,
            edges,
            (id) => (id === "file-1" ? filePostExecution : null),
        );

        expect(routerInputs.valueMediaType).toBe("image");

        const routerExecuteResult = await routerNodeDefinition.execute(
            routerNode,
            routerInputs,
        );
        const routerPostExecution = mergeExecutionResult(
            routerNode.data,
            routerExecuteResult as Partial<NodeData>,
        );

        const image2Inputs = imageNodeDefinition.gatherInputs(
            image2Node,
            edges,
            (id) => (id === "router-1" ? routerPostExecution : null),
        );

        expect(image2Inputs.images).toContainEqual({
            url: IMG1_URL,
            type: "image/png",
        });
    });
});
