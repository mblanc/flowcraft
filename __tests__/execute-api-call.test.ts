import { describe, it, expect, vi } from "vitest";
import { executeNodeApiCall } from "../lib/nodes/shared/execute-api-call";

describe("executeNodeApiCall", () => {
    it("returns parsed JSON on successful response", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ result: "ok" }),
            text: () => Promise.resolve(""),
        });

        const result = await executeNodeApiCall<{ result: string }>(
            "/api/test",
            { input: "value" },
            { fetch: mockFetch },
        );

        expect(result).toEqual({ result: "ok" });
        expect(mockFetch).toHaveBeenCalledWith("/api/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ input: "value" }),
        });
    });

    it("throws on non-ok response with error text", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            text: () => Promise.resolve("Internal Server Error"),
        });

        await expect(
            executeNodeApiCall("/api/test", {}, { fetch: mockFetch }),
        ).rejects.toThrow("Request to /api/test failed: Internal Server Error");
    });

    it("uses global fetch when no context fetch is provided", async () => {
        const globalFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ data: 42 }),
        });
        vi.stubGlobal("fetch", globalFetch);

        const result = await executeNodeApiCall<{ data: number }>(
            "/api/global",
            {},
        );

        expect(result).toEqual({ data: 42 });
        expect(globalFetch).toHaveBeenCalled();

        vi.unstubAllGlobals();
    });
});
