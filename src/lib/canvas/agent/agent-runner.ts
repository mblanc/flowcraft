import {
    Runner,
    StreamingMode,
    setLogLevel,
    LogLevel,
    createEvent,
    type BaseSessionService,
    type Session,
} from "@google/adk";
import { PromptEngineer } from "./prompt-engineer";
import { CanvasAgent } from "./canvas-agent";
import { skillService } from "@/lib/services/skill.service";

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
import type { AgentEvent, AgentInput, ChatMessage } from "../types";
import path from "path";

export { extractAgentEvents } from "./event-extractor";

const APP_NAME = "flowcraft-canvas";
const SKILLS_DIR = path.join(process.cwd(), "src/lib/canvas/agent/skills");
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
        let forceInstruction = "";

        await this.agent.ensurePatternSkillsLoaded();
        const builtInSkills = this.agent.patternSkills;
        const userSkills = input.userId
            ? await skillService.listSkills(input.userId, undefined, "my")
            : [];

        const messageTrim = input.message.trim();
        if (messageTrim.startsWith("/")) {
            const tokens = messageTrim.split(/\s+/);
            const command = tokens[0];
            const commandName = command.slice(1).toLowerCase();

            if (commandName === "skills") {
                let content =
                    "Here are the available pattern skills for this canvas. You can enable or disable them:\n\n";

                content += "### Built-in Skills\n";
                for (const [name, skill] of Object.entries(builtInSkills)) {
                    const isEnabled = !(input.disabledSkills ?? []).includes(
                        name,
                    );
                    const checkbox = isEnabled
                        ? "✅ [Enabled]"
                        : "❌ [Disabled]";
                    content += `- **${name}**: ${skill.frontmatter.description || "No description."}\n  *Status*: ${checkbox}\n`;
                }

                content += "\n### My Custom Skills\n";
                if (userSkills.length === 0) {
                    content += "_No custom skills created yet._\n";
                } else {
                    for (const userSkill of userSkills) {
                        const isEnabled = !(
                            input.disabledSkills ?? []
                        ).includes(userSkill.name);
                        const checkbox = isEnabled
                            ? "✅ [Enabled]"
                            : "❌ [Disabled]";
                        content += `- **${userSkill.name}**: ${userSkill.description || "No description."}\n  *Status*: ${checkbox}\n`;
                    }
                }

                yield { type: "text", delta: content };
                yield { type: "done" };
                return;
            } else {
                const existsBuiltIn = builtInSkills[commandName] !== undefined;
                const existsUser = userSkills.some(
                    (s) => s.name === commandName,
                );
                const isSkillDisabled = (input.disabledSkills ?? []).includes(
                    commandName,
                );

                if ((existsBuiltIn || existsUser) && !isSkillDisabled) {
                    const remainingPrompt = tokens.slice(1).join(" ").trim();
                    input.message =
                        remainingPrompt || `Run the ${commandName} skill.`;
                    forceInstruction = `\n\nCRITICAL: The user has explicitly forced the use of the skill: '${commandName}'. You MUST invoke this skill immediately in your first turn to process this request.`;
                } else if (isSkillDisabled) {
                    yield {
                        type: "error",
                        message: `The skill '${commandName}' is currently disabled on this canvas. Enable it to use it.`,
                    };
                    yield { type: "done" };
                    return;
                } else {
                    yield {
                        type: "error",
                        message: `Unknown command '/${commandName}'. Type /skills to see all available pattern skills.`,
                    };
                    yield { type: "done" };
                    return;
                }
            }
        }

        const instruction =
            buildDirectorInstruction(
                buildCanvasContext(input.canvasNodes),
                buildStyleInstruction(input.activeStyle),
                input.imageDefaults,
                input.videoDefaults,
                input.userName,
            ) + forceInstruction;

        const llmAgent = await this.agent.build(
            model,
            instruction,
            userSkills,
            input.disabledSkills ?? [],
        );
        const runner = new Runner({
            appName: APP_NAME,
            agent: llmAgent,
            sessionService: this.sessionService,
        });

        const userId = input.userId ?? "anon";
        const clientSessionId = input.sessionId ?? input.canvasId ?? "default";
        const sessionId = `${userId}:${clientSessionId}`;

        // getOrCreateSession preserves the existing session if it already has events.
        // createSession would overwrite it with an empty one on every request.
        const session = await this.sessionService.getOrCreateSession({
            appName: APP_NAME,
            userId,
            sessionId,
        });

        // Reseed from persisted history if the session is empty (fresh session or
        // reset after HMR / cold start). Without this, the ADK runner sees no prior
        // context.
        if (session.events.length === 0 && input.history.length > 0) {
            await this.seedSessionFromHistory(session, input.history);
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

    private async seedSessionFromHistory(
        session: Session,
        history: ChatMessage[],
    ): Promise<void> {
        let seeded = 0;
        for (const msg of history) {
            if (msg.role === "system") continue;
            const text = msg.content?.trim();
            if (!text) continue;

            const event = createEvent({
                invocationId: msg.id,
                author: msg.role === "user" ? "user" : "Director",
                content: {
                    role: msg.role === "user" ? "user" : "model",
                    parts: [{ text }],
                },
            });

            await this.sessionService.appendEvent({ session, event });
            seeded++;
        }
        logger.info(
            `[CanvasADK] reseeded session from ${seeded} persisted messages`,
        );
    }
}
