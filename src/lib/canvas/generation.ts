import { randomUUID } from "crypto";
import { geminiService } from "@/lib/services/gemini.service";
import { storageService } from "@/lib/services/storage.service";
import { concatService } from "@/lib/services/concat.service";
import { libraryService } from "@/lib/services/library.service";
import logger from "@/app/logger";
import { topoSort } from "./adk/topology";
import type { AgentPlan, GenerationStep, NodePayload, PlanEdge } from "./types";

export type StepEvent =
    | { type: "step_start"; stepId: string }
    | { type: "step_done"; stepId: string; node: NodePayload }
    | { type: "step_error"; stepId: string; message: string };

interface ExecutionContext {
    /** Maps stepId → GCS URI of the completed node */
    completedStepUris: Map<string, string>;
    /** Maps nodeId → GCS URI from the user's existing canvas attachments */
    attachmentUris: Map<string, string>;
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

    // Resolve dependsOn to URIs from completed steps
    const dependencyUrls: string[] = (step.dependsOn ?? [])
        .map((depId) => ctx.completedStepUris.get(depId))
        .filter((uri): uri is string => !!uri);

    // Resolve existing canvas node references
    const referenceUrls: string[] = (step.referenceNodeIds ?? [])
        .map((id) => getUri(id))
        .filter((uri): uri is string => !!uri);

    // For video: first/last frame from existing canvas nodes
    const firstFrameUrl = step.firstFrameNodeId
        ? getUri(step.firstFrameNodeId)
        : undefined;
    const lastFrameUrl = step.lastFrameNodeId
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

async function executeImageStep(
    step: GenerationStep,
    ctx: ExecutionContext,
    styleContent?: string,
    styleId?: string,
    styleName?: string,
): Promise<NodePayload> {
    const { referenceUrls } = resolveReferences(step, ctx);

    const { data, mimeType } = await geminiService.generateImage({
        prompt: step.prompt,
        images: referenceUrls.map((url) => ({ url, type: "image/png" })),
        aspectRatio: step.aspectRatio,
        imageSize: step.imageSize,
        model: step.model,
        systemInstruction: styleContent,
    });

    const extension = mimeType.split("/")[1] || "png";
    const sanitizedLabel = (step.label || "image")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    const baseName = sanitizedLabel || "image";

    const sourceUrl = await storageService.uploadImage(
        data,
        `${baseName}-${randomUUID()}.${extension}`,
    );

    return {
        id: randomUUID(),
        type: "canvas-image",
        label: step.label ?? "Image",
        sourceUrl,
        mimeType,
        prompt: step.prompt,
        aspectRatio: step.aspectRatio,
        imageSize: step.imageSize,
        model: step.model,
        referenceNodeIds: step.referenceNodeIds,
        styleId,
        styleName,
        planNodeId: step.id,
        operation: "t2i" as const,
        ...(step.dependsOn && step.dependsOn.length > 0
            ? { derivedFrom: step.dependsOn }
            : {}),
    };
}

async function executeVideoStep(
    step: GenerationStep,
    ctx: ExecutionContext,
    styleContent?: string,
    styleId?: string,
    styleName?: string,
): Promise<NodePayload> {
    const { referenceUrls, firstFrameUrl, lastFrameUrl } = resolveReferences(
        step,
        ctx,
    );

    const sourceUrl = await geminiService.generateVideo({
        prompt: step.prompt,
        firstFrame: firstFrameUrl,
        lastFrame: lastFrameUrl,
        images:
            referenceUrls.length > 0
                ? referenceUrls.map((url) => ({ url, type: "image/png" }))
                : undefined,
        aspectRatio: step.aspectRatio,
        duration: step.duration,
        model: step.model,
        generateAudio: step.generateAudio,
        resolution: step.resolution,
        styleInstruction: styleContent,
    });

    return {
        id: randomUUID(),
        type: "canvas-video",
        label: step.label ?? "Video",
        sourceUrl,
        mimeType: "video/mp4",
        prompt: step.prompt,
        aspectRatio: step.aspectRatio,
        resolution: step.resolution,
        model: step.model,
        referenceNodeIds: step.referenceNodeIds,
        styleId,
        styleName,
        planNodeId: step.id,
        operation: step.firstFrameNodeId ? ("i2v" as const) : ("t2v" as const),
        ...(step.dependsOn && step.dependsOn.length > 0
            ? { derivedFrom: step.dependsOn }
            : {}),
    };
}

async function executeConcatStep(
    step: GenerationStep,
    ctx: ExecutionContext,
): Promise<NodePayload> {
    // Collect URIs from dependsOn steps in declaration order (narrative order)
    const inputUris = (step.dependsOn ?? [])
        .map((depId) => ctx.completedStepUris.get(depId))
        .filter((uri): uri is string => !!uri);

    if (inputUris.length === 0) {
        throw new Error(
            `Concat step "${step.id}" has no resolved input URIs — all dependsOn steps must complete first`,
        );
    }

    const sourceUrl = await concatService.concatVideos(inputUris);

    return {
        id: randomUUID(),
        type: "canvas-video",
        label: step.label ?? "Final cut",
        sourceUrl,
        mimeType: "video/mp4",
        prompt: step.prompt,
        operation: "concat" as const,
        ...(step.dependsOn && step.dependsOn.length > 0
            ? { derivedFrom: step.dependsOn }
            : {}),
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
): AsyncGenerator<StepEvent> {
    const ctx: ExecutionContext = {
        completedStepUris: new Map(),
        attachmentUris: nodeUris,
    };

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
                    let node: NodePayload;
                    if (step.type === "image") {
                        node = await executeImageStep(
                            step,
                            ctx,
                            activeStyleContent,
                            activeStyleId,
                            activeStyleName,
                        );
                    } else if (step.type === "concat") {
                        node = await executeConcatStep(step, ctx);
                    } else {
                        node = await executeVideoStep(
                            step,
                            ctx,
                            activeStyleContent,
                            activeStyleId,
                            activeStyleName,
                        );
                    }

                    // Record URI so dependent steps can reference it
                    ctx.completedStepUris.set(step.id, node.sourceUrl);

                    // Fire-and-forget: save to library
                    const libraryType =
                        step.type === "concat" ? "video" : step.type;
                    libraryService
                        .createAsset({
                            userId,
                            type: libraryType,
                            gcsUri: node.sourceUrl,
                            mimeType: node.mimeType ?? "image/png",
                            aspectRatio: node.aspectRatio,
                            model: node.model,
                            tags: [],
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
