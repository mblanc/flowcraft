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
