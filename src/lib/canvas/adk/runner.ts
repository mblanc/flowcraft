import {
    Gemini,
    LlmAgent,
    LogLevel,
    Runner,
    SkillToolset,
    StreamingMode,
    loadAllSkillsInDir,
    setLogLevel,
    type BaseSessionService,
} from "@google/adk";
import { PromptEngineer } from "./prompt-engineer";

if (process.env.ADK_LOG_LEVEL === "debug") {
    setLogLevel(LogLevel.DEBUG);
}

import { config } from "@/lib/config";
import { MODELS } from "@/lib/constants";
import logger from "@/app/logger";
import {
    planImageGenerationTool,
    planVideoGenerationTool,
    planProductionTool,
    suggestActionsTool,
} from "./tools";
import { createSessionService } from "./session";
import { buildUserContent } from "./content-builder";
import { extractAgentEvents } from "./event-extractor";
import {
    buildCanvasContext,
    buildDirectorInstruction,
    buildStyleInstruction,
    getModeInstruction,
    SYSTEM_PROMPT,
} from "./prompts";
import type { AgentEvent, AgentInput } from "../agent";
import path from "path";
import { ThinkingLevel } from "@google/genai";

export { extractAgentEvents } from "./event-extractor";

const APP_NAME = "flowcraft-canvas";
const SKILLS_DIR = path.join(process.cwd(), "src/lib/canvas/adk/skills");
const PATTERNS_DIR = path.join(SKILLS_DIR, "patterns");
const PRIMITIVES_DIR = path.join(SKILLS_DIR, "primitives");

export interface CanvasAgentRunnerConfig {
    sessionService?: BaseSessionService;
}

export class CanvasAgentRunner {
    private readonly sessionService: BaseSessionService;
    private patternSkillsCache: Record<string, import("@google/adk").Skill> =
        {};
    private readonly promptEngineer: PromptEngineer;

    constructor(runnerConfig: CanvasAgentRunnerConfig = {}) {
        this.sessionService =
            runnerConfig.sessionService ?? createSessionService();
        this.promptEngineer = new PromptEngineer(PRIMITIVES_DIR);
    }

    private async ensurePatternSkillsLoaded(): Promise<void> {
        if (Object.keys(this.patternSkillsCache).length === 0) {
            try {
                this.patternSkillsCache =
                    await loadAllSkillsInDir(PATTERNS_DIR);
            } catch (err) {
                logger.warn("[CanvasADK] Could not load pattern skills:", err);
            }
        }
    }

    private buildAgentA(model: string, instruction: string): LlmAgent {
        return new LlmAgent({
            name: "CanvasAgentA",
            model: new Gemini({
                model,
                vertexai: true,
                project: config.PROJECT_ID,
                location: config.LOCATION,
            }),
            instruction,
            tools: [
                planImageGenerationTool,
                planVideoGenerationTool,
                suggestActionsTool,
            ],
        });
    }

    private buildAgentB(model: string, instruction: string): LlmAgent {
        const skillToolset = new SkillToolset(this.patternSkillsCache);
        return new LlmAgent({
            name: "Director",
            model: new Gemini({
                model,
                vertexai: true,
                project: config.PROJECT_ID,
                location: config.LOCATION,
            }),
            instruction,
            generateContentConfig: {
                thinkingConfig: {
                    thinkingLevel: ThinkingLevel.LOW,
                    includeThoughts: true,
                },
            },
            tools: [planProductionTool, suggestActionsTool, skillToolset],
        });
    }

    private getRunner(
        model: string,
        instruction: string,
        variant: "a" | "b",
    ): Runner {
        const agent =
            variant === "b"
                ? this.buildAgentB(model, instruction)
                : this.buildAgentA(model, instruction);
        return new Runner({
            appName: APP_NAME,
            agent,
            sessionService: this.sessionService,
        });
    }

    async *stream(input: AgentInput): AsyncGenerator<AgentEvent> {
        const model = input.model || MODELS.TEXT.GEMINI_3_5_FLASH;
        const variant = input.agentVariant ?? "a";

        const canvasContext = buildCanvasContext(input.canvasNodes);
        const styleInstruction = buildStyleInstruction(input.activeStyle);

        let instruction: string;
        if (variant === "b") {
            await this.ensurePatternSkillsLoaded();
            instruction = buildDirectorInstruction(
                canvasContext,
                styleInstruction,
                input.imageDefaults,
                input.videoDefaults,
            );
        } else {
            instruction = [
                SYSTEM_PROMPT,
                getModeInstruction(input.mode),
                canvasContext,
                styleInstruction,
            ].join("");
        }

        const runner = this.getRunner(model, instruction, variant);
        const userId = input.userId ?? "anon";
        const sessionId =
            input.sessionId ?? `${userId}:${input.canvasId ?? "default"}`;

        try {
            await this.sessionService.createSession({
                appName: APP_NAME,
                userId,
                sessionId,
            });
        } catch (err) {
            // A session with this ID may already exist — that's expected.
            // Log anything else so unexpected errors (auth, network) aren't silently swallowed.
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.toLowerCase().includes("already exist")) {
                logger.warn("[CanvasADK] createSession unexpected error:", err);
            }
        }

        const userContent = buildUserContent(input);

        logger.info(
            `[CanvasADK] stream variant=${variant} mode=${input.mode} model=${model} attachments=${input.attachments?.length ?? 0}`,
        );

        try {
            // Agent A streams text in real-time (SSE). Agent B (Director) emits tool calls
            // across multiple turns — SSE mode closes the stream after the first turn so
            // the agentic loop never completes. NONE runs the full loop before returning.
            const streamingMode =
                variant === "b" ? StreamingMode.NONE : StreamingMode.SSE;
            const adkEvents = runner.runAsync({
                userId,
                sessionId,
                newMessage: userContent,
                runConfig: { streamingMode },
            });

            const agentEvents = extractAgentEvents(
                adkEvents,
                input.canvasNodes.map((n) => n.id),
                input.attachments ?? [],
                input.imageDefaults,
                input.videoDefaults,
            );

            for await (const event of agentEvents) {
                if (event.type === "plan" && variant === "b") {
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
