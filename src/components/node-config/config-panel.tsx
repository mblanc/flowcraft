"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import { componentRegistry } from "@/primitives/component-registry";

export function ConfigPanel() {
    const selectedNodeId = useFlowStore(
        (state: FlowState) => state.selectedNodeId,
    );
    const data = useFlowStore((state: FlowState) =>
        selectedNodeId ? state.nodesById[selectedNodeId]?.data : undefined,
    );

    if (!selectedNodeId || !data) return null;

    const primitiveConfig = componentRegistry.get(data.type);
    if (primitiveConfig?.ConfigPanel) {
        const Panel = primitiveConfig.ConfigPanel;
        return <Panel data={data} nodeId={selectedNodeId} />;
    }

    return null;
}
