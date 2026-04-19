import { randomUUID } from "crypto";
import { geminiService } from "@/lib/services/gemini.service";
import { storageService } from "@/lib/services/storage.service";
import { libraryService } from "@/lib/services/library.service";
import logger from "@/app/logger";
import type {
    AgentPlan,
    GenerationStep,
    NodePayload,
} from "@/lib/canvas-types";

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

    // If this step depends on a previous step and no explicit frame was set,
    // use the first dependency as the first frame for video
    if (
        step.type === "video" &&
        dependencyUrls.length > 0 &&
        !firstFrameUrl &&
        !lastFrameUrl
    ) {
        return {
            referenceUrls,
            firstFrameUrl: dependencyUrls[0],
            lastFrameUrl: dependencyUrls[1],
        };
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
): Promise<NodePayload> {
    const { referenceUrls } = resolveReferences(step, ctx);

    const { data, mimeType } = await geminiService.generateImage({
        prompt: step.prompt,
        images: referenceUrls.map((url) => ({ url, type: "image/png" })),
        aspectRatio: step.aspectRatio,
        resolution: step.resolution,
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
        model: step.model,
        referenceNodeIds: step.referenceNodeIds,
    };
}

async function executeVideoStep(
    step: GenerationStep,
    ctx: ExecutionContext,
    styleContent?: string,
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
        model: step.model,
        referenceNodeIds: step.referenceNodeIds,
    };
}

/** Build execution waves via topological sort on dependsOn */
function buildExecutionWaves(steps: GenerationStep[]): GenerationStep[][] {
    const remaining = new Set(steps.map((s) => s.id));
    const waves: GenerationStep[][] = [];

    while (remaining.size > 0) {
        const wave = steps.filter(
            (s) =>
                remaining.has(s.id) &&
                (s.dependsOn ?? []).every((dep) => !remaining.has(dep)),
        );

        if (wave.length === 0) {
            // Cycle or missing dependency — execute remaining steps as a fallback wave
            logger.warn(
                "[CanvasGeneration] Could not resolve dependencies, executing remaining steps",
            );
            waves.push(steps.filter((s) => remaining.has(s.id)));
            break;
        }

        waves.push(wave);
        wave.forEach((s) => remaining.delete(s.id));
    }

    return waves;
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
                    const node =
                        step.type === "image"
                            ? await executeImageStep(
                                  step,
                                  ctx,
                                  activeStyleContent,
                              )
                            : await executeVideoStep(
                                  step,
                                  ctx,
                                  activeStyleContent,
                              );

                    // Record URI so dependent steps can reference it
                    ctx.completedStepUris.set(step.id, node.sourceUrl);

                    // Fire-and-forget: save to library
                    libraryService
                        .createAsset({
                            userId,
                            type: step.type,
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
