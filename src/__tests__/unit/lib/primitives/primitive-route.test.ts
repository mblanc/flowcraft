/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { serverRegistry } from "@/primitives/server-registry";
import { Primitive } from "@/primitives/types";
import { POST } from "@/app/api/primitives/[primitiveId]/execute/route";
import { z } from "zod";

const mockAuth = auth as any;

const mockPrimitive: Primitive<any, any, any, any> = {
    id: "test-primitive",
    label: "Test Primitive",
    mediaType: "image",
    requestSchema: z.object({ prompt: z.string() }),
    outputShape: z.object({ url: z.string() }),
    execute: vi.fn(async () => ({ url: "http://example.com" })),
    flow: {
        type: "flow-test",
        inputs: {},
        outputs: {},
        gatherInputs: () => ({}),
        mergeResults: (results) => results[0] || {},
        saveToLibrary: async () => {},
    },
    canvas: null,
    agent: null,
};

function makeRequest(
    body: unknown,
    primitiveId = "test-primitive",
): NextRequest {
    return new NextRequest(
        `http://localhost/api/primitives/${primitiveId}/execute`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        },
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as any);
    // Ensure the primitive is registered
    if (!serverRegistry.get("test-primitive")) {
        serverRegistry.register(mockPrimitive);
    }
});

describe("POST /api/primitives/[primitiveId]/execute", () => {
    it("returns 401 when unauthenticated", async () => {
        mockAuth.mockResolvedValue(null as any);
        const res = await POST(makeRequest({ prompt: "hello" }), {
            params: Promise.resolve({ primitiveId: "test-primitive" }),
        });
        expect(res.status).toBe(401);
    });

    it("returns 404 when primitive is not found", async () => {
        const res = await POST(makeRequest({ prompt: "hello" }), {
            params: Promise.resolve({ primitiveId: "non-existent" }),
        });
        expect(res.status).toBe(404);
    });

    it("returns 400 when validation fails against requestSchema", async () => {
        const res = await POST(makeRequest({ invalid: "hello" }), {
            params: Promise.resolve({ primitiveId: "test-primitive" }),
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe("Validation failed");
    });

    it("returns 200 and calls execute when inputs are valid", async () => {
        const res = await POST(makeRequest({ prompt: "hello" }), {
            params: Promise.resolve({ primitiveId: "test-primitive" }),
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toEqual({ url: "http://example.com" });
        expect(mockPrimitive.execute).toHaveBeenCalledWith(
            { prompt: "hello" },
            { userId: "user-1" },
        );
    });
});
