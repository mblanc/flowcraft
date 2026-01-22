import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../app/api/flows/[id]/publish/route";
import { flowService } from "../lib/services/flow.service";
import { NextResponse, NextRequest } from "next/server";

// Mock dependencies
vi.mock("@/lib/services/flow.service", () => ({
    flowService: {
        publishFlow: vi.fn(),
    },
}));

vi.mock("@/auth", () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

vi.mock("@/app/logger", () => ({
    default: {
        error: vi.fn(),
    },
}));

describe("Publish API Route", () => {
    const params = Promise.resolve({ id: "flow-1" });
    const req = {} as NextRequest;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return published flow on success", async () => {
        const mockFlow = { id: "flow-1", version: "1.0.1", isPublished: true };
        vi.mocked(flowService.publishFlow).mockResolvedValue(
            mockFlow as unknown as Awaited<
                ReturnType<typeof flowService.publishFlow>
            >,
        );

        const response = await POST(req, { params });

        expect(response).toBeInstanceOf(NextResponse);
        // In real execution we check status, but NextResponse needs environment.
        // We can inspect json body if we could.
        // For unit testing route handlers in Next.js 13+, it returns a Response object.
        // We can check status if available.
        expect(response.status).toBe(200);

        // Check if service was called
        expect(flowService.publishFlow).toHaveBeenCalledWith(
            "flow-1",
            "user-1",
        );
    });

    it("should return 404 if flow not found", async () => {
        vi.mocked(flowService.publishFlow).mockRejectedValue(
            new Error("Flow not found"),
        );

        const response = await POST(req, { params });
        expect(response.status).toBe(404);
    });

    it("should return 403 if unauthorized", async () => {
        vi.mocked(flowService.publishFlow).mockRejectedValue(
            new Error("Unauthorized"),
        );

        const response = await POST(req, { params });
        expect(response.status).toBe(403);
    });

    it("should return 400 for validation errors", async () => {
        vi.mocked(flowService.publishFlow).mockRejectedValue(
            new Error("Flow contains a cycle"),
        );

        const response = await POST(req, { params });
        expect(response.status).toBe(400);
    });

    it("should return 500 for generic errors", async () => {
        vi.mocked(flowService.publishFlow).mockRejectedValue(
            new Error("Something exploded"),
        );

        const response = await POST(req, { params });
        expect(response.status).toBe(500);
    });
});
