import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCached = vi.fn();
const mockFetchAndCache = vi.fn();

vi.mock("@/lib/cache/signed-url-cache", () => ({
    getCachedSignedUrl: (uri: string) => mockGetCached(uri),
    fetchAndCacheSignedUrl: (uri: string) => mockFetchAndCache(uri),
}));

vi.mock("@/app/logger", () => ({
    default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { useSignedUrl } from "../hooks/use-signed-url";

describe("useSignedUrl", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCached.mockReturnValue(undefined);
        mockFetchAndCache.mockResolvedValue(undefined);
    });

    it("returns undefined for undefined gcsUri", () => {
        const { result } = renderHook(() => useSignedUrl(undefined));
        expect(result.current.signedUrl).toBeUndefined();
        expect(result.current.displayUrl).toBeUndefined();
    });

    it("returns the raw URL for non-gs:// URIs", () => {
        const { result } = renderHook(() =>
            useSignedUrl("https://example.com/img.png"),
        );
        expect(result.current.displayUrl).toBe("https://example.com/img.png");
        expect(result.current.signedUrl).toBeUndefined();
    });

    it("uses cached URL synchronously when available", () => {
        mockGetCached.mockReturnValue("https://signed.url/cached");

        const { result } = renderHook(() =>
            useSignedUrl("gs://bucket/img.png"),
        );
        expect(result.current.signedUrl).toBe("https://signed.url/cached");
        expect(result.current.displayUrl).toBe("https://signed.url/cached");
    });

    it("fetches signed URL when cache misses", async () => {
        mockGetCached.mockReturnValue(undefined);
        mockFetchAndCache.mockResolvedValue("https://signed.url/fetched");

        const { result } = renderHook(() =>
            useSignedUrl("gs://bucket/img.png"),
        );

        await waitFor(() => {
            expect(result.current.signedUrl).toBe("https://signed.url/fetched");
        });
    });

    it("does not fetch when URL is already cached", () => {
        mockGetCached.mockReturnValue("https://signed.url/cached");

        renderHook(() => useSignedUrl("gs://bucket/img.png"));

        expect(mockFetchAndCache).not.toHaveBeenCalled();
    });

    it("syncs to new URI when gcsUri changes", async () => {
        mockGetCached.mockReturnValue(undefined);
        mockFetchAndCache.mockResolvedValue("https://signed.url/new");

        let uri = "gs://bucket/a.png";
        const { result, rerender } = renderHook(() => useSignedUrl(uri));

        uri = "gs://bucket/b.png";
        rerender();

        await waitFor(() => {
            expect(mockFetchAndCache).toHaveBeenCalledWith("gs://bucket/b.png");
        });
    });

    it("clears signedUrl when switching to non-gs:// URI", () => {
        mockGetCached.mockReturnValue("https://signed.url/prev");

        let uri: string | undefined = "gs://bucket/img.png";
        const { result, rerender } = renderHook(() => useSignedUrl(uri));
        expect(result.current.signedUrl).toBe("https://signed.url/prev");

        uri = "https://plain.url/img.png";
        rerender();

        expect(result.current.displayUrl).toBe("https://plain.url/img.png");
    });

    it("handles fetch returning null without throwing", async () => {
        mockGetCached.mockReturnValue(undefined);
        mockFetchAndCache.mockResolvedValue(null);

        const { result } = renderHook(() =>
            useSignedUrl("gs://bucket/img.png"),
        );

        await waitFor(() => {
            expect(mockFetchAndCache).toHaveBeenCalled();
        });

        expect(result.current.signedUrl).toBeUndefined();
    });

    it("handles fetch error without throwing", async () => {
        mockGetCached.mockReturnValue(undefined);
        mockFetchAndCache.mockRejectedValue(new Error("network error"));

        const { result } = renderHook(() =>
            useSignedUrl("gs://bucket/img.png"),
        );

        await waitFor(() => {
            expect(mockFetchAndCache).toHaveBeenCalled();
        });

        expect(result.current.signedUrl).toBeUndefined();
    });
});
