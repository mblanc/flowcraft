import { describe, it, expect } from "vitest";
import { createSessionService } from "../lib/canvas/adk/session";
import { InMemorySessionService } from "@google/adk";

describe("createSessionService", () => {
    it("returns an InMemorySessionService by default", () => {
        const svc = createSessionService();
        expect(svc).toBeInstanceOf(InMemorySessionService);
    });

    it("can create and retrieve a session", async () => {
        const svc = createSessionService();
        const session = await svc.createSession({
            appName: "flowcraft",
            userId: "user_1",
            sessionId: "user_1:canvas_abc",
        });
        expect(session.id).toBe("user_1:canvas_abc");

        const retrieved = await svc.getSession({
            appName: "flowcraft",
            userId: "user_1",
            sessionId: "user_1:canvas_abc",
        });
        expect(retrieved?.id).toBe("user_1:canvas_abc");
    });

    it("returns undefined for a missing session", async () => {
        const svc = createSessionService();
        const retrieved = await svc.getSession({
            appName: "flowcraft",
            userId: "user_1",
            sessionId: "nonexistent",
        });
        expect(retrieved).toBeUndefined();
    });
});
