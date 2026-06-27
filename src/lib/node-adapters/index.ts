import { NodeDefinition, NodeData, NodeInputs } from "../types";
import { toNodeDefinition } from "@/primitives/node-adapters";
import { imagePrimitive } from "@/primitives/image/definition";
import { videoPrimitive } from "@/primitives/video/definition";
import { upscalePrimitive } from "@/primitives/upscale/definition";
import { resizePrimitive } from "@/primitives/resize/definition";
import { llmPrimitive } from "@/primitives/llm/definition";
import { textPrimitive } from "@/primitives/text/definition";
import { filePrimitive } from "@/primitives/file/definition";
import { listPrimitive } from "@/primitives/list/definition";
import { routerPrimitive } from "@/primitives/router/definition";
import { workflowInputPrimitive } from "@/primitives/workflow-input/definition";
import { workflowOutputPrimitive } from "@/primitives/workflow-output/definition";
import { customWorkflowPrimitive } from "@/primitives/custom-workflow/definition";
import { musicPrimitive } from "@/primitives/music/definition";

export const llmNodeDefinition = toNodeDefinition(llmPrimitive);
export const imageNodeDefinition = toNodeDefinition(imagePrimitive);
export const videoNodeDefinition = toNodeDefinition(videoPrimitive);
export const upscaleNodeDefinition = toNodeDefinition(upscalePrimitive);
export const resizeNodeDefinition = toNodeDefinition(resizePrimitive);
export const textNodeDefinition = toNodeDefinition(textPrimitive);
export const fileNodeDefinition = toNodeDefinition(filePrimitive);
export const listNodeDefinition = toNodeDefinition(listPrimitive);
export const routerNodeDefinition = toNodeDefinition(routerPrimitive);
export const workflowInputNodeDefinition = toNodeDefinition(
    workflowInputPrimitive,
);
export const workflowOutputNodeDefinition = toNodeDefinition(
    workflowOutputPrimitive,
);
export const customWorkflowNodeDefinition = toNodeDefinition(
    customWorkflowPrimitive,
);
export const musicNodeDefinition = toNodeDefinition(musicPrimitive);

export const allNodeDefinitions: NodeDefinition<NodeData, NodeInputs>[] = [
    llmNodeDefinition,
    imageNodeDefinition,
    videoNodeDefinition,
    upscaleNodeDefinition,
    resizeNodeDefinition,
    textNodeDefinition,
    fileNodeDefinition,
    listNodeDefinition,
    workflowInputNodeDefinition,
    workflowOutputNodeDefinition,
    customWorkflowNodeDefinition,
    routerNodeDefinition,
    musicNodeDefinition,
] as NodeDefinition<NodeData, NodeInputs>[];
