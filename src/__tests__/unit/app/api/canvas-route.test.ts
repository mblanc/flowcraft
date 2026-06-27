import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import {
    canvasService,
    CanvasNotFoundError,
    CanvasForbiddenError,
} from "@/lib/services/canvas.service";
import { GET, PATCH, DELETE } from "@/app/api/canvases/[id]/route";

vi.mock("@/auth", () => ({
    auth: vi.fn(),
}));

vi.mock("@/lib/services/canvas.service", () => ({
    canvasService: {
        getCanvas: vi.fn(),
        updateCanvas: vi.fn(),
        deleteCanvas: vi.fn(),
    },
    CanvasNotFoundError: class CanvasNotFoundError extends Error {},
    CanvasForbiddenError: class CanvasForbiddenError extends Error {
        constructor(message: string) {
            super(message);
            this.name = "CanvasForbiddenError";
        }
    },
}));

vi.mock("@/app/logger", () => ({
    default: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

const mockAuth = vi.mocked(auth);
const mockGetCanvas = vi.mocked(canvasService.getCanvas);
const mockUpdateCanvas = vi.mocked(canvasService.updateCanvas);
const mockDeleteCanvas = vi.mocked(canvasService.deleteCanvas);

const VALID_SESSION = {
    user: { id: "user-1", email: "test@example.com" },
    expires: "2099-01-01",
};

const mockCanvas = {
    id: "canvas-1",
    userId: "user-1",
    name: "My Canvas",
    nodes: [],
    messages: [],
};

const params = Promise.resolve({ id: "canvas-1" });

beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(VALID_SESSION as never);
});

describe("Canvases API Route - /[id]", () => {
    describe("GET", () => {
        it("returns canvas on success", async () => {
            mockGetCanvas.mockResolvedValue(mockCanvas as never);
            const req = new NextRequest(
                "http://localhost/api/canvases/canvas-1",
            );
            const res = await GET(req, { params });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual(mockCanvas);
        });

        it("returns 404 when canvas is not found", async () => {
            mockGetCanvas.mockRejectedValue(
                new CanvasNotFoundError("Not found"),
            );
            const req = new NextRequest(
                "http://localhost/api/canvases/canvas-1",
            );
            const res = await GET(req, { params });
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "Canvas not found" });
        });

        it("returns 403 when access is forbidden", async () => {
            mockGetCanvas.mockRejectedValue(
                new CanvasForbiddenError("Forbidden"),
            );
            const req = new NextRequest(
                "http://localhost/api/canvases/canvas-1",
            );
            const res = await GET(req, { params });
            expect(res.status).toBe(403);
            expect(await res.json()).toEqual({ error: "Forbidden" });
        });

        it("returns 500 on unexpected errors", async () => {
            mockGetCanvas.mockRejectedValue(new Error("Database error"));
            const req = new NextRequest(
                "http://localhost/api/canvases/canvas-1",
            );
            const res = await GET(req, { params });
            expect(res.status).toBe(500);
            expect(await res.json()).toEqual({
                error: "Internal server error",
            });
        });
    });

    describe("PATCH", () => {
        const validUpdate = { name: "Updated Canvas Name" };

        it("updates canvas on success", async () => {
            mockUpdateCanvas.mockResolvedValue({
                ...mockCanvas,
                name: "Updated Canvas Name",
            } as never);
            const req = new NextRequest(
                "http://localhost/api/canvases/canvas-1",
                {
                    method: "PATCH",
                    body: JSON.stringify(validUpdate),
                },
            );
            const res = await PATCH(req, { params });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                ...mockCanvas,
                name: "Updated Canvas Name",
            });
        });

        it("returns 400 on validation error", async () => {
            const invalidUpdate = { name: 123 }; // Should be a string
            const req = new NextRequest(
                "http://localhost/api/canvases/canvas-1",
                {
                    method: "PATCH",
                    body: JSON.stringify(invalidUpdate),
                },
            );
            const res = await PATCH(req, { params });
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toBeDefined();
        });

        it("returns 400 on malformed JSON body", async () => {
            const req = new NextRequest(
                "http://localhost/api/canvases/canvas-1",
                {
                    method: "PATCH",
                    body: "{ malformed json",
                },
            );
            const res = await PATCH(req, { params });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "Invalid JSON body" });
        });

        it("returns 404 when canvas is not found", async () => {
            mockUpdateCanvas.mockRejectedValue(
                new CanvasNotFoundError("Not found"),
            );
            const req = new NextRequest(
                "http://localhost/api/canvases/canvas-1",
                {
                    method: "PATCH",
                    body: JSON.stringify(validUpdate),
                },
            );
            const res = await PATCH(req, { params });
            expect(res.status).toBe(404);
        });
    });

    describe("DELETE", () => {
        it("deletes canvas on success", async () => {
            mockDeleteCanvas.mockResolvedValue({ success: true } as never);
            const req = new NextRequest(
                "http://localhost/api/canvases/canvas-1",
                {
                    method: "DELETE",
                },
            );
            const res = await DELETE(req, { params });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ success: true });
        });

        it("returns 404 when canvas is not found", async () => {
            mockDeleteCanvas.mockRejectedValue(
                new CanvasNotFoundError("Not found"),
            );
            const req = new NextRequest(
                "http://localhost/api/canvases/canvas-1",
                {
                    method: "DELETE",
                },
            );
            const res = await DELETE(req, { params });
            expect(res.status).toBe(404);
        });
    });
});
