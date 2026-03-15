import { useState, useEffect } from "react";
import logger from "@/app/logger";

export function useSignedUrl(gcsUri: string | undefined) {
    const [asyncSignedUrl, setAsyncSignedUrl] = useState<string | undefined>(
        undefined,
    );
    const [prevUri, setPrevUri] = useState(gcsUri);

    if (gcsUri !== prevUri) {
        setPrevUri(gcsUri);
        if (!gcsUri?.startsWith("gs://")) {
            setAsyncSignedUrl(undefined);
        }
    }

    useEffect(() => {
        if (gcsUri && gcsUri.startsWith("gs://")) {
            fetch(`/api/signed-url?gcsUri=${encodeURIComponent(gcsUri)}`)
                .then((res) => res.json())
                .then((result) => {
                    if (result.signedUrl) {
                        setAsyncSignedUrl(result.signedUrl);
                    } else {
                        logger.error(
                            `Failed to get signed URL: ${result.error}`,
                        );
                        setAsyncSignedUrl(undefined);
                    }
                })
                .catch((error) => {
                    logger.error("Error fetching signed URL:", error);
                    setAsyncSignedUrl(undefined);
                });
        }
    }, [gcsUri]);

    const displayUrl = gcsUri?.startsWith("gs://") ? asyncSignedUrl : gcsUri;

    return { signedUrl: asyncSignedUrl, displayUrl };
}
