export interface GraphNode {
  id: string;
  [key: string]: any;
}

export interface GraphEdge {
  source: string;
  target: string;
  [key: string]: any;
}

/**
 * Detects if a directed graph contains a cycle using Depth First Search (DFS).
 * 
 * @param nodes List of nodes in the graph
 * @param edges List of edges connecting the nodes
 * @returns true if a cycle is detected, false otherwise
 */
export function detectCycle(nodes: GraphNode[], edges: GraphEdge[]): boolean {
  if (nodes.length === 0) return false;

  // Build adjacency list
  const adj = new Map<string, string[]>();
  nodes.forEach((node) => adj.set(node.id, []));
  
  edges.forEach((edge) => {
    // Ensure both source and target exist in the nodes list to avoid errors with stale edges
    if (adj.has(edge.source) && adj.has(edge.target)) {
      adj.get(edge.source)?.push(edge.target);
    }
  });

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adj.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  // Iterate through all nodes to handle disconnected components
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true;
    }
  }

  return false;
}

/**
 * Detects if adding a sub-workflow (candidateSubFlowId) to a target workflow (targetFlowId)
 * would create a recursive cycle (e.g., A contains B, B contains A).
 * 
 * @param targetFlowId The ID of the workflow being edited
 * @param candidateSubFlowId The ID of the sub-workflow being added
 * @param fetchFlow A function to fetch flow data (nodes) by ID
 * @param visited Set of visited flow IDs to prevent infinite loops during traversal
 * @returns true if a recursive cycle is detected
 */
export async function detectRecursiveCycle(
  targetFlowId: string,
  candidateSubFlowId: string,
  fetchFlow: (id: string) => Promise<{ nodes: GraphNode[] } | null>,
  visited: Set<string> = new Set()
): Promise<boolean> {
  // Direct match: The candidate IS the target (A -> A)
  if (targetFlowId === candidateSubFlowId) return true;
  
  // Avoid re-visiting flows in the current search path to handle internal cycles in sub-graphs
  if (visited.has(candidateSubFlowId)) return false;
  visited.add(candidateSubFlowId);

  const flowData = await fetchFlow(candidateSubFlowId);
  if (!flowData) return false;

  // Find all custom-workflow nodes in the candidate flow
  const subWorkflowNodes = flowData.nodes.filter(n => n.type === 'custom-workflow');
  
  for (const node of subWorkflowNodes) {
    const nextSubFlowId = node.data?.subWorkflowId;
    if (nextSubFlowId) {
       // Recursively check if any child references the target
       if (await detectRecursiveCycle(targetFlowId, nextSubFlowId, fetchFlow, visited)) {
         return true;
       }
    }
  }

  return false;
}
