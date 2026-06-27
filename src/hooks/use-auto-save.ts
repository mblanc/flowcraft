"use client";

import { useEffect, useRef } from "react";

interface UseAutoSaveOptions {
    entityId: string | null;
    lastModified: number;
    onSave: () => Promise<void>;
    debounceMs?: number;
}

export function useAutoSave({
    entityId,
    lastModified,
    onSave,
    debounceMs = 2000,
}: UseAutoSaveOptions) {
    const lastSavedRef = useRef<number>(0);
    const onSaveRef = useRef(onSave);
    useEffect(() => {
        onSaveRef.current = onSave;
    });

    useEffect(() => {
        if (!entityId || lastModified <= lastSavedRef.current) return;

        const timeout = setTimeout(() => {
            void (async () => {
                try {
                    await onSaveRef.current();
                    lastSavedRef.current = lastModified;
                } catch {
                    // onSave sets saveStatus="error"; lastSavedRef stays so
                    // the next edit or remount will retry
                }
            })();
        }, debounceMs);

        return () => clearTimeout(timeout);
    }, [lastModified, entityId, debounceMs]);
}
