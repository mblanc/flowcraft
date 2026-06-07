import { describe, it, expect } from "vitest";
import type { Event } from "@google/adk";
import { extractAgentEvents } from "../lib/canvas/adk/runner";
import type { GenerationStep } from "../lib/canvas/types";

function makeTextEvent(text: string, partial = false): Event {
    return {
        id: "evt_1",
        invocationId: "inv_1",
        timestamp: Date.now(),
        actions: { stateDelta: {}, artifactDelta: {} },
        content: { role: "model", parts: [{ text }] },
        partial,
        turnComplete: !partial,
    } as Event;
}

function makeFunctionCallEvent(name: string, args: unknown): Event {
    return {
        id: "evt_2",
        invocationId: "inv_1",
        timestamp: Date.now(),
        actions: { stateDelta: {}, artifactDelta: {} },
        content: {
            role: "model",
            parts: [{ functionCall: { name, args } }],
        },
    } as Event;
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
    const items: T[] = [];
    for await (const item of gen) items.push(item);
    return items;
}

async function* asAsyncIter<T>(items: T[]): AsyncGenerator<T> {
    for (const item of items) yield item;
}

describe("extractAgentEvents", () => {
    it("emits text delta for a final text event", async () => {
        const adkEvents = [makeTextEvent("I'll generate a cat image.", false)];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), [], []),
        );
        expect(events).toContainEqual({
            type: "text",
            delta: "I'll generate a cat image.",
        });
        expect(events).toContainEqual({ type: "done" });
    });

    it("emits plan event from plan_image_generation call", async () => {
        const steps: GenerationStep[] = [
            { id: "step_0", type: "image", prompt: "A cat", label: "Cat" },
        ];
        const adkEvents = [
            makeTextEvent("Generating an image.", false),
            makeFunctionCallEvent("plan_image_generation", { steps }),
        ];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), [], []),
        );
        const planEvent = events.find((e) => e.type === "plan");
        expect(planEvent).toBeDefined();
        expect(planEvent).toMatchObject({
            type: "plan",
            plan: { steps: [{ id: "step_0", type: "image" }] },
        });
    });

    it("emits plan event from plan_video_generation call", async () => {
        const steps: GenerationStep[] = [
            {
                id: "step_0",
                type: "video",
                prompt: "Flying bird",
                label: "Bird",
                duration: 6,
            },
        ];
        const adkEvents = [
            makeFunctionCallEvent("plan_video_generation", { steps }),
            makeTextEvent("Generating a video.", false),
        ];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), [], []),
        );
        const planEvent = events.find((e) => e.type === "plan");
        expect(planEvent).toMatchObject({
            type: "plan",
            plan: { steps: [{ id: "step_0", type: "video" }] },
        });
    });

    it("emits actions event from suggest_actions call", async () => {
        const actions = [{ label: "Try portrait", prompt: "Make it portrait" }];
        const adkEvents = [
            makeTextEvent("Done.", false),
            makeFunctionCallEvent("suggest_actions", { actions }),
        ];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), [], []),
        );
        const actionsEvent = events.find((e) => e.type === "actions");
        expect(actionsEvent).toMatchObject({
            type: "actions",
            actions: [{ id: "1", label: "Try portrait" }],
        });
    });

    it("filters hallucinated referenceNodeIds not in canvasNodes", async () => {
        const steps: GenerationStep[] = [
            {
                id: "step_0",
                type: "image",
                prompt: "Edit this",
                label: "Edited",
                referenceNodeIds: ["valid_node", "hallucinated_node"],
            },
        ];
        const canvasNodeIds = ["valid_node"];
        const adkEvents = [
            makeFunctionCallEvent("plan_image_generation", { steps }),
        ];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), canvasNodeIds, []),
        );
        const planEvent = events.find((e) => e.type === "plan");
        expect(planEvent).toMatchObject({
            type: "plan",
            plan: { steps: [{ referenceNodeIds: ["valid_node"] }] },
        });
    });

    it("applies video fallback when single attachment and no frame set", async () => {
        const steps: GenerationStep[] = [
            {
                id: "step_0",
                type: "video",
                prompt: "Animate this",
                label: "Video",
            },
        ];
        const attachments = [
            {
                nodeId: "img_1",
                label: "Image 1",
                type: "canvas-image" as const,
            },
        ];
        const adkEvents = [
            makeFunctionCallEvent("plan_video_generation", { steps }),
        ];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), [], attachments),
        );
        const planEvent = events.find((e) => e.type === "plan");
        expect(planEvent).toMatchObject({
            type: "plan",
            plan: {
                steps: [{ firstFrameNodeId: "img_1" }],
            },
        });
    });

    it("always ends with done event", async () => {
        const events = await collect(
            extractAgentEvents(asAsyncIter([]), [], []),
        );
        expect(events[events.length - 1]).toEqual({ type: "done" });
    });

    it("merges image and video steps into a single plan", async () => {
        const imgSteps: GenerationStep[] = [
            { id: "step_0", type: "image", prompt: "Cat", label: "Cat" },
        ];
        const vidSteps: GenerationStep[] = [
            {
                id: "step_1",
                type: "video",
                prompt: "Animate cat",
                label: "Cat Video",
                dependsOn: ["step_0"],
            },
        ];
        const adkEvents = [
            makeFunctionCallEvent("plan_image_generation", { steps: imgSteps }),
            makeFunctionCallEvent("plan_video_generation", { steps: vidSteps }),
        ];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), [], []),
        );
        const planEvent = events.find((e) => e.type === "plan");
        expect(planEvent).toMatchObject({
            type: "plan",
            plan: {
                steps: expect.arrayContaining([
                    expect.objectContaining({ id: "step_0", type: "image" }),
                    expect.objectContaining({ id: "step_1", type: "video" }),
                ]),
            },
        });
    });
});
