import { InMemorySessionService, type BaseSessionService } from "@google/adk";

// TODO: Replace with a Firestore- or Redis-backed implementation before scaling
// horizontally. InMemorySessionService accumulates one session per user×canvas
// pair with no TTL or eviction — memory grows unboundedly under sustained traffic,
// and all session history is lost on server restart. The injection seam is ready:
// pass a custom BaseSessionService via CanvasAgentRunnerConfig.sessionService.
export function createSessionService(): BaseSessionService {
    return new InMemorySessionService();
}
