/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Re-exports executor functions from their respective node modules.
 * Kept for backward compatibility with existing imports.
 */
import { toNodeDefinition } from "@/primitives/node-adapters";
import { imagePrimitive } from "@/primitives/image/definition";
import { videoPrimitive } from "@/primitives/video/definition";
import { upscalePrimitive } from "@/primitives/upscale/definition";
import { resizePrimitive } from "@/primitives/resize/definition";
import { llmPrimitive } from "@/primitives/llm/definition";

/** @deprecated Use llm primitive execution instead */
export async function executeLLMNode(node: any, inputs: any, context?: any) {
    const def = toNodeDefinition(llmPrimitive);
    return def.execute(node, inputs, context);
}

/** @deprecated Use resize primitive execution instead */
export async function executeResizeNode(node: any, inputs: any, context?: any) {
    const def = toNodeDefinition(resizePrimitive);
    return def.execute(node, inputs, context);
}

/** @deprecated Use upscale primitive execution instead */
export async function executeUpscaleNode(
    node: any,
    inputs: any,
    context?: any,
) {
    const def = toNodeDefinition(upscalePrimitive);
    return def.execute(node, inputs, context);
}

/** @deprecated Use image primitive execution instead */
export async function executeImageNode(node: any, inputs: any, context?: any) {
    const def = toNodeDefinition(imagePrimitive);
    return def.execute(node, inputs, context);
}

/** @deprecated Use video primitive execution instead */
export async function executeVideoNode(node: any, inputs: any, context?: any) {
    const def = toNodeDefinition(videoPrimitive);
    return def.execute(node, inputs, context);
}
