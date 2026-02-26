## 2026-02-26 - Optimized WorkflowEngine for large graphs
**Learning:** Found an $O(V^2)$ bottleneck in `getExecutionLevels` and `getExecutionLevelsFromNode` due to nested filters and `shift()` on arrays. For a graph with 5000 nodes, execution preparation took ~1.8 seconds.
**Action:** Implemented Kahn's algorithm for topological sorting and pre-calculated edge maps in the constructor. This reduced the complexity to $O(V+E)$, bringing the execution preparation time down to ~26ms (a 68x speedup). Always use adjacency lists and in-degree counts for graph traversals in large datasets.
