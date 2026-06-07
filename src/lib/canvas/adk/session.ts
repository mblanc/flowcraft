import { InMemorySessionService, type BaseSessionService } from "@google/adk";

export function createSessionService(): BaseSessionService {
    return new InMemorySessionService();
}
