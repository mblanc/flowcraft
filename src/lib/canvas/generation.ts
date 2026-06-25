import { randomUUID } from "crypto";
import { libraryService } from "@/lib/services/library.service";
import logger from "@/app/logger";
import { topoSort } from "./agent/topology";
import type { AgentPlan, GenerationStep, NodePayload, PlanEdge } from "./types";
import { serverRegistry as registry } from "@/primitives/server-registry";

export type StepEvent =
    | { type: "step_start"; stepId: string }
    | { type: "step_done"; stepId: string; node: NodePayload }
    | { type: "step_error"; stepId: string; message: string };

interface ExecutionContext {
    /** Maps stepId → GCS URI of the completed node */
    completedStepUris: Map<string, string>;
    /** Maps nodeId → GCS URI from the user's existing canvas attachments */
    attachmentUris: Map<string, string>;
    /** Maps stepId/nodeId → its media type */
    nodeTypes: Map<string, string>;
}

/**
 * Resolve the GCS URIs for a step's references.
 * Merges existing canvas attachment URIs with outputs from previous steps.
 */
function resolveReferences(
    step: GenerationStep,
    ctx: ExecutionContext,
): {
    referenceUrls: string[];
    firstFrameUrl?: string;
    lastFrameUrl?: string;
} {
    // nodeUriMap contains ALL canvas nodes, so any node referenced by label/id resolves
    const getUri = (nodeId: string): string | undefined =>
        ctx.attachmentUris.get(nodeId);

    const isAudio = (id: string): boolean => {
        const type = ctx.nodeTypes.get(id);
        return type === "audio" || type === "canvas-audio";
    };

    // Resolve dependsOn to URIs from completed steps, filtering out audio dependencies for visual steps
    const dependencyUrls: string[] = (step.dependsOn ?? [])
        .filter((depId) => {
            if (step.type === "video" || step.type === "image") {
                return !isAudio(depId);
            }
            return true;
        })
        .map((depId) => ctx.completedStepUris.get(depId))
        .filter((uri): uri is string => !!uri);

    // Resolve existing canvas node references, filtering out audio references for visual steps
    const referenceUrls: string[] = (step.referenceNodeIds ?? [])
        .filter((id) => {
            if (step.type === "video" || step.type === "image") {
                return !isAudio(id);
            }
            return true;
        })
        .map((id) => getUri(id))
        .filter((uri): uri is string => !!uri);

    // For video: first/last frame from existing canvas nodes, ensuring they are not audio
    const firstFrameUrl =
        step.firstFrameNodeId && !isAudio(step.firstFrameNodeId)
            ? getUri(step.firstFrameNodeId)
            : undefined;
    const lastFrameUrl =
        step.lastFrameNodeId && !isAudio(step.lastFrameNodeId)
            ? getUri(step.lastFrameNodeId)
            : undefined;

    if (step.type === "video" && !firstFrameUrl && !lastFrameUrl) {
        // For video: promote the first available image to firstFrame (via source.image).
        // referenceImages is not supported by all models; source.image is universal.
        if (dependencyUrls.length > 0) {
            if (dependencyUrls.length > 2) {
                logger.warn(
                    `[CanvasGeneration] Video step "${step.id}" has ${dependencyUrls.length} dependencies; only first two used as frames`,
                );
            }
            return {
                referenceUrls,
                firstFrameUrl: dependencyUrls[0],
                lastFrameUrl: dependencyUrls[1],
            };
        }
        if (referenceUrls.length > 0) {
            return {
                referenceUrls: referenceUrls.slice(1),
                firstFrameUrl: referenceUrls[0],
            };
        }
    }

    return {
        referenceUrls: [...referenceUrls, ...dependencyUrls],
        firstFrameUrl,
        lastFrameUrl,
    };
}

/** Build execution waves via topological sort on dependsOn edges. */
function buildExecutionWaves(steps: GenerationStep[]): GenerationStep[][] {
    const edges: PlanEdge[] = steps.flatMap((s) =>
        (s.dependsOn ?? []).map((dep) => ({
            from: dep,
            to: s.id,
            role: "depends_on" as const,
        })),
    );
    try {
        return topoSort(steps, edges);
    } catch {
        // Cycle or missing dependency — fall back to executing all as one wave
        logger.warn(
            "[CanvasGeneration] Cycle detected in plan dependencies, executing all steps together",
        );
        return [steps];
    }
}

/**
 * Execute a generation plan, yielding step events as each step starts/completes.
 * Steps without dependencies are executed in parallel within the same wave.
 */
export async function* executePlan(
    plan: AgentPlan,
    nodeUris: Map<string, string>,
    userId: string,
    canvasId: string,
    canvasName: string,
    activeStyleContent?: string,
    activeStyleId?: string,
    activeStyleName?: string,
    defaultMusicModel?: string,
    nodeTypes?: Map<string, string>,
): AsyncGenerator<StepEvent> {
    const ctx: ExecutionContext = {
        completedStepUris: new Map(),
        attachmentUris: nodeUris,
        nodeTypes: new Map<string, string>(),
    };

    // Pre-populate all step types from the plan
    for (const step of plan.steps) {
        ctx.nodeTypes.set(step.id, step.type);
    }

    // Populate types for existing canvas nodes
    if (nodeTypes) {
        for (const [id, type] of nodeTypes.entries()) {
            ctx.nodeTypes.set(id, type);
        }
    }

    const waves = buildExecutionWaves(plan.steps);
    logger.info(
        `[CanvasGeneration] Executing plan: ${plan.steps.length} steps in ${waves.length} wave(s)`,
    );

    for (const wave of waves) {
        // Emit step_start for all steps in this wave
        for (const step of wave) {
            yield { type: "step_start", stepId: step.id };
        }

        // Execute all steps in this wave in parallel
        const results = await Promise.allSettled(
            wave.map(async (step) => {
                try {
                    const primitive = registry.getByCanvasType(
                        `canvas-${step.type}`,
                    );
                    if (!primitive?.canvas || !primitive.execute) {
                        throw new Error(
                            `[CanvasGeneration] No primitive for step type: ${step.type}`,
                        );
                    }

                    // Resolve canvas references before calling into the primitive.
                    const { referenceUrls, firstFrameUrl, lastFrameUrl } =
                        resolveReferences(step, ctx);

                    const enrichedStep = {
                        ...step,
                        // Apply music model default when agent hasn't set one
                        ...(step.type === "audio" &&
                        !step.model &&
                        defaultMusicModel
                            ? { model: defaultMusicModel }
                            : {}),
                        images: referenceUrls.map((url) => ({
                            url,
                            type: "image/png",
                        })),
                        firstFrame: firstFrameUrl,
                        lastFrame: lastFrameUrl,
                        // concat: pre-resolve dependsOn / canvas URIs in order
                        inputUris:
                            step.type === "concat"
                                ? (
                                      step.concatInputs ?? [
                                          ...(step.referenceNodeIds ?? []),
                                          ...(step.dependsOn ?? []),
                                      ]
                                  )
                                      .map(
                                          (id) =>
                                              ctx.completedStepUris.get(id) ??
                                              ctx.attachmentUris.get(id),
                                      )
                                      .filter(
                                          (uri): uri is string => uri != null,
                                      )
                                : undefined,
                        // style forwarded as convention fields
                        systemInstruction:
                            step.type === "image"
                                ? activeStyleContent
                                : undefined,
                        styleInstruction:
                            step.type === "video"
                                ? activeStyleContent
                                : undefined,
                        styleId: activeStyleId,
                        styleName: activeStyleName,
                        // operation inferred for video
                        operation:
                            step.type === "video"
                                ? firstFrameUrl
                                    ? "i2v"
                                    : "t2v"
                                : undefined,
                        planNodeId: step.id,
                        derivedFrom: step.dependsOn?.length
                            ? step.dependsOn
                            : undefined,
                    };

                    const request = primitive.canvas.toRequest(enrichedStep, {
                        userId,
                    });
                    const output = await primitive.execute(request, { userId });
                    const nodeData = primitive.canvas.toCanvasData(
                        enrichedStep,
                        output,
                    );
                    const node: NodePayload = {
                        ...(nodeData as NodePayload),
                        id: randomUUID(),
                    };

                    // Record URI so dependent steps can reference it
                    ctx.completedStepUris.set(step.id, node.sourceUrl);

                    // Fire-and-forget: save to library (audio not yet supported)
                    if (node.type !== "canvas-audio") {
                        const libraryType = (
                            node.type === "canvas-video" ? "video" : "image"
                        ) as "video" | "image";
                        libraryService
                            .createAsset({
                                userId,
                                type: libraryType,
                                gcsUri: node.sourceUrl,
                                mimeType: node.mimeType ?? "image/png",
                                aspectRatio: node.aspectRatio,
                                model: node.model,
                                tags: [],
                                visibility: "private" as const,
                                provenance: {
                                    sourceType: "canvas",
                                    sourceId: canvasId,
                                    sourceName: canvasName,
                                    nodeId: node.id,
                                    nodeLabel: node.label,
                                    prompt: node.prompt,
                                },
                            })
                            .catch((err) =>
                                logger.warn(
                                    "[CanvasGeneration] Library save failed:",
                                    err,
                                ),
                            );
                    }

                    return { step, node };
                } catch (error) {
                    logger.error(
                        `[CanvasGeneration] Step ${step.id} failed:`,
                        error,
                    );
                    throw { step, error };
                }
            }),
        );

        // Yield events for each result in original step order
        for (let i = 0; i < wave.length; i++) {
            const result = results[i];
            const step = wave[i];

            if (result.status === "fulfilled") {
                yield {
                    type: "step_done",
                    stepId: step.id,
                    node: result.value.node,
                };
            } else {
                const err = result.reason as { error: unknown };
                yield {
                    type: "step_error",
                    stepId: step.id,
                    message:
                        err.error instanceof Error
                            ? err.error.message
                            : "Generation failed",
                };
            }
        }
    }
}
