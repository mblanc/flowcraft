import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAutoSave } from "@/hooks/use-auto-save";

describe("useAutoSave", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("does not call onSave when entityId is null", () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        renderHook(() =>
            useAutoSave({
                entityId: null,
                lastModified: Date.now(),
                onSave,
                debounceMs: 100,
            }),
        );
        vi.advanceTimersByTime(200);
        expect(onSave).not.toHaveBeenCalled();
    });

    it("does not call onSave when lastModified is 0", () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        renderHook(() =>
            useAutoSave({
                entityId: "abc",
                lastModified: 0,
                onSave,
                debounceMs: 100,
            }),
        );
        vi.advanceTimersByTime(200);
        expect(onSave).not.toHaveBeenCalled();
    });

    it("calls onSave after debounce when entityId and lastModified are set", () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        renderHook(() =>
            useAutoSave({
                entityId: "abc",
                lastModified: 1000,
                onSave,
                debounceMs: 100,
            }),
        );
        expect(onSave).not.toHaveBeenCalled();
        vi.advanceTimersByTime(100);
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("does not call onSave again when lastModified has not changed since last save", () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const ts = 1000;
        const { rerender } = renderHook(
            ({ lastModified }: { lastModified: number }) =>
                useAutoSave({
                    entityId: "abc",
                    lastModified,
                    onSave,
                    debounceMs: 100,
                }),
            { initialProps: { lastModified: ts } },
        );

        vi.advanceTimersByTime(100);
        expect(onSave).toHaveBeenCalledTimes(1);

        // Same timestamp — no new save
        rerender({ lastModified: ts });
        vi.advanceTimersByTime(100);
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("restarts the timer when lastModified changes within the debounce window (no double-fire)", () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const { rerender } = renderHook(
            ({ lastModified }: { lastModified: number }) =>
                useAutoSave({
                    entityId: "abc",
                    lastModified,
                    onSave,
                    debounceMs: 200,
                }),
            { initialProps: { lastModified: 1000 } },
        );

        vi.advanceTimersByTime(100); // halfway through debounce
        expect(onSave).not.toHaveBeenCalled();

        rerender({ lastModified: 2000 }); // change before debounce fires
        vi.advanceTimersByTime(100); // would have fired for old ts, but timer was reset
        expect(onSave).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100); // full debounce after last change
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("cleans up the timer on unmount", () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const { unmount } = renderHook(() =>
            useAutoSave({
                entityId: "abc",
                lastModified: 1000,
                onSave,
                debounceMs: 200,
            }),
        );
        vi.advanceTimersByTime(100);
        unmount();
        vi.advanceTimersByTime(200);
        expect(onSave).not.toHaveBeenCalled();
    });

    it("uses default debounce of 2000ms when debounceMs is not provided", () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        renderHook(() =>
            useAutoSave({ entityId: "abc", lastModified: 1000, onSave }),
        );
        vi.advanceTimersByTime(1999);
        expect(onSave).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(onSave).toHaveBeenCalledTimes(1);
    });
});
