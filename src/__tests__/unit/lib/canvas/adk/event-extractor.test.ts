import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Event } from "@google/adk";

// Mock @google/adk before importing the extractor so getFunctionCalls is under test control.
vi.mock("@google/adk", () => ({
    getFunctionCalls: vi.fn(),
}));

// Mock logger to suppress noise in test output.
vi.mock("@/app/logger", () => ({
    default: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Mock step-mapper — we're testing the extractor's routing, not step construction.
vi.mock("@/lib/canvas/agent/step-mapper", () => ({
    mapSimpleSteps: vi.fn(() => [{ id: "step-1", type: "image" }]),
    mapPlanNodesToSteps: vi.fn(() => [{ id: "step-2", type: "image" }]),
}));

import { getFunctionCalls } from "@google/adk";
import { extractAgentEvents } from "@/lib/canvas/agent/event-extractor";

const mockGetFunctionCalls = vi.mocked(getFunctionCalls);

async function collect(gen: AsyncGenerator<unknown>): Promise<unknown[]> {
    const results: unknown[] = [];
    for await (const item of gen) results.push(item);
    return results;
}

async function* makeStream(...events: Partial<Event>[]): AsyncIterable<Event> {
    for (const e of events) yield e as Event;
}

beforeEach(() => {
    mockGetFunctionCalls.mockReturnValue([]);
});

describe("extractAgentEvents", () => {
    it("empty stream yields only done", async () => {
        const events = await collect(extractAgentEvents(makeStream(), [], []));
        expect(events).toEqual([{ type: "done" }]);
    });

    it("partial events are silently dropped — no text or thought yielded", async () => {
        mockGetFunctionCalls.mockReturnValue([]);
        const event: Partial<Event> = {
            author: "model",
            partial: true,
            content: { parts: [{ text: "hello" }], role: "model" },
        };
        const events = await collect(
            extractAgentEvents(makeStream(event), [], []),
        );
        expect(events).toEqual([{ type: "done" }]);
    });

    it("text is suppressed when function calls are present", async () => {
        mockGetFunctionCalls.mockReturnValue([
            { name: "plan_image_generation", args: { steps: [] } },
        ]);
        const event: Partial<Event> = {
            author: "model",
            partial: false,
            content: {
                parts: [
                    { text: "some text" },
                    {
                        functionCall: {
                            name: "plan_image_generation",
                            args: {},
                        },
                    },
                ],
                role: "model",
            },
        };
        const events = await collect(
            extractAgentEvents(makeStream(event), [], []),
        );
        const types = events.map((e) => (e as { type: string }).type);
        expect(types).not.toContain("text");
    });

    it("thought parts are yielded from non-partial events", async () => {
        mockGetFunctionCalls.mockReturnValue([]);
        const event: Partial<Event> = {
            author: "model",
            partial: false,
            content: {
                parts: [{ text: "thinking...", thought: true }],
                role: "model",
            },
        };
        const events = await collect(
            extractAgentEvents(makeStream(event), [], []),
        );
        expect(events).toContainEqual({
            type: "thought",
            delta: "thinking...",
        });
    });

    it("suggest_actions is capped at 3 entries", async () => {
        const actions = [
            { label: "A", prompt: "a" },
            { label: "B", prompt: "b" },
            { label: "C", prompt: "c" },
            { label: "D", prompt: "d" },
            { label: "E", prompt: "e" },
        ];
        mockGetFunctionCalls.mockReturnValue([
            { name: "suggest_actions", args: { actions } },
        ]);
        const events = await collect(
            extractAgentEvents(makeStream({}), [], []),
        );
        const actionsEvent = events.find(
            (e) => (e as { type: string }).type === "actions",
        ) as { type: string; actions: unknown[] } | undefined;
        expect(actionsEvent?.actions).toHaveLength(3);
    });

    it("suggest_actions fires only once even if called twice in the same stream", async () => {
        const actions = [{ label: "A", prompt: "a" }];
        mockGetFunctionCalls
            .mockReturnValueOnce([
                { name: "suggest_actions", args: { actions } },
            ])
            .mockReturnValueOnce([
                { name: "suggest_actions", args: { actions } },
            ]);
        const events = await collect(
            extractAgentEvents(makeStream({}, {}), [], []),
        );
        const actionEvents = events.filter(
            (e) => (e as { type: string }).type === "actions",
        );
        expect(actionEvents).toHaveLength(1);
    });

    it("text_nodes event precedes plan in output ordering", async () => {
        mockGetFunctionCalls
            .mockReturnValueOnce([
                {
                    name: "plan_text_nodes",
                    args: {
                        nodes: [{ id: "n1", title: "T", content: "C" }],
                    },
                },
            ])
            .mockReturnValueOnce([
                {
                    name: "plan_image_generation",
                    args: {
                        steps: [
                            {
                                id: "s1",
                                type: "image",
                                prompt: "p",
                                label: "l",
                            },
                        ],
                    },
                },
            ]);
        const events = await collect(
            extractAgentEvents(makeStream({}, {}), [], []),
        );
        const types = events.map((e) => (e as { type: string }).type);
        const textNodesIdx = types.indexOf("text_nodes");
        const planIdx = types.indexOf("plan");
        expect(textNodesIdx).toBeGreaterThanOrEqual(0);
        expect(planIdx).toBeGreaterThanOrEqual(0);
        expect(textNodesIdx).toBeLessThan(planIdx);
    });

    it("error event with errorCode only uses code as message", async () => {
        const event = { errorCode: "RESOURCE_EXHAUSTED" } as Partial<Event>;
        const events = await collect(
            extractAgentEvents(makeStream(event), [], []),
        );
        expect(events).toContainEqual({
            type: "error",
            message: "RESOURCE_EXHAUSTED",
        });
    });
});
