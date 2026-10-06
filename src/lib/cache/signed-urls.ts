/**
 * Module-level signed URL cache with TTL.
 *
 * GCS signed URLs are generated with a 1-hour expiry (see lib/storage.ts).
 * We cache them for 55 minutes, leaving a 5-minute buffer before they become
 * invalid — this covers clock skew and the time it takes for a cached URL to
 * be used after being read from the cache.
 *
 * Lives for the duration of the browser session (survives component unmounts).
 * When a node is virtualized off-screen and remounts, it reads the cached URL
 * synchronously so there is no loading flash or extra network request.
 *
 * In-flight request deduplication prevents parallel components from issuing
 * concurrent fetches for the same GCS URI.
 */

const TTL_MS = 55 * 60 * 1000; // 55 minutes

interface CacheEntry {
    url: string;
    expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<string | null>>();

function getValid(gcsUri: string): string | undefined {
    const entry = cache.get(gcsUri);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
        cache.delete(gcsUri);
        return undefined;
    }
    return entry.url;
}

/** Synchronous read — returns `undefined` if not cached or expired. */
export function getCachedSignedUrl(gcsUri: string): string | undefined {
    return getValid(gcsUri);
}

/**
 * Fetch a signed URL, writing the result into the cache with a TTL.
 * Concurrent calls for the same URI share the same in-flight promise so only
 * one HTTP request is ever made per URI.
 */
export async function fetchAndCacheSignedUrl(
    gcsUri: string,
): Promise<string | null> {
    const cached = getValid(gcsUri);
    if (cached) return cached;

    const existingPending = pending.get(gcsUri);
    if (existingPending) return existingPending;

    const fetchPromise = fetch(
        `/api/signed-url?gcsUri=${encodeURIComponent(gcsUri)}`,
    )
        .then((res) => res.json())
        .then((result: { signedUrl?: string }) => {
            pending.delete(gcsUri);
            if (result.signedUrl) {
                cache.set(gcsUri, {
                    url: result.signedUrl,
                    expiresAt: Date.now() + TTL_MS,
                });
                return result.signedUrl;
            }
            return null;
        })
        .catch(() => {
            pending.delete(gcsUri);
            return null;
        });

    pending.set(gcsUri, fetchPromise);
    return fetchPromise;
}

/**
 * Batch fetch multiple signed URLs in a single HTTP POST request,
 * skipping already-cached URIs and writing new results into cache.
 */
export async function fetchAndCacheSignedUrls(
    gcsUris: string[],
): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    const uncached: string[] = [];
    const pendingPromises: Promise<void>[] = [];

    for (const uri of gcsUris) {
        const cached = getValid(uri);
        if (cached) {
            results[uri] = cached;
            continue;
        }
        const existingPending = pending.get(uri);
        if (existingPending) {
            pendingPromises.push(
                existingPending.then((url) => {
                    if (url) results[uri] = url;
                }),
            );
        } else {
            uncached.push(uri);
        }
    }

    const uniqueUncached = Array.from(new Set(uncached));
    const CHUNK_SIZE = 100;

    for (let i = 0; i < uniqueUncached.length; i += CHUNK_SIZE) {
        const chunk = uniqueUncached.slice(i, i + CHUNK_SIZE);
        const resolvers = new Map<string, (val: string | null) => void>();

        for (const uri of chunk) {
            const p = new Promise<string | null>((resolve) => {
                resolvers.set(uri, resolve);
            });
            pending.set(uri, p);
        }

        const chunkPromise = (async () => {
            try {
                const res = await fetch("/api/signed-url", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ gcsUris: chunk }),
                });
                if (res.ok) {
                    const data: { signedUrls?: Record<string, string> } =
                        await res.json();
                    if (data.signedUrls) {
                        for (const [uri, signedUrl] of Object.entries(
                            data.signedUrls,
                        )) {
                            cache.set(uri, {
                                url: signedUrl,
                                expiresAt: Date.now() + TTL_MS,
                            });
                            results[uri] = signedUrl;
                        }
                    }
                }
            } catch {
                // Fail silently; callers handle missing entries
            } finally {
                for (const uri of chunk) {
                    pending.delete(uri);
                    const resolve = resolvers.get(uri);
                    if (resolve) {
                        resolve(results[uri] ?? null);
                    }
                }
            }
        })();

        pendingPromises.push(chunkPromise);
    }

    if (pendingPromises.length > 0) {
        await Promise.all(pendingPromises);
    }

    return results;
}

/** Remove a specific entry (e.g. after a new image is generated for a node). */
export function invalidateSignedUrl(gcsUri: string): void {
    cache.delete(gcsUri);
    pending.delete(gcsUri);
}

/** Wipe the entire cache (e.g. on sign-out). */
export function clearSignedUrlCache(): void {
    cache.clear();
    pending.clear();
}
