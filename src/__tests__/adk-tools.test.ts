import { describe, it, expect } from "vitest";
import {
    planImageGenerationTool,
    planVideoGenerationTool,
    suggestActionsTool,
} from "../lib/canvas/adk/tools";

describe("planImageGenerationTool", () => {
    it("validates and returns image steps", async () => {
        const steps = [
            {
                id: "step_0",
                type: "image" as const,
                prompt: "A cat",
                label: "Cute Cat",
            },
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (planImageGenerationTool as any).runAsync({
            args: { steps },
            toolContext: undefined,
        });
        expect(result).toEqual({ steps });
    });

    it("accepts optional fields on image steps", async () => {
        const steps = [
            {
                id: "step_0",
                type: "image" as const,
                prompt: "A sunset",
                label: "Sunset",
                aspectRatio: "16:9",
                resolution: "2K",
                model: "imagen-4.0",
                referenceNodeIds: ["node_1"],
                dependsOn: [],
            },
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (planImageGenerationTool as any).runAsync({
            args: { steps },
            toolContext: undefined,
        });
        expect(result).toEqual({ steps });
    });
});

describe("planVideoGenerationTool", () => {
    it("validates and returns video steps", async () => {
        const steps = [
            {
                id: "step_0",
                type: "video" as const,
                prompt: "A flying bird",
                label: "Flying Bird",
                duration: 6,
                generateAudio: false,
            },
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (planVideoGenerationTool as any).runAsync({
            args: { steps },
            toolContext: undefined,
        });
        expect(result).toEqual({ steps });
    });

    it("accepts firstFrameNodeId and lastFrameNodeId", async () => {
        const steps = [
            {
                id: "step_0",
                type: "video" as const,
                prompt: "Animate this portrait",
                label: "Portrait Video",
                firstFrameNodeId: "canvas_img_1",
                lastFrameNodeId: "canvas_img_2",
            },
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (planVideoGenerationTool as any).runAsync({
            args: { steps },
            toolContext: undefined,
        });
        expect(result).toEqual({ steps });
    });
});

describe("suggestActionsTool", () => {
    it("validates and returns actions", async () => {
        const actions = [
            { label: "Try portrait", prompt: "Make it portrait format" },
            { label: "Add animals", prompt: "Add some animals to the scene" },
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (suggestActionsTool as any).runAsync({
            args: { actions },
            toolContext: undefined,
        });
        expect(result).toEqual({ actions });
    });
});
