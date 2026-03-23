import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useSyncedState } from "../hooks/use-synced-state";

describe("useSyncedState", () => {
    it("returns the initial external value", () => {
        const { result } = renderHook(() => useSyncedState("initial"));
        expect(result.current[0]).toBe("initial");
    });

    it("allows local updates via setter", () => {
        const { result } = renderHook(() => useSyncedState("initial"));

        act(() => {
            result.current[1]("local");
        });

        expect(result.current[0]).toBe("local");
    });

    it("resyncs to external value when it changes", () => {
        let external = "first";
        const { result, rerender } = renderHook(() => useSyncedState(external));
        expect(result.current[0]).toBe("first");

        external = "second";
        rerender();

        expect(result.current[0]).toBe("second");
    });

    it("works with numeric values", () => {
        const { result, rerender } = renderHook(
            ({ val }) => useSyncedState(val),
            { initialProps: { val: 1 } },
        );
        expect(result.current[0]).toBe(1);

        rerender({ val: 42 });
        expect(result.current[0]).toBe(42);
    });

    it("returns a setter as second element", () => {
        const { result } = renderHook(() => useSyncedState(0));
        expect(typeof result.current[1]).toBe("function");
    });
});
