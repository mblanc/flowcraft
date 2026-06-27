"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import { componentRegistry } from "@/primitives/component-registry";

export function ConfigPanel() {
    const selectedNode = useFlowStore((state: FlowState) => state.selectedNode);

    if (!selectedNode) return null;

    const { data, id } = selectedNode;

    const primitiveConfig = componentRegistry.get(data.type);
    if (primitiveConfig?.ConfigPanel) {
        const Panel = primitiveConfig.ConfigPanel;
        return <Panel data={data} nodeId={id} />;
    }

    return null;
}
