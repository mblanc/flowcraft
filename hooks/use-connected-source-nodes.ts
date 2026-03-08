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
    const edges = useFlowStore((state) => state.edges);
    const nodes = useFlowStore((state) => state.nodes);

    return useMemo(
        () =>
            edges
                .filter(
                    (e) =>
                        e.target === nodeId &&
                        (targetHandle === undefined ||
                            e.targetHandle === targetHandle),
                )
                .map((e) => nodes.find((n) => n.id === e.source))
                .filter((n): n is NonNullable<typeof n> => n !== undefined)
                .map((n) => ({ id: n.id, name: n.data.name as string })),
        [edges, nodes, nodeId, targetHandle],
    );
}
