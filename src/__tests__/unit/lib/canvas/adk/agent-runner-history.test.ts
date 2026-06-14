/**
 * Regression test for session history reseed.
 *
 * Root cause: CanvasAgentRunner uses InMemorySessionService. Any server restart,
 * HMR reload, or cold start wipes the in-memory session, so turn 2+ sees an empty
 * session and the LLM receives no prior context.
 *
 * Fix: on each request, if the ADK session is empty but input.history is non-empty,
 * reseed the session from persisted ChatMessage history before calling runAsync.
 *
 * Strategy: our reseed uses msg.id as the event's invocationId. Filtering the
 * appendEvent spy on known message IDs isolates reseed calls from ADK-internal calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Event } from "@google/adk";

vi.mock("@/lib/config", () => ({
    config: { PROJECT_ID: "test-project", LOCATION: "us-central1" },
}));
vi.mock("@/app/logger", () => ({
    default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/canvas/agent/prompt-engineer", () => ({
    PromptEngineer: class {
        enrichSteps = vi.fn(async (steps: unknown[]) => steps);
    },
}));

vi.mock("@google/adk", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@google/adk")>();

    class MockRunner {
        runAsync(): AsyncGenerator<Event> {
            return (async function* () {
                yield {
                    id: "evt_done",
                    invocationId: "inv_new",
                    timestamp: Date.now(),
                    actions: { stateDelta: {}, artifactDelta: {} },
                    author: "Director",
                    content: {
                        role: "model",
                        parts: [{ text: "Understood." }],
                    },
                    turnComplete: true,
                } as Event;
            })();
        }
    }

    return {
        ...actual,
        Runner: MockRunner,
        loadAllSkillsInDir: vi.fn().mockResolvedValue({}),
    };
});

import { InMemorySessionService, createEvent } from "@google/adk";
import { CanvasAgentRunner } from "@/lib/canvas/agent/agent-runner";
import type { ChatMessage, AgentInput } from "@/lib/canvas/types";

function makeInput(message: string, history: ChatMessage[] = []): AgentInput {
    return {
        message,
        mode: "auto",
        history,
        canvasNodes: [],
        attachments: [],
        userId: "user-test",
        canvasId: "canvas-test",
        sessionId: "session-test",
    };
}

function makeMessage(
    role: "user" | "assistant",
    content: string,
    id = crypto.randomUUID(),
): ChatMessage {
    return { id, role, content, createdAt: new Date().toISOString() };
}

async function drain(runner: CanvasAgentRunner, input: AgentInput) {
    const events = [];
    for await (const e of runner.stream(input)) events.push(e);
    return events;
}

describe("CanvasAgentRunner — session history reseed", () => {
    let sessionService: InMemorySessionService;
    let runner: CanvasAgentRunner;

    beforeEach(() => {
        sessionService = new InMemorySessionService();
        runner = new CanvasAgentRunner({ sessionService });
    });

    it("does not reseed when history is empty", async () => {
        const appendSpy = vi.spyOn(sessionService, "appendEvent");
        await drain(runner, makeInput("hello", []));

        // No history IDs to match — reseed loop should not run
        const noIds: string[] = [];
        const reseedCalls = appendSpy.mock.calls.filter(([req]) =>
            noIds.includes(req.event.invocationId),
        );
        expect(reseedCalls).toHaveLength(0);
    });

    it("seeds all history messages into an empty session before runAsync", async () => {
        const msgIds = ["msg-1", "msg-2", "msg-3"];
        const history: ChatMessage[] = [
            makeMessage("user", "I want a Coca-Cola ad", msgIds[0]),
            makeMessage("assistant", "What aspect ratio?", msgIds[1]),
            makeMessage("user", "9:16 vertical", msgIds[2]),
        ];

        const appendSpy = vi.spyOn(sessionService, "appendEvent");
        await drain(runner, makeInput("Make it now", history));

        const reseedCalls = appendSpy.mock.calls.filter(([req]) =>
            msgIds.includes(req.event.invocationId),
        );
        expect(reseedCalls).toHaveLength(3);
    });

    it("sets correct author and content role for user messages", async () => {
        const history = [makeMessage("user", "User question", "msg-u")];

        const appendSpy = vi.spyOn(sessionService, "appendEvent");
        await drain(runner, makeInput("continue", history));

        const call = appendSpy.mock.calls.find(
            ([req]) => req.event.invocationId === "msg-u",
        );
        expect(call?.[0].event.author).toBe("user");
        expect(call?.[0].event.content?.role).toBe("user");
        expect(call?.[0].event.content?.parts?.[0]).toMatchObject({
            text: "User question",
        });
    });

    it("sets correct author and content role for assistant messages", async () => {
        const history = [makeMessage("assistant", "Agent answer", "msg-a")];

        const appendSpy = vi.spyOn(sessionService, "appendEvent");
        await drain(runner, makeInput("continue", history));

        const call = appendSpy.mock.calls.find(
            ([req]) => req.event.invocationId === "msg-a",
        );
        expect(call?.[0].event.author).toBe("Director");
        expect(call?.[0].event.content?.role).toBe("model");
        expect(call?.[0].event.content?.parts?.[0]).toMatchObject({
            text: "Agent answer",
        });
    });

    it("skips messages with empty or whitespace-only content", async () => {
        const msgIds = ["msg-valid", "msg-empty", "msg-ws"];
        const history: ChatMessage[] = [
            makeMessage("user", "Valid message", msgIds[0]),
            makeMessage("assistant", "", msgIds[1]),
            makeMessage("user", "   ", msgIds[2]),
        ];

        const appendSpy = vi.spyOn(sessionService, "appendEvent");
        await drain(runner, makeInput("next", history));

        const reseedCalls = appendSpy.mock.calls.filter(([req]) =>
            msgIds.includes(req.event.invocationId),
        );
        // Only the "Valid message" entry is seeded; empty and whitespace-only are skipped
        expect(reseedCalls).toHaveLength(1);
        expect(reseedCalls[0][0].event.invocationId).toBe("msg-valid");
    });

    it("does not reseed when the session already has events", async () => {
        // Pre-populate the session with a prior event to simulate an active session
        const existingSession = await sessionService.createSession({
            appName: "flowcraft-canvas",
            userId: "user-test",
            sessionId: "user-test:session-test",
        });
        const priorEvent = createEvent({
            invocationId: "prior-inv",
            author: "user",
            content: { role: "user", parts: [{ text: "prior turn" }] },
        });
        await sessionService.appendEvent({
            session: existingSession,
            event: priorEvent,
        });

        const msgIds = ["msg-new"];
        const history = [makeMessage("user", "First turn", msgIds[0])];

        const appendSpy = vi.spyOn(sessionService, "appendEvent");
        await drain(runner, makeInput("Second", history));

        // Session already had events → reseed must not fire
        const reseedCalls = appendSpy.mock.calls.filter(([req]) =>
            msgIds.includes(req.event.invocationId),
        );
        expect(reseedCalls).toHaveLength(0);
    });
});
