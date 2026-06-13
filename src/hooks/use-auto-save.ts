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
    debounceMs = 1500,
}: UseAutoSaveOptions) {
    const lastSavedRef = useRef<number>(0);

    useEffect(() => {
        if (!entityId || !lastModified) return;
        if (lastModified <= lastSavedRef.current) return;

        const timeout = setTimeout(() => {
            lastSavedRef.current = lastModified;
            void onSave();
        }, debounceMs);

        return () => clearTimeout(timeout);
    }, [lastModified, entityId, onSave, debounceMs]);
}
