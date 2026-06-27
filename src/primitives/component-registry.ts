/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { FlowNode as ImageFlowNode } from "./image/FlowNode";
import { CanvasNode as ImageCanvasNode } from "./image/CanvasNode";
import { ConfigPanel as ImageConfigPanel } from "./image/ConfigPanel";

import { FlowNode as VideoFlowNode } from "./video/FlowNode";
import { CanvasNode as VideoCanvasNode } from "./video/CanvasNode";
import { ConfigPanel as VideoConfigPanel } from "./video/ConfigPanel";

import { FlowNode as UpscaleFlowNode } from "./upscale/FlowNode";
import { ConfigPanel as UpscaleConfigPanel } from "./upscale/ConfigPanel";

import { FlowNode as ResizeFlowNode } from "./resize/FlowNode";
import { ConfigPanel as ResizeConfigPanel } from "./resize/ConfigPanel";

import { FlowNode as LLMFlowNode } from "./llm/FlowNode";
import { ConfigPanel as LLMConfigPanel } from "./llm/ConfigPanel";

import { FlowNode as TextFlowNode } from "./text/FlowNode";
import { ConfigPanel as TextConfigPanel } from "./text/ConfigPanel";

import { FlowNode as FileFlowNode } from "./file/FlowNode";
import { ConfigPanel as FileConfigPanel } from "./file/ConfigPanel";

import { FlowNode as ListFlowNode } from "./list/FlowNode";

import { FlowNode as RouterFlowNode } from "./router/FlowNode";

import { FlowNode as WorkflowInputFlowNode } from "./workflow-input/FlowNode";

import { FlowNode as WorkflowOutputFlowNode } from "./workflow-output/FlowNode";

import { FlowNode as CustomWorkflowFlowNode } from "./custom-workflow/FlowNode";
import { ConfigPanel as CustomWorkflowConfigPanel } from "./custom-workflow/ConfigPanel";

import { FlowNode as MusicFlowNode } from "./music/FlowNode";
import { ConfigPanel as MusicConfigPanel } from "./music/ConfigPanel";
import { CanvasNode as MusicCanvasNode } from "./music/CanvasNode";

export interface PrimitiveComponents<TFlowData = any> {
    FlowNode: React.ComponentType<any>;
    CanvasNode: React.ComponentType<any> | null;
    ConfigPanel: React.ComponentType<{
        data: TFlowData;
        nodeId: string;
    }> | null;
}

export class ComponentRegistry {
    private components = new Map<string, PrimitiveComponents>();

    register(id: string, components: PrimitiveComponents): void {
        this.components.set(id, components);
    }

    get(id: string): PrimitiveComponents | undefined {
        return this.components.get(id);
    }
}

export const componentRegistry = new ComponentRegistry();

// Register primitives
componentRegistry.register("image", {
    FlowNode: ImageFlowNode,
    CanvasNode: ImageCanvasNode,
    ConfigPanel: ImageConfigPanel,
});

componentRegistry.register("video", {
    FlowNode: VideoFlowNode,
    CanvasNode: VideoCanvasNode,
    ConfigPanel: VideoConfigPanel,
});

componentRegistry.register("upscale", {
    FlowNode: UpscaleFlowNode,
    CanvasNode: null,
    ConfigPanel: UpscaleConfigPanel,
});

componentRegistry.register("resize", {
    FlowNode: ResizeFlowNode,
    CanvasNode: null,
    ConfigPanel: ResizeConfigPanel,
});

componentRegistry.register("llm", {
    FlowNode: LLMFlowNode,
    CanvasNode: null,
    ConfigPanel: LLMConfigPanel,
});

componentRegistry.register("text", {
    FlowNode: TextFlowNode,
    CanvasNode: null,
    ConfigPanel: TextConfigPanel,
});

componentRegistry.register("file", {
    FlowNode: FileFlowNode,
    CanvasNode: null,
    ConfigPanel: FileConfigPanel,
});

componentRegistry.register("list", {
    FlowNode: ListFlowNode,
    CanvasNode: null,
    ConfigPanel: null,
});

componentRegistry.register("router", {
    FlowNode: RouterFlowNode,
    CanvasNode: null,
    ConfigPanel: null,
});

componentRegistry.register("workflow-input", {
    FlowNode: WorkflowInputFlowNode,
    CanvasNode: null,
    ConfigPanel: null,
});

componentRegistry.register("workflow-output", {
    FlowNode: WorkflowOutputFlowNode,
    CanvasNode: null,
    ConfigPanel: null,
});

componentRegistry.register("custom-workflow", {
    FlowNode: CustomWorkflowFlowNode,
    CanvasNode: null,
    ConfigPanel: CustomWorkflowConfigPanel,
});

componentRegistry.register("music", {
    FlowNode: MusicFlowNode,
    CanvasNode: MusicCanvasNode,
    ConfigPanel: MusicConfigPanel,
});
