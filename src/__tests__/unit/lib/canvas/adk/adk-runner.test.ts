import { describe, it, expect } from "vitest";
import type { Event } from "@google/adk";
import { extractAgentEvents } from "@/lib/canvas/agent/agent-runner";
import type { GenerationStep, CanvasNode } from "@/lib/canvas/types";

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
        const canvasNodes: CanvasNode[] = [
            {
                id: "valid_node",
                type: "canvas-image",
                position: { x: 0, y: 0 },
                data: {
                    type: "canvas-image",
                    label: "Valid Node",
                    sourceUrl: "gs://mock/source.png",
                    mimeType: "image/png",
                    status: "ready",
                    width: 100,
                    height: 100,
                },
            },
        ];
        const adkEvents = [
            makeFunctionCallEvent("plan_image_generation", { steps }),
        ];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), canvasNodes, []),
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

    it("emits agent_action 'Writing scenario' before text_nodes", async () => {
        const nodes = [{ id: "s", title: "Scenario", content: "Shot 01..." }];
        const adkEvents = [makeFunctionCallEvent("plan_text_nodes", { nodes })];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), [], []),
        );
        const actionIdx = events.findIndex(
            (e) =>
                e.type === "agent_action" &&
                (e as { type: "agent_action"; label: string }).label ===
                    "Writing scenario",
        );
        const textNodesIdx = events.findIndex((e) => e.type === "text_nodes");
        expect(actionIdx).toBeGreaterThanOrEqual(0);
        expect(textNodesIdx).toBeGreaterThanOrEqual(0);
        expect(actionIdx).toBeLessThan(textNodesIdx);
    });

    it("emits text_nodes event from plan_text_nodes call", async () => {
        const nodes = [
            {
                id: "scenario_01",
                title: "Lumino — Trailer Architecture",
                content: "# Lumino\n\nShot 01 — The Watcher...",
                format: "scenario",
            },
        ];
        const adkEvents = [makeFunctionCallEvent("plan_text_nodes", { nodes })];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), [], []),
        );
        const textNodesEvent = events.find((e) => e.type === "text_nodes");
        expect(textNodesEvent).toMatchObject({
            type: "text_nodes",
            nodes: [
                { id: "scenario_01", title: "Lumino — Trailer Architecture" },
            ],
        });
    });

    it("emits text_nodes before plan when both are in the same stream", async () => {
        const nodes = [{ id: "s", title: "Scenario", content: "Shot 01..." }];
        const steps: GenerationStep[] = [
            { id: "step_0", type: "image", prompt: "A cat", label: "Cat" },
        ];
        const adkEvents = [
            makeFunctionCallEvent("plan_text_nodes", { nodes }),
            makeFunctionCallEvent("plan_image_generation", { steps }),
        ];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), [], []),
        );
        const textNodesIdx = events.findIndex((e) => e.type === "text_nodes");
        const planIdx = events.findIndex((e) => e.type === "plan");
        expect(textNodesIdx).toBeGreaterThanOrEqual(0);
        expect(planIdx).toBeGreaterThanOrEqual(0);
        expect(textNodesIdx).toBeLessThan(planIdx);
    });

    it("always ends with done event", async () => {
        const events = await collect(
            extractAgentEvents(asAsyncIter([]), [], []),
        );
        expect(events[events.length - 1]).toEqual({ type: "done" });
    });

    it("coerces string duration enum to number in plan step", async () => {
        // The tool schema uses z.enum(["4","6","8"]) — args arrive as strings.
        const steps = [
            { id: "s", type: "video", prompt: "x", label: "x", duration: "6" },
        ];
        const events = await collect(
            extractAgentEvents(
                asAsyncIter([
                    makeFunctionCallEvent("plan_video_generation", { steps }),
                ]),
                [],
                [],
            ),
        );
        const planEvent = events.find((e) => e.type === "plan");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((planEvent as any)?.plan?.steps?.[0]?.duration).toBe(6);
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
