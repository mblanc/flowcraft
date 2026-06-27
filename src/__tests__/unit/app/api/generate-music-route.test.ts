/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/primitives/server-registry", () => ({
    serverRegistry: { get: vi.fn() },
}));
vi.mock("@/app/logger", () => ({
    default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { auth } from "@/auth";
import { serverRegistry as registry } from "@/primitives/server-registry";
import { POST } from "@/app/api/generate-music/route";

const mockAuth = vi.mocked(auth);
const mockRegistryGet = vi.mocked(registry.get);

const VALID_SESSION = {
    user: { id: "user-1", email: "test@example.com" },
    expires: "2099-01-01",
};

function makeRequest(body: unknown): NextRequest {
    const req = new NextRequest("http://localhost/api/generate-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return req;
}

beforeEach(() => {
    vi.clearAllMocks();

    mockAuth.mockResolvedValue(VALID_SESSION as any);
});

describe("POST /api/generate-music", () => {
    it("returns 401 when unauthenticated", async () => {
        mockAuth.mockResolvedValue(null as any);
        const res = await POST(makeRequest({ prompt: "jazz" }), {});
        expect(res.status).toBe(401);
    });

    it("returns 404 when music primitive not in registry", async () => {
        mockRegistryGet.mockReturnValue(undefined);
        const res = await POST(makeRequest({ prompt: "jazz" }), {});
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe("Music primitive not found");
    });

    it("returns 404 when primitive has no execute method", async () => {
        mockRegistryGet.mockReturnValue({
            execute: null,
            requestSchema: null,
        } as any);
        const res = await POST(makeRequest({ prompt: "jazz" }), {});
        expect(res.status).toBe(404);
    });

    it("returns 400 when request body fails schema validation", async () => {
        const mockSchema = {
            safeParse: vi.fn().mockReturnValue({
                success: false,
                error: {
                    issues: [{ path: ["prompt"], message: "Required" }],
                },
            }),
        };

        mockRegistryGet.mockReturnValue({
            execute: vi.fn(),
            requestSchema: mockSchema,
        } as any);
        const res = await POST(makeRequest({}), {});
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe("Validation failed");
        expect(body.details).toBeDefined();
    });

    it("returns audioUrl on success", async () => {
        const mockExecute = vi
            .fn()
            .mockResolvedValue({ audioUrl: "https://example.com/audio.wav" });
        const mockSchema = {
            safeParse: vi.fn().mockReturnValue({
                success: true,
                data: { prompt: "jazz" },
            }),
        };

        mockRegistryGet.mockReturnValue({
            execute: mockExecute,
            requestSchema: mockSchema,
        } as any);

        const res = await POST(makeRequest({ prompt: "jazz" }), {});
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.audioUrl).toBe("https://example.com/audio.wav");
        expect(mockExecute).toHaveBeenCalledWith(
            { prompt: "jazz" },
            { userId: "user-1" },
        );
    });

    it("returns 500 when primitive.execute throws", async () => {
        const mockExecute = vi
            .fn()
            .mockRejectedValue(
                new Error("Lyria API error 429: quota exceeded"),
            );

        mockRegistryGet.mockReturnValue({
            execute: mockExecute,
            requestSchema: null,
        } as any);

        const res = await POST(makeRequest({ prompt: "jazz" }), {});
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toContain("Lyria API error 429");
    });

    it("skips schema validation when primitive has no requestSchema", async () => {
        const mockExecute = vi
            .fn()
            .mockResolvedValue({ audioUrl: "https://example.com/out.wav" });

        mockRegistryGet.mockReturnValue({
            execute: mockExecute,
            requestSchema: null,
        } as any);

        const res = await POST(makeRequest({ prompt: "jazz" }), {});
        expect(res.status).toBe(200);
        expect(mockExecute).toHaveBeenCalledWith(
            { prompt: "jazz" },
            { userId: "user-1" },
        );
    });
});
