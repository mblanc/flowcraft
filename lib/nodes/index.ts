import { NodeDefinition, NodeData, NodeInputs } from "../types";

export { llmNodeDefinition } from "./llm-node";
export { imageNodeDefinition } from "./image-node";
export { videoNodeDefinition } from "./video-node";
export { upscaleNodeDefinition } from "./upscale-node";
export { resizeNodeDefinition } from "./resize-node";
export { textNodeDefinition } from "./text-node";
export { fileNodeDefinition } from "./file-node";
export { listNodeDefinition } from "./list-node";
export { workflowInputNodeDefinition } from "./workflow-input-node";
export { workflowOutputNodeDefinition } from "./workflow-output-node";
export { customWorkflowNodeDefinition } from "./custom-workflow-node";
export { routerNodeDefinition } from "./router-node";

import { llmNodeDefinition } from "./llm-node";
import { imageNodeDefinition } from "./image-node";
import { videoNodeDefinition } from "./video-node";
import { upscaleNodeDefinition } from "./upscale-node";
import { resizeNodeDefinition } from "./resize-node";
import { textNodeDefinition } from "./text-node";
import { fileNodeDefinition } from "./file-node";
import { listNodeDefinition } from "./list-node";
import { workflowInputNodeDefinition } from "./workflow-input-node";
import { workflowOutputNodeDefinition } from "./workflow-output-node";
import { customWorkflowNodeDefinition } from "./custom-workflow-node";
import { routerNodeDefinition } from "./router-node";

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
] as NodeDefinition<NodeData, NodeInputs>[];
