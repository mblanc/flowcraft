import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "../lib/retry";

const mockLogger = vi.hoisted(() => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
}));

vi.mock("@/app/logger", () => ({ default: mockLogger }));

describe("withRetry", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns result immediately on first success", async () => {
        const fn = vi.fn().mockResolvedValue("success");
        const result = await withRetry(fn, { maxRetries: 3 });
        expect(result).toBe("success");
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries and succeeds on second attempt", async () => {
        const fn = vi
            .fn()
            .mockRejectedValueOnce(new Error("transient"))
            .mockResolvedValue("ok");

        const onRetry = vi.fn();
        const promise = withRetry(fn, {
            maxRetries: 3,
            initialDelay: 100,
            onRetry,
        });

        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result).toBe("ok");
        expect(fn).toHaveBeenCalledTimes(2);
        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(onRetry).toHaveBeenCalledWith(
            1,
            expect.any(Error),
            expect.any(Number),
        );
    });

    it("throws after all retries are exhausted", async () => {
        const error = new Error("persistent");
        const fn = vi.fn().mockRejectedValue(error);
        const onRetry = vi.fn();

        const promise = withRetry(fn, {
            maxRetries: 2,
            initialDelay: 10,
            onRetry,
        });
        // Attach rejection handler before advancing timers to avoid unhandled rejections
        const rejection = expect(promise).rejects.toThrow("persistent");
        await vi.runAllTimersAsync();
        await rejection;

        expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
        expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it("logs warning via default logger when onRetry is not provided", async () => {
        const fn = vi
            .fn()
            .mockRejectedValueOnce(new Error("fail"))
            .mockResolvedValue("done");

        const promise = withRetry(fn, { maxRetries: 1, initialDelay: 10 });
        await vi.runAllTimersAsync();
        await promise;

        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });

    it("logs error via default logger after all retries fail", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("boom"));

        const promise = withRetry(fn, { maxRetries: 1, initialDelay: 10 });
        const rejection = expect(promise).rejects.toThrow("boom");
        await vi.runAllTimersAsync();
        await rejection;

        expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });

    it("uses default maxRetries of 5", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("fail"));

        const promise = withRetry(fn, { initialDelay: 1 });
        const rejection = expect(promise).rejects.toThrow();
        await vi.runAllTimersAsync();
        await rejection;

        expect(fn).toHaveBeenCalledTimes(6); // 1 initial + 5 retries
    });
});
