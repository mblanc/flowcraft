import { useState, useEffect } from "react";
import logger from "@/app/logger";
import {
    getCachedSignedUrl,
    fetchAndCacheSignedUrl,
    fetchAndCacheSignedUrls,
} from "@/lib/cache/signed-urls";
import { isGcsUri } from "@/lib/utils/gcs-uri";

export function useSignedUrl(
    gcsUri: string | undefined,
    providedSignedUrl?: string,
) {
    // Initialise synchronously from the module-level cache so remounting nodes
    // never show a loading state or trigger a redundant fetch.
    const [asyncSignedUrl, setAsyncSignedUrl] = useState<string | undefined>(
        () =>
            providedSignedUrl ??
            (isGcsUri(gcsUri) ? getCachedSignedUrl(gcsUri) : undefined),
    );
    const [prevUri, setPrevUri] = useState(gcsUri);

    if (gcsUri !== prevUri) {
        setPrevUri(gcsUri);
        if (!isGcsUri(gcsUri)) {
            setAsyncSignedUrl(undefined);
        } else {
            // Attempt a synchronous cache hit on URI change before the effect runs.
            const cached = providedSignedUrl ?? getCachedSignedUrl(gcsUri);
            setAsyncSignedUrl(cached);
        }
    }

    useEffect(() => {
        if (providedSignedUrl) return;
        if (!isGcsUri(gcsUri)) return;
        if (asyncSignedUrl) return; // already resolved from cache

        let cancelled = false;
        fetchAndCacheSignedUrl(gcsUri)
            .then((url) => {
                if (cancelled) return;
                if (url) {
                    setAsyncSignedUrl(url);
                } else {
                    logger.error(`Failed to get signed URL for ${gcsUri}`);
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    logger.error("Error fetching signed URL:", error);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [gcsUri, asyncSignedUrl, providedSignedUrl]);

    const resolvedSignedUrl = providedSignedUrl ?? asyncSignedUrl;
    const displayUrl = isGcsUri(gcsUri) ? resolvedSignedUrl : gcsUri;

    return { signedUrl: resolvedSignedUrl, displayUrl };
}

export function useSignedUrls(gcsUris: (string | undefined)[]) {
    const urisKey = JSON.stringify(gcsUris);
    const [signedUrls, setSignedUrls] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        for (const uri of gcsUris) {
            if (isGcsUri(uri)) {
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
            if (isGcsUri(uri)) {
                const cached = getCachedSignedUrl(uri);
                if (cached) initial[uri] = cached;
            }
        }
        setSignedUrls(initial);
    }

    useEffect(() => {
        let isMounted = true;
        const parsedUris: (string | undefined)[] = JSON.parse(urisKey);
        const uris = parsedUris.filter((u): u is string => isGcsUri(u));
        const uncached = uris.filter((uri) => !getCachedSignedUrl(uri));
        if (uncached.length === 0) return;

        // Fetch remaining signed URLs via single batch request
        fetchAndCacheSignedUrls(uncached).then((newUrls) => {
            if (!isMounted) return;
            setSignedUrls((prev) => ({ ...prev, ...newUrls }));
        });

        return () => {
            isMounted = false;
        };
    }, [urisKey]);

    return signedUrls;
}
