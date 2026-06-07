import { useState, useEffect } from "react";
import logger from "@/app/logger";
import {
    getCachedSignedUrl,
    fetchAndCacheSignedUrl,
} from "@/lib/cache/signed-url-cache";

export function useSignedUrl(gcsUri: string | undefined) {
    // Initialise synchronously from the module-level cache so remounting nodes
    // never show a loading state or trigger a redundant fetch.
    const [asyncSignedUrl, setAsyncSignedUrl] = useState<string | undefined>(
        () =>
            gcsUri?.startsWith("gs://")
                ? getCachedSignedUrl(gcsUri)
                : undefined,
    );
    const [prevUri, setPrevUri] = useState(gcsUri);

    if (gcsUri !== prevUri) {
        setPrevUri(gcsUri);
        if (!gcsUri?.startsWith("gs://")) {
            setAsyncSignedUrl(undefined);
        } else {
            // Attempt a synchronous cache hit on URI change before the effect runs.
            const cached = getCachedSignedUrl(gcsUri);
            setAsyncSignedUrl(cached);
        }
    }

    useEffect(() => {
        if (!gcsUri?.startsWith("gs://")) return;
        if (asyncSignedUrl) return; // already resolved from cache

        fetchAndCacheSignedUrl(gcsUri)
            .then((url) => {
                if (url) {
                    setAsyncSignedUrl(url);
                } else {
                    logger.error(`Failed to get signed URL for ${gcsUri}`);
                }
            })
            .catch((error) => {
                logger.error("Error fetching signed URL:", error);
            });
    }, [gcsUri, asyncSignedUrl]);

    const displayUrl = gcsUri?.startsWith("gs://") ? asyncSignedUrl : gcsUri;

    return { signedUrl: asyncSignedUrl, displayUrl };
}

export function useSignedUrls(gcsUris: (string | undefined)[]) {
    const urisKey = JSON.stringify(gcsUris);
    const [signedUrls, setSignedUrls] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        for (const uri of gcsUris) {
            if (uri && uri.startsWith("gs://")) {
                const cached = getCachedSignedUrl(uri);
                if (cached) initial[uri] = cached;
            }
        }
        return initial;
    });
    const [prevUrisKey, setPrevUrisKey] = useState(urisKey);

    if (urisKey !== prevUrisKey) {
        setPrevUrisKey(urisKey);
        const initial: Record<string, string> = {};
        for (const uri of gcsUris) {
            if (uri && uri.startsWith("gs://")) {
                const cached = getCachedSignedUrl(uri);
                if (cached) initial[uri] = cached;
            }
        }
        setSignedUrls(initial);
    }

    useEffect(() => {
        let isMounted = true;
        const parsedUris: (string | undefined)[] = JSON.parse(urisKey);
        const uris = parsedUris.filter(
            (u): u is string => typeof u === "string" && u.startsWith("gs://"),
        );
        const uncached = uris.filter((uri) => !getCachedSignedUrl(uri));
        if (uncached.length === 0) return;

        // Fetch remaining signed URLs concurrently (cache deduplicates in-flight calls)
        Promise.all(
            uncached.map(async (uri) => {
                const url = await fetchAndCacheSignedUrl(uri);
                return { uri, url };
            }),
        ).then((results) => {
            if (!isMounted) return;
            const newUrls: Record<string, string> = {};
            for (const { uri, url } of results) {
                if (url) newUrls[uri] = url;
            }
            setSignedUrls((prev) => ({ ...prev, ...newUrls }));
        });

        return () => {
            isMounted = false;
        };
    }, [urisKey]);

    return signedUrls;
}
