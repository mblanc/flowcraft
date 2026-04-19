import { describe, it, expect } from "vitest";
import { applyVideoFallback } from "../lib/canvas-agent";
import type { GenerationStep, ChatAttachment } from "../lib/canvas-types";

describe("applyVideoFallback", () => {
    it("should assign firstFrameNodeId when there is 1 attachment", () => {
        const step: GenerationStep = {
            id: "step_0",
            type: "video",
            prompt: "test",
        };
        const attachments: ChatAttachment[] = [
            { nodeId: "img_1", label: "Image 1", type: "canvas-image" },
        ];

        applyVideoFallback(step, "video", attachments, 0, 1);

        expect(step.firstFrameNodeId).toBe("img_1");
        expect(step.referenceNodeIds).toBeUndefined();
    });

    it("should assign first and last frame when there are 2 attachments", () => {
        const step: GenerationStep = {
            id: "step_0",
            type: "video",
            prompt: "test",
        };
        const attachments: ChatAttachment[] = [
            { nodeId: "img_1", label: "Image 1", type: "canvas-image" },
            { nodeId: "img_2", label: "Image 2", type: "canvas-image" },
        ];

        applyVideoFallback(step, "video", attachments, 0, 1);

        expect(step.firstFrameNodeId).toBe("img_1");
        expect(step.lastFrameNodeId).toBe("img_2");
        expect(step.referenceNodeIds).toBeUndefined();
    });

    it("should assign all as referenceNodeIds when attachments > 2 and steps != attachments", () => {
        const step: GenerationStep = {
            id: "step_0",
            type: "video",
            prompt: "test",
        };
        const attachments: ChatAttachment[] = [
            { nodeId: "img_1", label: "Image 1", type: "canvas-image" },
            { nodeId: "img_2", label: "Image 2", type: "canvas-image" },
            { nodeId: "img_3", label: "Image 3", type: "canvas-image" },
        ];

        applyVideoFallback(step, "video", attachments, 0, 1);

        expect(step.firstFrameNodeId).toBeUndefined();
        expect(step.referenceNodeIds).toEqual(["img_1", "img_2", "img_3"]);
    });

    it("should map 1-to-1 when attachments > 2 and steps == attachments", () => {
        const attachments: ChatAttachment[] = [
            { nodeId: "img_1", label: "Image 1", type: "canvas-image" },
            { nodeId: "img_2", label: "Image 2", type: "canvas-image" },
            { nodeId: "img_3", label: "Image 3", type: "canvas-image" },
        ];

        const step0: GenerationStep = {
            id: "step_0",
            type: "video",
            prompt: "test",
        };
        applyVideoFallback(step0, "video", attachments, 0, 3);
        expect(step0.firstFrameNodeId).toBe("img_1");
        expect(step0.referenceNodeIds).toBeUndefined();

        const step1: GenerationStep = {
            id: "step_1",
            type: "video",
            prompt: "test",
        };
        applyVideoFallback(step1, "video", attachments, 1, 3);
        expect(step1.firstFrameNodeId).toBe("img_2");

        const step2: GenerationStep = {
            id: "step_2",
            type: "video",
            prompt: "test",
        };
        applyVideoFallback(step2, "video", attachments, 2, 3);
        expect(step2.firstFrameNodeId).toBe("img_3");
    });

    it("should do nothing if not video", () => {
        const step: GenerationStep = {
            id: "step_0",
            type: "image",
            prompt: "test",
        };
        const attachments: ChatAttachment[] = [
            { nodeId: "img_1", label: "Image 1", type: "canvas-image" },
        ];

        applyVideoFallback(step, "image", attachments, 0, 1);

        expect(step.firstFrameNodeId).toBeUndefined();
    });

    it("should do nothing if firstFrameNodeId already set", () => {
        const step: GenerationStep = {
            id: "step_0",
            type: "video",
            prompt: "test",
            firstFrameNodeId: "img_existing",
        };
        const attachments: ChatAttachment[] = [
            { nodeId: "img_1", label: "Image 1", type: "canvas-image" },
        ];

        applyVideoFallback(step, "video", attachments, 0, 1);

        expect(step.firstFrameNodeId).toBe("img_existing");
    });
});
