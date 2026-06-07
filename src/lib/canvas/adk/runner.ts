import {
    Runner,
    StreamingMode,
    setLogLevel,
    LogLevel,
    type BaseSessionService,
} from "@google/adk";
import { PromptEngineer } from "./prompt-engineer";
import { CanvasAgent } from "./canvas-agent";

if (process.env.ADK_LOG_LEVEL === "debug") {
    setLogLevel(LogLevel.DEBUG);
}

import { MODELS } from "@/lib/constants";
import logger from "@/app/logger";
import { createSessionService } from "./session";
import { buildUserContent } from "./content-builder";
import { extractAgentEvents } from "./event-extractor";
import {
    buildCanvasContext,
    buildDirectorInstruction,
    buildStyleInstruction,
} from "./prompts";
import type { AgentEvent, AgentInput } from "../types";
import path from "path";

export { extractAgentEvents } from "./event-extractor";

const APP_NAME = "flowcraft-canvas";
const SKILLS_DIR = path.join(process.cwd(), "src/lib/canvas/adk/skills");
const PRIMITIVES_DIR = path.join(SKILLS_DIR, "primitives");

export interface CanvasAgentRunnerConfig {
    sessionService?: BaseSessionService;
}

export class CanvasAgentRunner {
    private readonly sessionService: BaseSessionService;
    private readonly agent: CanvasAgent;
    private readonly promptEngineer: PromptEngineer;

    constructor(runnerConfig: CanvasAgentRunnerConfig = {}) {
        this.sessionService =
            runnerConfig.sessionService ?? createSessionService();
        this.agent = new CanvasAgent();
        this.promptEngineer = new PromptEngineer(PRIMITIVES_DIR);
    }

    async *stream(input: AgentInput): AsyncGenerator<AgentEvent> {
        const model = input.model || MODELS.TEXT.GEMINI_3_5_FLASH;

        const instruction = buildDirectorInstruction(
            buildCanvasContext(input.canvasNodes),
            buildStyleInstruction(input.activeStyle),
            input.imageDefaults,
            input.videoDefaults,
        );

        const llmAgent = await this.agent.build(model, instruction);
        const runner = new Runner({
            appName: APP_NAME,
            agent: llmAgent,
            sessionService: this.sessionService,
        });

        const userId = input.userId ?? "anon";
        const clientSessionId = input.sessionId ?? input.canvasId ?? "default";
        const sessionId = `${userId}:${clientSessionId}`;

        try {
            await this.sessionService.createSession({
                appName: APP_NAME,
                userId,
                sessionId,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.toLowerCase().includes("already exist")) {
                logger.warn("[CanvasADK] createSession unexpected error:", err);
            }
        }

        const userContent = buildUserContent(input);

        logger.info(
            `[CanvasADK] stream model=${model} attachments=${input.attachments?.length ?? 0}`,
        );
        logger.debug("[CanvasADK] instruction sent to LLM:\n" + instruction);
        logger.debug(
            "[CanvasADK] pattern skills available: " +
                this.agent.loadedPatternNames.join(", "),
        );

        try {
            const adkEvents = runner.runAsync({
                userId,
                sessionId,
                newMessage: userContent,
                runConfig: { streamingMode: StreamingMode.NONE },
            });

            const agentEvents = extractAgentEvents(
                adkEvents,
                input.canvasNodes.map((n) => n.id),
                input.attachments ?? [],
                input.imageDefaults,
                input.videoDefaults,
            );

            for await (const event of agentEvents) {
                if (event.type === "plan") {
                    yield {
                        type: "agent_action",
                        label: "Engineering prompts",
                    };
                    const enrichedSteps = await this.promptEngineer.enrichSteps(
                        event.plan.steps,
                        input.canvasNodes,
                        input.activeStyle,
                    );
                    yield { type: "plan", plan: { steps: enrichedSteps } };
                } else {
                    yield event;
                }
            }
        } catch (error) {
            logger.error("[CanvasADK] stream error:", error);
            yield {
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "An error occurred processing your request.",
            };
            yield { type: "done" };
        }
    }
}
