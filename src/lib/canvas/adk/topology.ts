import type { PlanEdge } from "../types";

/**
 * Kahn's algorithm: groups nodes by execution level.
 * Nodes in the same level have no mutual dependencies and can run in parallel.
 * Only "depends_on" edges create ordering constraints.
 * Throws if the graph contains a cycle.
 */
export function topoSort<T extends { id: string }>(
    nodes: T[],
    edges: PlanEdge[],
): T[][] {
    const depEdges = edges.filter((e) => e.role === "depends_on");

    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>(); // from → to[]

    for (const node of nodes) {
        inDegree.set(node.id, 0);
        adjacency.set(node.id, []);
    }

    for (const edge of depEdges) {
        inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
        adjacency.get(edge.from)?.push(edge.to);
    }

    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const levels: T[][] = [];
    let frontier = nodes.filter((n) => inDegree.get(n.id) === 0);

    let visited = 0;
    while (frontier.length > 0) {
        levels.push(frontier);
        visited += frontier.length;

        const next: T[] = [];
        for (const node of frontier) {
            for (const toId of adjacency.get(node.id) ?? []) {
                const deg = (inDegree.get(toId) ?? 1) - 1;
                inDegree.set(toId, deg);
                if (deg === 0) {
                    const toNode = nodeById.get(toId);
                    if (toNode) next.push(toNode);
                }
            }
        }
        frontier = next;
    }

    if (visited < nodes.length) {
        throw new Error(
            `Cycle detected in production plan DAG — ${nodes.length - visited} node(s) unreachable`,
        );
    }

    return levels;
}
