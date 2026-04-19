import { describe, it, expect } from "vitest";
import {
    isCollectionSource,
    getSourceValue,
    inferMimeType,
    buildFileValues,
    createNamedNodesTracker,
    findInputByHandle,
} from "../lib/nodes/shared/node-helpers";
import type { NodeData } from "../lib/types";

// Helper to create minimal NodeData fixtures
function makeData(type: string, extra: Record<string, unknown> = {}): NodeData {
    return { type, name: type, ...extra } as unknown as NodeData;
}

describe("isCollectionSource", () => {
    it("returns false for null", () => {
        expect(isCollectionSource(null)).toBe(false);
    });

    it("returns true for list nodes", () => {
        expect(isCollectionSource(makeData("list"))).toBe(true);
    });

    it("returns true when batchTotal > 0", () => {
        expect(isCollectionSource(makeData("image", { batchTotal: 3 }))).toBe(
            true,
        );
    });

    it("returns false when batchTotal is 0", () => {
        expect(isCollectionSource(makeData("image", { batchTotal: 0 }))).toBe(
            false,
        );
    });
});

describe("getSourceValue", () => {
    it("returns null for null input", () => {
        expect(getSourceValue(null)).toBeNull();
    });

    it("returns text from text node", () => {
        expect(getSourceValue(makeData("text", { text: "hello" }))).toBe(
            "hello",
        );
    });

    it("returns images array from image node", () => {
        const imgs = ["gs://a.png"];
        expect(getSourceValue(makeData("image", { images: imgs }))).toEqual(
            imgs,
        );
    });

    it("returns output from llm node", () => {
        expect(getSourceValue(makeData("llm", { output: "result" }))).toBe(
            "result",
        );
    });

    it("returns batch outputs array from llm node when batchTotal > 1", () => {
        const outputs = ["r1", "r2"];
        expect(
            getSourceValue(
                makeData("llm", {
                    batchTotal: 2,
                    outputs,
                }),
            ),
        ).toEqual(outputs);
    });

    it("returns videoUrl from video node", () => {
        expect(
            getSourceValue(makeData("video", { videoUrl: "gs://v.mp4" })),
        ).toBe("gs://v.mp4");
    });

    it("returns batch videoUrls from video node when batchTotal > 1", () => {
        const urls = ["gs://v1.mp4", "gs://v2.mp4"];
        expect(
            getSourceValue(
                makeData("video", { batchTotal: 2, videoUrls: urls }),
            ),
        ).toEqual(urls);
    });

    it("returns image from upscale node", () => {
        expect(
            getSourceValue(makeData("upscale", { image: "gs://up.png" })),
        ).toBe("gs://up.png");
    });

    it("returns output from resize node", () => {
        expect(
            getSourceValue(makeData("resize", { output: "gs://r.png" })),
        ).toBe("gs://r.png");
    });

    it("returns items from list node", () => {
        const items = ["a", "b"];
        expect(getSourceValue(makeData("list", { items }))).toEqual(items);
    });

    it("returns gcsUri from file node", () => {
        expect(getSourceValue(makeData("file", { gcsUri: "gs://f.pdf" }))).toBe(
            "gs://f.pdf",
        );
    });

    it("returns value from router node", () => {
        expect(
            getSourceValue(makeData("router", { value: ["gs://img.png"] })),
        ).toEqual(["gs://img.png"]);
    });

    it("handles workflow-input text port", () => {
        expect(
            getSourceValue(
                makeData("workflow-input", {
                    portType: "text",
                    text: "user input",
                }),
            ),
        ).toBe("user input");
    });

    it("handles workflow-input image port", () => {
        expect(
            getSourceValue(
                makeData("workflow-input", {
                    portType: "image",
                    images: ["gs://img.png"],
                }),
            ),
        ).toEqual(["gs://img.png"]);
    });

    it("handles workflow-input video port", () => {
        expect(
            getSourceValue(
                makeData("workflow-input", {
                    portType: "video",
                    videoUrl: "gs://v.mp4",
                }),
            ),
        ).toBe("gs://v.mp4");
    });

    it("handles workflow-input any port falling back to portDefaultValue", () => {
        expect(
            getSourceValue(
                makeData("workflow-input", {
                    portType: "any",
                    portDefaultValue: "default",
                }),
            ),
        ).toBe("default");
    });

    it("returns value via workflow-output passthrough", () => {
        const inner = makeData("text", { text: "passed" });
        expect(
            getSourceValue(makeData("workflow-output", { value: inner })),
        ).toBe("passed");
    });
});

describe("inferMimeType", () => {
    it("infers pdf from .pdf extension", () => {
        expect(inferMimeType("file.pdf", null)).toBe("application/pdf");
    });

    it("infers image/png from .png extension", () => {
        expect(inferMimeType("photo.png", null)).toBe("image/png");
    });

    it("infers image/png from .jpg extension", () => {
        expect(inferMimeType("photo.jpg", null)).toBe("image/png");
    });

    it("infers image/png from .webp extension", () => {
        expect(inferMimeType("photo.webp", null)).toBe("image/png");
    });

    it("infers video/mp4 from .mp4 extension", () => {
        expect(inferMimeType("clip.mp4", null)).toBe("video/mp4");
    });

    it("infers video/mp4 from .mov extension", () => {
        expect(inferMimeType("clip.mov", null)).toBe("video/mp4");
    });

    it("uses sourceData fileType=pdf when no extension matches", () => {
        expect(
            inferMimeType(
                "gs://bucket/doc",
                makeData("file", { fileType: "pdf" }),
            ),
        ).toBe("application/pdf");
    });

    it("uses sourceData type=image when no extension matches", () => {
        expect(inferMimeType("gs://bucket/img", makeData("image"))).toBe(
            "image/png",
        );
    });

    it("uses sourceData type=video when no extension matches", () => {
        expect(inferMimeType("gs://bucket/vid", makeData("video"))).toBe(
            "video/mp4",
        );
    });

    it("uses sourceData type=upscale to infer image/png", () => {
        expect(inferMimeType("gs://bucket/up", makeData("upscale"))).toBe(
            "image/png",
        );
    });

    it("uses sourceData type=resize to infer image/png", () => {
        expect(inferMimeType("gs://bucket/rs", makeData("resize"))).toBe(
            "image/png",
        );
    });

    it("returns application/octet-stream as fallback", () => {
        expect(inferMimeType("gs://bucket/unknown", null)).toBe(
            "application/octet-stream",
        );
    });

    it("uses router valueMediaType=image to infer image/png for extensionless URLs", () => {
        expect(
            inferMimeType(
                "gs://bucket/uuid-no-extension",
                makeData("router", { valueMediaType: "image" }),
            ),
        ).toBe("image/png");
    });

    it("uses router valueMediaType=video to infer video/mp4 for extensionless URLs", () => {
        expect(
            inferMimeType(
                "gs://bucket/uuid-no-extension",
                makeData("router", { valueMediaType: "video" }),
            ),
        ).toBe("video/mp4");
    });

    it("uses router valueMediaType=pdf to infer application/pdf for extensionless URLs", () => {
        expect(
            inferMimeType(
                "gs://bucket/uuid-no-extension",
                makeData("router", { valueMediaType: "pdf" }),
            ),
        ).toBe("application/pdf");
    });

    it("falls back to octet-stream for router with no valueMediaType", () => {
        expect(
            inferMimeType("gs://bucket/uuid-no-extension", makeData("router")),
        ).toBe("application/octet-stream");
    });
});

describe("buildFileValues", () => {
    it("builds file values from string URLs", () => {
        const result = buildFileValues(["gs://a.png"], makeData("image"));
        expect(result).toEqual([{ url: "gs://a.png", type: "image/png" }]);
    });

    it("builds file values from object with url and type", () => {
        const result = buildFileValues(
            [{ url: "gs://b.mp4", type: "video/mp4" }],
            null,
        );
        expect(result).toEqual([{ url: "gs://b.mp4", type: "video/mp4" }]);
    });

    it("defaults to application/octet-stream when object type is missing", () => {
        const result = buildFileValues([{ url: "gs://c.bin" }], null);
        expect(result).toEqual([
            { url: "gs://c.bin", type: "application/octet-stream" },
        ]);
    });

    it("skips non-string, non-object-with-url items", () => {
        const result = buildFileValues([42, null, undefined], null);
        expect(result).toHaveLength(0);
    });
});

describe("createNamedNodesTracker", () => {
    it("creates a new entry for an unseen nodeId", () => {
        const tracker = createNamedNodesTracker();
        const entry = tracker.getOrCreate(
            "n1",
            makeData("text", { name: "T" }),
        );
        expect(entry.nodeId).toBe("n1");
        expect(entry.fileValues).toEqual([]);
        expect(entry.textValue).toBeNull();
    });

    it("returns same entry on second call for same nodeId", () => {
        const tracker = createNamedNodesTracker();
        const first = tracker.getOrCreate(
            "n1",
            makeData("text", { name: "T" }),
        );
        const second = tracker.getOrCreate(
            "n1",
            makeData("text", { name: "Other" }),
        );
        expect(first).toBe(second);
    });

    it("values() returns all tracked entries", () => {
        const tracker = createNamedNodesTracker();
        tracker.getOrCreate("a", makeData("text", { name: "A" }));
        tracker.getOrCreate("b", makeData("image", { name: "B" }));
        expect(tracker.values()).toHaveLength(2);
    });
});

describe("findInputByHandle", () => {
    const edges = [
        {
            id: "e1",
            source: "src",
            target: "tgt",
            targetHandle: "handle",
            sourceHandle: null,
        },
    ];

    it("returns source data when edge matches", () => {
        const sourceData = makeData("text", { text: "val" });
        const result = findInputByHandle(
            "tgt",
            edges,
            "handle",
            () => sourceData,
        );
        expect(result).toBe(sourceData);
    });

    it("returns null when no edge matches the handle", () => {
        const result = findInputByHandle(
            "tgt",
            edges,
            "other-handle",
            () => null,
        );
        expect(result).toBeNull();
    });

    it("returns null when no edge targets the node", () => {
        const result = findInputByHandle(
            "other-node",
            edges,
            "handle",
            () => null,
        );
        expect(result).toBeNull();
    });
});
