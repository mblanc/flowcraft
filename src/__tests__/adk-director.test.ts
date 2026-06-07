import { describe, it, expect, vi } from "vitest";
import type { Event } from "@google/adk";

vi.mock("@/lib/config", () => ({
    config: { PROJECT_ID: "test-project", LOCATION: "us-central1" },
}));
import {
    CanvasAgentRunner,
    extractAgentEvents,
} from "../lib/canvas/adk/runner";
import type { PlanNode, PlanEdge } from "../lib/canvas/types";
import { MODELS } from "../lib/constants";

function makeFunctionCallEvent(name: string, args: unknown): Event {
    return {
        id: "evt_1",
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

describe("Director agent (buildAgentB)", () => {
    it("builds an agent named Director", () => {
        const runner = new CanvasAgentRunner();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const agent = (runner as any).buildAgentB(
            MODELS.TEXT.GEMINI_3_5_FLASH,
            "test instruction",
        );
        expect(agent.name).toBe("Director");
    });

    it("includes planProductionTool in Director tools", () => {
        const runner = new CanvasAgentRunner();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const agent = (runner as any).buildAgentB(
            MODELS.TEXT.GEMINI_3_5_FLASH,
            "test instruction",
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolNames = (agent.tools as any[]).flatMap((t: any) =>
            t.name ? [t.name] : [],
        );
        expect(toolNames).toContain("plan_production");
    });

    it("includes suggestActionsTool in Director tools", () => {
        const runner = new CanvasAgentRunner();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const agent = (runner as any).buildAgentB(
            MODELS.TEXT.GEMINI_3_5_FLASH,
            "test instruction",
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolNames = (agent.tools as any[]).flatMap((t: any) =>
            t.name ? [t.name] : [],
        );
        expect(toolNames).toContain("suggest_actions");
    });

    it("includes a SkillToolset in Director tools", () => {
        const runner = new CanvasAgentRunner();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const agent = (runner as any).buildAgentB(
            MODELS.TEXT.GEMINI_3_5_FLASH,
            "test instruction",
        );
        // SkillToolset has a `skills` property; other tools have `name`
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasSkillToolset = (agent.tools as any[]).some(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (t: any) => t.skills !== undefined,
        );
        expect(hasSkillToolset).toBe(true);
    });

    it("leaves buildAgentA returning CanvasAgentA", () => {
        const runner = new CanvasAgentRunner();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const agent = (runner as any).buildAgentA(
            MODELS.TEXT.GEMINI_3_5_FLASH,
            "test instruction",
        );
        expect(agent.name).toBe("CanvasAgentA");
    });
});

describe("extractAgentEvents — plan_production", () => {
    it("maps t2i and i2i nodes to image GenerationSteps", async () => {
        const nodes: PlanNode[] = [
            { id: "n1", operation: "t2i", promptIntent: "A forest landscape" },
            { id: "n2", operation: "i2i", promptIntent: "Edit to be darker" },
        ];
        const edges: PlanEdge[] = [];
        const adkEvents = [
            makeFunctionCallEvent("plan_production", { nodes, edges }),
        ];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), [], []),
        );
        const planEvent = events.find((e) => e.type === "plan");
        expect(planEvent).toBeDefined();
        expect(planEvent).toMatchObject({
            type: "plan",
            plan: {
                steps: expect.arrayContaining([
                    expect.objectContaining({ type: "image" }),
                    expect.objectContaining({ type: "image" }),
                ]),
            },
        });
    });

    it("maps t2v, i2v, i2v2 nodes to video GenerationSteps", async () => {
        const nodes: PlanNode[] = [
            { id: "n1", operation: "t2v", promptIntent: "Stormy ocean" },
            { id: "n2", operation: "i2v", promptIntent: "Animate it" },
            { id: "n3", operation: "i2v2", promptIntent: "Morph two images" },
        ];
        const adkEvents = [
            makeFunctionCallEvent("plan_production", {
                nodes,
                edges: [],
            }),
        ];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), [], []),
        );
        const planEvent = events.find((e) => e.type === "plan");
        expect(planEvent).toMatchObject({
            type: "plan",
            plan: {
                steps: expect.arrayContaining([
                    expect.objectContaining({ type: "video" }),
                    expect.objectContaining({ type: "video" }),
                    expect.objectContaining({ type: "video" }),
                ]),
            },
        });
    });

    it("uses promptIntent as the prompt when no prompt is set", async () => {
        const nodes: PlanNode[] = [
            { id: "n1", operation: "t2i", promptIntent: "A golden retriever" },
        ];
        const adkEvents = [
            makeFunctionCallEvent("plan_production", { nodes, edges: [] }),
        ];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), [], []),
        );
        const planEvent = events.find((e) => e.type === "plan");
        expect(planEvent).toMatchObject({
            type: "plan",
            plan: {
                steps: [
                    expect.objectContaining({ prompt: "A golden retriever" }),
                ],
            },
        });
    });

    it("uses engineered prompt when present", async () => {
        const nodes: PlanNode[] = [
            {
                id: "n1",
                operation: "t2i",
                promptIntent: "A golden retriever",
                prompt: "A fluffy golden retriever, studio light, f/1.8",
            },
        ];
        const adkEvents = [
            makeFunctionCallEvent("plan_production", { nodes, edges: [] }),
        ];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), [], []),
        );
        const planEvent = events.find((e) => e.type === "plan");
        expect(planEvent).toMatchObject({
            type: "plan",
            plan: {
                steps: [
                    expect.objectContaining({
                        prompt: "A fluffy golden retriever, studio light, f/1.8",
                    }),
                ],
            },
        });
    });

    it("skips unsupported operations (t2s, concat, etc.) with no crash", async () => {
        const nodes: PlanNode[] = [
            { id: "n1", operation: "t2i", promptIntent: "An image" },
            { id: "n2", operation: "t2s", promptIntent: "Narrate" },
            { id: "n3", operation: "concat", promptIntent: "Join clips" },
        ];
        const adkEvents = [
            makeFunctionCallEvent("plan_production", { nodes, edges: [] }),
        ];
        const events = await collect(
            extractAgentEvents(asAsyncIter(adkEvents), [], []),
        );
        const planEvent = events.find((e) => e.type === "plan");
        // only the t2i node maps to a step
        expect(planEvent).toMatchObject({
            type: "plan",
            plan: { steps: [expect.objectContaining({ type: "image" })] },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((planEvent as any).plan.steps).toHaveLength(1);
    });
});
