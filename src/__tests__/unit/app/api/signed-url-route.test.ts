import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/storage.service", () => ({
    storageService: { getSignedUrl: vi.fn() },
}));
vi.mock("@/lib/config", () => ({
    config: { GCS_STORAGE_URI: "gs://allowed-bucket" },
}));
vi.mock("@/app/logger", () => ({
    default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { auth } from "@/auth";
import { storageService } from "@/lib/services/storage.service";
import { GET, POST } from "@/app/api/signed-url/route";

const mockAuth = vi.mocked(auth);
const mockGetSignedUrl = vi.mocked(storageService.getSignedUrl);

const VALID_SESSION = {
    user: { id: "user-1", email: "test@example.com" },
    expires: "2099-01-01",
};

beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.mockResolvedValue(VALID_SESSION as any);
    mockGetSignedUrl.mockImplementation(
        async (uri) => `https://signed.url/${uri.replace("gs://", "")}`,
    );
});

describe("GET /api/signed-url", () => {
    it("returns 401 when unauthenticated", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockAuth.mockResolvedValue(null as any);
        const req = new NextRequest(
            "http://localhost/api/signed-url?gcsUri=gs://allowed-bucket/file.png",
        );
        const res = await GET(req, {});
        expect(res.status).toBe(401);
    });

    it("returns signedUrl and Cache-Control header when authenticated", async () => {
        const req = new NextRequest(
            "http://localhost/api/signed-url?gcsUri=gs://allowed-bucket/file.png",
        );
        const res = await GET(req, {});
        expect(res.status).toBe(200);
        expect(res.headers.get("cache-control")).toBe("no-store, private");

        const data = await res.json();
        expect(data.signedUrl).toBe(
            "https://signed.url/allowed-bucket/file.png",
        );
    });
});

describe("POST /api/signed-url (batch)", () => {
    it("returns 401 when unauthenticated", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockAuth.mockResolvedValue(null as any);
        const req = new NextRequest("http://localhost/api/signed-url", {
            method: "POST",
            body: JSON.stringify({ gcsUris: ["gs://allowed-bucket/1.png"] }),
        });
        const res = await POST(req, {});
        expect(res.status).toBe(401);
    });

    it("returns 400 when body contains unauthorized bucket", async () => {
        const req = new NextRequest("http://localhost/api/signed-url", {
            method: "POST",
            body: JSON.stringify({
                gcsUris: ["gs://unauthorized-bucket/1.png"],
            }),
        });
        const res = await POST(req, {});
        expect(res.status).toBe(400);
    });

    it("returns batch signedUrls for valid URIs", async () => {
        const req = new NextRequest("http://localhost/api/signed-url", {
            method: "POST",
            body: JSON.stringify({
                gcsUris: [
                    "gs://allowed-bucket/1.png",
                    "gs://allowed-bucket/2.png",
                ],
            }),
        });
        const res = await POST(req, {});
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.signedUrls).toEqual({
            "gs://allowed-bucket/1.png":
                "https://signed.url/allowed-bucket/1.png",
            "gs://allowed-bucket/2.png":
                "https://signed.url/allowed-bucket/2.png",
        });
    });
});
