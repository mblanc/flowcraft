import { vi } from "vitest";

vi.mock("@/app/logger", () => ({
    default: {
        error: console.error.bind(console),
        warn: console.warn.bind(console),
        info: console.info.bind(console),
        debug: console.debug.bind(console),
    },
}));
