import { PrimitiveRegistry } from "./registry";
import type { Primitive } from "./types";
import { imagePrimitive } from "./image/definition";
import { videoPrimitive } from "./video/definition";
import { upscalePrimitive } from "./upscale/definition";
import { resizePrimitive } from "./resize/definition";
import { llmPrimitive } from "./llm/definition";
import { textPrimitive } from "./text/definition";
import { filePrimitive } from "./file/definition";
import { listPrimitive } from "./list/definition";
import { routerPrimitive } from "./router/definition";
import { workflowInputPrimitive } from "./workflow-input/definition";
import { workflowOutputPrimitive } from "./workflow-output/definition";
import { customWorkflowPrimitive } from "./custom-workflow/definition";
import { concatPrimitive } from "./concat/definition";
import { musicPrimitive } from "./music/definition";

import { imageExecute } from "./image/execute";
import { resizeExecute } from "./resize/execute";
import { musicExecute } from "./music/execute";
import { concatExecute } from "./concat/execute";
import { llmExecute } from "./llm/execute";
import { videoExecute } from "./video/execute";
import { upscaleExecute } from "./upscale/execute";

export const serverRegistry = new PrimitiveRegistry();

serverRegistry.register({ ...imagePrimitive, execute: imageExecute });
serverRegistry.register({ ...videoPrimitive, execute: videoExecute });
serverRegistry.register({ ...upscalePrimitive, execute: upscaleExecute });
serverRegistry.register({ ...resizePrimitive, execute: resizeExecute });
serverRegistry.register({ ...llmPrimitive, execute: llmExecute });
serverRegistry.register(textPrimitive);
serverRegistry.register(filePrimitive);
serverRegistry.register(listPrimitive);
serverRegistry.register(routerPrimitive);
serverRegistry.register(workflowInputPrimitive);
serverRegistry.register(workflowOutputPrimitive);
serverRegistry.register(customWorkflowPrimitive);
serverRegistry.register({
    ...concatPrimitive,
    execute: concatExecute,
} as Primitive);
serverRegistry.register({ ...musicPrimitive, execute: musicExecute });
