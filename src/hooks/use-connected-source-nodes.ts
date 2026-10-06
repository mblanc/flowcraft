import { useMemo } from "react";
import { useFlowStore } from "@/lib/store/use-flow-store";

/**
 * Returns the list of source nodes connected to `nodeId` via incoming edges,
 * optionally filtered to a specific `targetHandle`.
 *
 * Each entry contains only the `id` and `name` needed by MentionEditor's
 * `availableNodes` prop, so callers avoid touching raw store shape directly.
 */
export function useConnectedSourceNodes(
    nodeId: string,
    targetHandle?: string,
): Array<{ id: string; name: string }> {
    // Select a deterministic identity key of only the incoming sources for this specific node.
    // As long as incoming edges and connected source node names don't change,
    // this string remains identical across all node drags, movements, and unrelated state updates.
    const connectedKey = useFlowStore((state) => {
        const incomingEdges = (state.edges ?? []).filter(
            (e) =>
                e.target === nodeId &&
                (targetHandle === undefined || e.targetHandle === targetHandle),
        );
        const seen = new Set<string>();
        const sources: Array<[string, string]> = [];
        for (const e of incomingEdges) {
            if (seen.has(e.source)) continue;
            seen.add(e.source);
            const n = state.nodesById
                ? state.nodesById[e.source]
                : state.nodes?.find((node) => node.id === e.source);
            if (n) {
                sources.push([n.id, (n.data?.name as string) ?? ""]);
            }
        }
        return sources.length > 0 ? JSON.stringify(sources) : "";
    });

    return useMemo(() => {
        if (!connectedKey) return [];
        const parsed = JSON.parse(connectedKey) as Array<[string, string]>;
        return parsed.map(([id, name]) => ({ id, name }));
    }, [connectedKey]);
}
