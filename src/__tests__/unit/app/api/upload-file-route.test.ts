import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/storage.service", () => ({
    storageService: { uploadFile: vi.fn(), getSignedUrl: vi.fn() },
}));
vi.mock("file-type", () => ({ fileTypeFromBuffer: vi.fn() }));
vi.mock("uuid", () => ({ v4: () => "test-uuid" }));
vi.mock("@/app/logger", () => ({
    default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { auth } from "@/auth";
import { storageService } from "@/lib/services/storage.service";
import { fileTypeFromBuffer } from "file-type";
import { POST } from "@/app/api/upload-file/route";

const mockAuth = vi.mocked(auth);
const mockUploadFile = vi.mocked(storageService.uploadFile);
const mockGetSignedUrl = vi.mocked(storageService.getSignedUrl);
const mockFileTypeFromBuffer = vi.mocked(fileTypeFromBuffer);

const VALID_SESSION = {
    user: { id: "user-1", email: "test@example.com" },
    expires: "2099-01-01",
};

function makeFile(name: string, sizeBytes = 1024, type = "image/png"): File {
    const content = new Uint8Array(sizeBytes);
    return new File([content], name, { type });
}

function makeRequest(file: File | null): NextRequest {
    const req = new NextRequest("http://localhost/api/upload-file", {
        method: "POST",
    });
    const formData = new FormData();
    if (file) formData.append("file", file);
    req.formData = vi.fn().mockResolvedValue(formData);
    return req;
}

beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.mockResolvedValue(VALID_SESSION as any);
    mockFileTypeFromBuffer.mockResolvedValue({ mime: "image/png", ext: "png" });
    mockUploadFile.mockResolvedValue("gs://bucket/test-uuid.png");
    mockGetSignedUrl.mockResolvedValue("https://signed.url/test-uuid.png");
});

describe("POST /api/upload-file", () => {
    it("returns 401 when unauthenticated", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockAuth.mockResolvedValue(null as any);
        const res = await POST(makeRequest(makeFile("photo.png")), {});
        expect(res.status).toBe(401);
    });

    it("returns 400 when no file field is present", async () => {
        const res = await POST(makeRequest(null), {});
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/no file/i);
    });

    it("returns 413 when file exceeds 32 MB", async () => {
        const bigFile = makeFile("big.png", 33 * 1024 * 1024 + 1);
        const res = await POST(makeRequest(bigFile), {});
        expect(res.status).toBe(413);
    });

    it("returns 415 when file type is not allowed", async () => {
        mockFileTypeFromBuffer.mockResolvedValue({
            mime: "text/plain",
            ext: "txt",
        });
        const res = await POST(makeRequest(makeFile("doc.txt")), {});
        expect(res.status).toBe(415);
        const body = await res.json();
        expect(body.error).toMatch(/unsupported/i);
    });

    it("returns 415 when file-type cannot detect the type", async () => {
        mockFileTypeFromBuffer.mockResolvedValue(undefined);
        const res = await POST(makeRequest(makeFile("unknown.bin")), {});
        expect(res.status).toBe(415);
    });

    it("returns 500 when storageService.uploadFile returns falsy", async () => {
        mockUploadFile.mockResolvedValue(null as unknown as string);
        const res = await POST(makeRequest(makeFile("photo.png")), {});
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toMatch(/failed to upload/i);
    });

    it("returns 500 with 'Internal server error' on unhandled exception", async () => {
        mockUploadFile.mockRejectedValue(new Error("GCS unavailable"));
        const res = await POST(makeRequest(makeFile("photo.png")), {});
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toMatch(/internal server error/i);
    });

    it("returns gcsUri, signedUrl, and sanitized fileName on success", async () => {
        const res = await POST(makeRequest(makeFile("my photo.png")), {});
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.gcsUri).toBe("gs://bucket/test-uuid.png");
        expect(body.signedUrl).toBe("https://signed.url/test-uuid.png");
        expect(body.fileName).toBe("my photo.png");
    });

    it("sanitizes malicious filename characters", async () => {
        const res = await POST(
            makeRequest(makeFile("<img onerror=alert(1)>.png")),
            {},
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.fileName).not.toMatch(/[<>]/);
    });

    it("preserves international characters (Unicode) in the filename while sanitizing malicious ones", async () => {
        const res = await POST(
            makeRequest(makeFile("图片_документ_café_<script>.png")),
            {},
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.fileName).toBe("图片_документ_café_script.png");
    });

    it("uses magic-byte-detected extension, not the client-supplied filename extension", async () => {
        mockFileTypeFromBuffer.mockResolvedValue({
            mime: "image/jpeg",
            ext: "jpg",
        });
        const res = await POST(makeRequest(makeFile("trick.png")), {});
        expect(res.status).toBe(200);
        expect(mockUploadFile).toHaveBeenCalledWith(
            expect.any(Buffer),
            "test-uuid.jpg",
            "image/jpeg",
        );
    });
});
