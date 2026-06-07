import { describe, it, expect, vi } from "vitest";
import {
    executeLLMNode,
    executeImageNode,
    executeVideoNode,
    executeUpscaleNode,
    executeResizeNode,
} from "../lib/executors";

vi.mock("@/app/logger", () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("executors re-exports", () => {
    it("exports all node executor functions", () => {
        expect(typeof executeLLMNode).toBe("function");
        expect(typeof executeImageNode).toBe("function");
        expect(typeof executeVideoNode).toBe("function");
        expect(typeof executeUpscaleNode).toBe("function");
        expect(typeof executeResizeNode).toBe("function");
    });
});
