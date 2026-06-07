import logger from "@/app/logger";
import { applyVideoFallback } from "../agent";
import type { MediaDefaults, VideoDefaults } from "../agent";
import type { ChatAttachment, GenerationStep, PlanNode } from "../types";

export const VALID_IMAGE_MODELS = new Set([
    "gemini-2.5-flash-image",
    "gemini-3-pro-image",
    "gemini-3.1-flash-image",
]);

export const VALID_VIDEO_MODELS = new Set([
    "veo-3.1-lite-generate-001",
    "veo-3.1-fast-generate-001",
    "veo-3.1-generate-001",
]);

function resolveModel(
    stepModel: string | undefined,
    defaultModel: string | undefined,
    validModels: Set<string>,
): string | undefined {
    const candidate = stepModel ?? defaultModel;
    if (!candidate) return undefined;
    if (!validModels.has(candidate)) {
        logger.warn(`[CanvasADK] Ignored unrecognized model: ${candidate}`);
        return defaultModel && validModels.has(defaultModel)
            ? defaultModel
            : undefined;
    }
    return candidate;
}

export function applyTypeDefaults(
    step: GenerationStep,
    imageDefaults?: MediaDefaults,
    videoDefaults?: VideoDefaults,
): GenerationStep {
    const isVideo = step.type === "video";
    const defaults = isVideo ? videoDefaults : imageDefaults;
    const validModels = isVideo ? VALID_VIDEO_MODELS : VALID_IMAGE_MODELS;
    const resolvedModel = resolveModel(
        step.model,
        defaults?.model,
        validModels,
    );
    return {
        ...step,
        aspectRatio: step.aspectRatio ?? defaults?.aspectRatio ?? "16:9",
        ...(!isVideo && (step.imageSize ?? imageDefaults?.imageSize)
            ? { imageSize: step.imageSize ?? imageDefaults?.imageSize }
            : {}),
        ...(resolvedModel ? { model: resolvedModel } : { model: undefined }),
        ...(isVideo
            ? {
                  generateAudio:
                      step.generateAudio ??
                      videoDefaults?.generateAudio ??
                      false,
                  ...((step.resolution ?? videoDefaults?.resolution)
                      ? {
                            resolution:
                                step.resolution ?? videoDefaults?.resolution,
                        }
                      : {}),
                  ...(() => {
                      const raw = step.duration ?? videoDefaults?.duration;
                      const valid = raw && [4, 6, 8].includes(raw) ? raw : 4;
                      return { duration: valid };
                  })(),
              }
            : {}),
    };
}

export function validateStepNodeIds(
    step: GenerationStep,
    canvasNodeIds: string[],
    attachmentNodeIds: string[],
): GenerationStep {
    const isValidId = (id: string) =>
        canvasNodeIds.includes(id) || attachmentNodeIds.includes(id);

    const validated = { ...step };

    if (step.referenceNodeIds && step.referenceNodeIds.length > 0) {
        const valid = step.referenceNodeIds.filter(isValidId);
        if (valid.length < step.referenceNodeIds.length) {
            logger.warn("[CanvasADK] Ignored hallucinated referenceNodeIds");
        }
        validated.referenceNodeIds = valid.length > 0 ? valid : undefined;
    }

    if (step.firstFrameNodeId && !isValidId(step.firstFrameNodeId)) {
        logger.warn(
            `[CanvasADK] Ignored hallucinated firstFrameNodeId: ${step.firstFrameNodeId}`,
        );
        validated.firstFrameNodeId = undefined;
    }

    if (step.lastFrameNodeId && !isValidId(step.lastFrameNodeId)) {
        logger.warn(
            `[CanvasADK] Ignored hallucinated lastFrameNodeId: ${step.lastFrameNodeId}`,
        );
        validated.lastFrameNodeId = undefined;
    }

    return validated;
}

const IMAGE_OPS = new Set(["t2i", "i2i"]);
const VIDEO_OPS = new Set(["t2v", "i2v", "i2v2"]);

export function mapPlanNodesToSteps(
    planNodes: PlanNode[],
    edges: Array<{ from: string; to: string; role: string }>,
    canvasNodeIds: string[],
    attachmentNodeIds: string[],
    imageDefaults?: MediaDefaults,
    videoDefaults?: VideoDefaults,
): GenerationStep[] {
    const planNodeIds = new Set(planNodes.map((n) => n.id));
    const isCanvasId = (id: string) =>
        canvasNodeIds.includes(id) || attachmentNodeIds.includes(id);

    const nodeRefs = new Map<string, string[]>();
    const nodeDeps = new Map<string, string[]>();

    for (const { from, to, role } of edges) {
        if (!planNodeIds.has(to)) continue;

        if (role === "subject_ref" || role === "style_ref") {
            if (isCanvasId(from)) {
                const refs = nodeRefs.get(to) ?? [];
                refs.push(from);
                nodeRefs.set(to, refs);
            } else if (planNodeIds.has(from)) {
                const deps = nodeDeps.get(to) ?? [];
                deps.push(from);
                nodeDeps.set(to, deps);
            }
        } else if (role === "depends_on") {
            if (isCanvasId(from)) {
                const refs = nodeRefs.get(to) ?? [];
                refs.push(from);
                nodeRefs.set(to, refs);
            } else if (planNodeIds.has(from)) {
                const deps = nodeDeps.get(to) ?? [];
                deps.push(from);
                nodeDeps.set(to, deps);
            }
        }
    }

    return planNodes.flatMap((node): GenerationStep[] => {
        let type: "image" | "video";
        if (IMAGE_OPS.has(node.operation)) {
            type = "image";
        } else if (VIDEO_OPS.has(node.operation)) {
            type = "video";
        } else {
            logger.warn(
                `[CanvasADK] plan_production: skipping unsupported operation "${node.operation}" on node ${node.id}`,
            );
            return [];
        }

        const refs = nodeRefs.get(node.id);
        const deps = nodeDeps.get(node.id);

        const step: GenerationStep = {
            id: node.id,
            type,
            prompt: node.prompt ?? node.promptIntent,
            ...(node.label ? { label: node.label } : {}),
            ...(node.aspectRatio ? { aspectRatio: node.aspectRatio } : {}),
            ...(type === "image" && node.imageSize
                ? { imageSize: node.imageSize }
                : {}),
            ...(type === "video" && node.resolution
                ? { resolution: node.resolution }
                : {}),
            ...(node.model ? { model: node.model } : {}),
            ...(type === "video" && node.duration
                ? (() => {
                      const raw = Number(node.duration);
                      return {
                          duration: ([4, 6, 8].includes(raw) ? raw : 4) as
                              | 4
                              | 6
                              | 8,
                      };
                  })()
                : {}),
            ...(type === "video"
                ? { generateAudio: node.generateAudio ?? false }
                : {}),
            ...(refs && refs.length > 0 ? { referenceNodeIds: refs } : {}),
            ...(deps && deps.length > 0 ? { dependsOn: deps } : {}),
        };

        let validated = applyTypeDefaults(step, imageDefaults, videoDefaults);
        validated = validateStepNodeIds(
            validated,
            canvasNodeIds,
            attachmentNodeIds,
        );
        return [validated];
    });
}

export function mapSimpleSteps(
    raw: GenerationStep[],
    inferredType: "image" | "video",
    canvasNodeIds: string[],
    attachments: ChatAttachment[],
    imageDefaults?: MediaDefaults,
    videoDefaults?: VideoDefaults,
): GenerationStep[] {
    const attachmentNodeIds = attachments.map((a) => a.nodeId);
    return raw.map((s, i) => {
        const sWithType: GenerationStep = {
            ...s,
            type: inferredType,
            ...(s.duration !== undefined
                ? { duration: Number(s.duration) as 4 | 6 | 8 }
                : {}),
        };
        let step = applyTypeDefaults(sWithType, imageDefaults, videoDefaults);
        step = validateStepNodeIds(step, canvasNodeIds, attachmentNodeIds);
        return applyVideoFallback(
            step,
            inferredType,
            attachments,
            i,
            raw.length,
        );
    });
}
