import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    getCachedSignedUrl,
    fetchAndCacheSignedUrl,
    invalidateSignedUrl,
    clearSignedUrlCache,
} from "../lib/cache/signed-url-cache";

describe("signed-url-cache", () => {
    beforeEach(() => {
        clearSignedUrlCache();
        vi.restoreAllMocks();
    });

    describe("getCachedSignedUrl", () => {
        it("returns undefined for unknown URI", () => {
            expect(
                getCachedSignedUrl("gs://bucket/unknown.png"),
            ).toBeUndefined();
        });

        it("returns cached URL after a successful fetch", async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({ signedUrl: "https://signed.url/img" }),
            });
            vi.stubGlobal("fetch", mockFetch);

            await fetchAndCacheSignedUrl("gs://bucket/img.png");
            expect(getCachedSignedUrl("gs://bucket/img.png")).toBe(
                "https://signed.url/img",
            );
        });

        it("returns undefined for expired entries", async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({ signedUrl: "https://signed.url/old" }),
            });
            vi.stubGlobal("fetch", mockFetch);

            await fetchAndCacheSignedUrl("gs://bucket/old.png");

            // Simulate expiry by setting Date.now() far in the future
            const realNow = Date.now;
            vi.spyOn(Date, "now").mockReturnValue(realNow() + 60 * 60 * 1000);

            expect(getCachedSignedUrl("gs://bucket/old.png")).toBeUndefined();
        });
    });

    describe("fetchAndCacheSignedUrl", () => {
        it("fetches and returns a signed URL on cache miss", async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        signedUrl: "https://signed.url/fetched",
                    }),
            });
            vi.stubGlobal("fetch", mockFetch);

            const url = await fetchAndCacheSignedUrl("gs://bucket/new.png");
            expect(url).toBe("https://signed.url/fetched");
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it("returns cached URL without re-fetching on cache hit", async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({ signedUrl: "https://signed.url/cached" }),
            });
            vi.stubGlobal("fetch", mockFetch);

            await fetchAndCacheSignedUrl("gs://bucket/cached.png");
            const second = await fetchAndCacheSignedUrl(
                "gs://bucket/cached.png",
            );

            expect(second).toBe("https://signed.url/cached");
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it("deduplicates concurrent in-flight requests (same promise returned)", async () => {
            let resolveFetch!: (v: unknown) => void;
            const pendingResponse = new Promise((res) => {
                resolveFetch = res;
            }).then(() => ({
                json: () =>
                    Promise.resolve({ signedUrl: "https://signed.url/dup" }),
            }));

            const mockFetch = vi.fn().mockReturnValue(pendingResponse);
            vi.stubGlobal("fetch", mockFetch);

            // Start two concurrent requests — the second should share the first promise
            const p1 = fetchAndCacheSignedUrl("gs://bucket/dup.png");
            const p2 = fetchAndCacheSignedUrl("gs://bucket/dup.png");

            // Only one fetch call should have been made
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Resolve the pending fetch
            resolveFetch(undefined);

            const [r1, r2] = await Promise.all([p1, p2]);
            expect(r1).toBe("https://signed.url/dup");
            expect(r2).toBe("https://signed.url/dup");
        });

        it("returns null when response has no signedUrl", async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({}),
            });
            vi.stubGlobal("fetch", mockFetch);

            const url = await fetchAndCacheSignedUrl("gs://bucket/empty.png");
            expect(url).toBeNull();
        });

        it("returns null on fetch error", async () => {
            const mockFetch = vi
                .fn()
                .mockRejectedValue(new Error("network error"));
            vi.stubGlobal("fetch", mockFetch);

            const url = await fetchAndCacheSignedUrl("gs://bucket/error.png");
            expect(url).toBeNull();
        });
    });

    describe("invalidateSignedUrl", () => {
        it("removes a cached entry", async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({ signedUrl: "https://signed.url/inv" }),
            });
            vi.stubGlobal("fetch", mockFetch);

            await fetchAndCacheSignedUrl("gs://bucket/inv.png");
            expect(getCachedSignedUrl("gs://bucket/inv.png")).toBeDefined();

            invalidateSignedUrl("gs://bucket/inv.png");
            expect(getCachedSignedUrl("gs://bucket/inv.png")).toBeUndefined();
        });
    });

    describe("clearSignedUrlCache", () => {
        it("removes all cached entries", async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({ signedUrl: "https://signed.url/clear" }),
            });
            vi.stubGlobal("fetch", mockFetch);

            await fetchAndCacheSignedUrl("gs://bucket/clear1.png");
            await fetchAndCacheSignedUrl("gs://bucket/clear2.png");

            clearSignedUrlCache();

            expect(
                getCachedSignedUrl("gs://bucket/clear1.png"),
            ).toBeUndefined();
            expect(
                getCachedSignedUrl("gs://bucket/clear2.png"),
            ).toBeUndefined();
        });
    });
});
