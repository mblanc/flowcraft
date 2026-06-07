import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/canvas.service", () => ({
    canvasService: { getCanvas: vi.fn() },
}));
vi.mock("@/lib/services/style.service", () => ({
    styleService: { getStyle: vi.fn() },
}));
vi.mock("@/lib/canvas/generation", () => ({ executePlan: vi.fn() }));
vi.mock("@/app/logger", () => ({
    default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { auth } from "@/auth";
import { canvasService } from "@/lib/services/canvas.service";
import { styleService } from "@/lib/services/style.service";
import { executePlan } from "@/lib/canvas/generation";
import { POST } from "@/app/api/canvases/[id]/execute-plan/route";

const mockAuth = vi.mocked(auth);
const mockGetCanvas = vi.mocked(canvasService.getCanvas);
const mockGetStyle = vi.mocked(styleService.getStyle);
const mockExecutePlan = vi.mocked(executePlan);

function makeRequest(body: unknown, canvasId = "canvas-1"): NextRequest {
    return new NextRequest(
        `http://localhost/api/canvases/${canvasId}/execute-plan`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        },
    );
}

const params = Promise.resolve({ id: "canvas-1" });

const validPlan = {
    steps: [{ id: "s1", type: "image", prompt: "a cat", label: "Cat" }],
};

const mockCanvas = {
    id: "canvas-1",
    userId: "user-1",
    name: "My Canvas",
    nodes: [],
    messages: [],
    activeStyleId: undefined,
};

async function readSSE(
    response: Response,
): Promise<{ event: string; data: unknown }[]> {
    const text = await response.text();
    return text
        .split("\n\n")
        .filter(Boolean)
        .map((chunk) => {
            const lines = chunk.split("\n");
            const event =
                lines
                    .find((l) => l.startsWith("event:"))
                    ?.slice(7)
                    .trim() ?? "";
            const dataLine =
                lines
                    .find((l) => l.startsWith("data:"))
                    ?.slice(6)
                    .trim() ?? "{}";
            return { event, data: JSON.parse(dataLine) };
        });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetCanvas.mockResolvedValue(mockCanvas as never);
    mockExecutePlan.mockReturnValue((async function* () {})() as never);
});

describe("POST /api/canvases/[id]/execute-plan", () => {
    describe("auth", () => {
        it("returns 401 when unauthenticated", async () => {
            mockAuth.mockResolvedValue(null as never);
            const res = await POST(
                makeRequest({ plan: validPlan, messageId: "m1" }),
                { params },
            );
            expect(res.status).toBe(401);
        });

        it("returns 401 when session has no user id", async () => {
            mockAuth.mockResolvedValue({ user: {} } as never);
            const res = await POST(
                makeRequest({ plan: validPlan, messageId: "m1" }),
                { params },
            );
            expect(res.status).toBe(401);
        });
    });

    describe("request validation", () => {
        it("returns 400 for malformed JSON", async () => {
            const req = new NextRequest(
                "http://localhost/api/canvases/canvas-1/execute-plan",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: "not-json",
                },
            );
            const res = await POST(req, { params });
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toBe("Invalid JSON body");
        });

        it("returns 400 when plan.steps is missing", async () => {
            const res = await POST(makeRequest({ plan: {}, messageId: "m1" }), {
                params,
            });
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toBe("plan.steps is required");
        });

        it("returns 400 when plan.steps is not an array", async () => {
            const res = await POST(
                makeRequest({ plan: { steps: "bad" }, messageId: "m1" }),
                { params },
            );
            expect(res.status).toBe(400);
        });

        it("returns 400 when plan has more than 20 steps", async () => {
            const steps = Array.from({ length: 21 }, (_, i) => ({
                id: `s${i}`,
                type: "image",
                prompt: "x",
                label: "x",
            }));
            const res = await POST(
                makeRequest({ plan: { steps }, messageId: "m1" }),
                { params },
            );
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toBe("Plan exceeds maximum of 20 steps");
        });

        it("accepts a plan with exactly 20 steps", async () => {
            const steps = Array.from({ length: 20 }, (_, i) => ({
                id: `s${i}`,
                type: "image",
                prompt: "x",
                label: "x",
            }));
            const res = await POST(
                makeRequest({ plan: { steps }, messageId: "m1" }),
                { params },
            );
            expect(res.status).toBe(200);
        });
    });

    describe("canvas access", () => {
        it("returns 404 when canvas is not found", async () => {
            mockGetCanvas.mockRejectedValue(new Error("Canvas not found"));
            const res = await POST(
                makeRequest({ plan: validPlan, messageId: "m1" }),
                { params },
            );
            expect(res.status).toBe(404);
        });

        it("returns 403 when canvas belongs to another user", async () => {
            mockGetCanvas.mockRejectedValue(new Error("Unauthorized"));
            const res = await POST(
                makeRequest({ plan: validPlan, messageId: "m1" }),
                { params },
            );
            expect(res.status).toBe(403);
        });

        it("returns 500 on unexpected canvas service error", async () => {
            mockGetCanvas.mockRejectedValue(new Error("DB connection failed"));
            const res = await POST(
                makeRequest({ plan: validPlan, messageId: "m1" }),
                { params },
            );
            expect(res.status).toBe(500);
        });
    });

    describe("style resolution", () => {
        it("uses a template style when styleId matches a template", async () => {
            const res = await POST(
                makeRequest({
                    plan: validPlan,
                    messageId: "m1",
                    styleId: "template-cinematic",
                }),
                { params },
            );
            expect(res.status).toBe(200);
            expect(mockGetStyle).not.toHaveBeenCalled();
        });

        it("fetches a custom style from the style service", async () => {
            mockGetStyle.mockResolvedValue({
                name: "My Style",
                content: "dark mood",
            } as never);
            const res = await POST(
                makeRequest({
                    plan: validPlan,
                    messageId: "m1",
                    styleId: "custom-style-id",
                }),
                { params },
            );
            expect(res.status).toBe(200);
            expect(mockGetStyle).toHaveBeenCalledWith(
                "custom-style-id",
                "user-1",
            );
        });

        it("continues without style when custom style fetch fails", async () => {
            mockGetStyle.mockRejectedValue(new Error("Not found"));
            const res = await POST(
                makeRequest({
                    plan: validPlan,
                    messageId: "m1",
                    styleId: "missing-style",
                }),
                { params },
            );
            expect(res.status).toBe(200);
        });
    });

    describe("SSE streaming", () => {
        it("returns text/event-stream response", async () => {
            const res = await POST(
                makeRequest({ plan: validPlan, messageId: "m1" }),
                { params },
            );
            expect(res.headers.get("Content-Type")).toBe("text/event-stream");
        });

        it("emits step_start, step_done, and done events", async () => {
            const node = {
                id: "node-1",
                type: "canvas-image",
                label: "Cat",
                sourceUrl: "gs://bucket/cat.png",
                prompt: "a cat",
            };
            mockExecutePlan.mockReturnValue(
                (async function* () {
                    yield { type: "step_start" as const, stepId: "s1" };
                    yield { type: "step_done" as const, stepId: "s1", node };
                })() as never,
            );

            const res = await POST(
                makeRequest({ plan: validPlan, messageId: "m1" }),
                { params },
            );
            const events = await readSSE(res);

            expect(events[0]).toEqual({
                event: "step_start",
                data: { stepId: "s1" },
            });
            expect(events[1]).toEqual({
                event: "step_done",
                data: { stepId: "s1", node },
            });
            expect(events.at(-1)?.event).toBe("done");
        });

        it("emits step_error events when a step fails", async () => {
            mockExecutePlan.mockReturnValue(
                (async function* () {
                    yield {
                        type: "step_error" as const,
                        stepId: "s1",
                        message: "Generation failed",
                    };
                })() as never,
            );

            const res = await POST(
                makeRequest({ plan: validPlan, messageId: "m1" }),
                { params },
            );
            const events = await readSSE(res);

            expect(events[0]).toEqual({
                event: "step_error",
                data: { stepId: "s1", message: "Generation failed" },
            });
            expect(events.at(-1)?.event).toBe("done");
        });

        it("emits error and done events when executePlan throws", async () => {
            mockExecutePlan.mockReturnValue(
                (async function* () {
                    throw new Error("Vertex AI quota exceeded");
                })() as never,
            );

            const res = await POST(
                makeRequest({ plan: validPlan, messageId: "m1" }),
                { params },
            );
            const events = await readSSE(res);

            const errorEvent = events.find((e) => e.event === "error");
            expect(errorEvent).toBeDefined();
            expect(events.at(-1)?.event).toBe("done");
        });

        it("builds a nodeUriMap from canvas nodes with gs:// sourceUrls", async () => {
            mockGetCanvas.mockResolvedValue({
                ...mockCanvas,
                nodes: [
                    {
                        id: "node-1",
                        data: { sourceUrl: "gs://bucket/img.png" },
                    },
                    {
                        id: "node-2",
                        data: { sourceUrl: "https://cdn.example.com/img.png" },
                    },
                    { id: "node-3", data: {} },
                ],
            } as never);

            await POST(makeRequest({ plan: validPlan, messageId: "m1" }), {
                params,
            });

            const callArgs = mockExecutePlan.mock.calls[0];
            const nodeUriMap = callArgs[1] as Map<string, string>;
            expect(nodeUriMap.get("node-1")).toBe("gs://bucket/img.png");
            expect(nodeUriMap.has("node-2")).toBe(false);
            expect(nodeUriMap.has("node-3")).toBe(false);
        });
    });
});
