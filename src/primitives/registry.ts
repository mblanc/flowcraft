import { Primitive } from "./types";
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
import { t2sPrimitive } from "./t2s/definition";

export class PrimitiveRegistry {
    private primitives = new Map<string, Primitive>();
    private flowTypeMap = new Map<string, Primitive>();
    private canvasTypeMap = new Map<string, Primitive>();
    private operationMap = new Map<string, Primitive>();

    register(primitive: Primitive): void {
        this.primitives.set(primitive.id, primitive);
        if (primitive.flow) {
            this.flowTypeMap.set(primitive.flow.type, primitive);
        }
        if (primitive.canvas) {
            this.canvasTypeMap.set(primitive.canvas.type, primitive);
        }
        if (primitive.agent?.operationId) {
            this.operationMap.set(primitive.agent.operationId, primitive);
        }
    }

    get(id: string): Primitive | undefined {
        return this.primitives.get(id);
    }

    getByFlowType(type: string): Primitive | undefined {
        return this.flowTypeMap.get(type);
    }

    getByCanvasType(type: string): Primitive | undefined {
        return this.canvasTypeMap.get(type);
    }

    getByOperation(operation: string): Primitive | undefined {
        return this.operationMap.get(operation);
    }

    flowTypes(): string[] {
        return Array.from(this.flowTypeMap.keys());
    }

    canvasTypes(): string[] {
        return Array.from(this.canvasTypeMap.keys());
    }

    primitiveIds(): string[] {
        return Array.from(this.primitives.keys());
    }

    operationIds(): string[] {
        const ids: string[] = [];
        for (const p of this.primitives.values()) {
            if (p.agent?.operationId) {
                ids.push(p.agent.operationId);
            }
        }
        return ids;
    }
}

export const registry = new PrimitiveRegistry();
registry.register(imagePrimitive);
registry.register(videoPrimitive);
registry.register(upscalePrimitive);
registry.register(resizePrimitive);
registry.register(llmPrimitive);
registry.register(textPrimitive);
registry.register(filePrimitive);
registry.register(listPrimitive);
registry.register(routerPrimitive);
registry.register(workflowInputPrimitive);
registry.register(workflowOutputPrimitive);
registry.register(customWorkflowPrimitive);
registry.register(concatPrimitive);
registry.register(musicPrimitive);
registry.register(t2sPrimitive);
