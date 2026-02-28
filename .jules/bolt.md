# Bolt Performance Journal

## 2026-02-28 - Optimized Workflow Topological Sort
**Learning:** The previous topological sort in `WorkflowEngine` used a nested filter/every approach, leading to $O(V^2)$ or $O(V \cdot E)$ complexity. On a graph with 1000 nodes, this took ~80ms just for sorting.
**Action:** Implemented Kahn's algorithm for $O(V+E)$ sorting and pre-calculated adjacency lists. This reduced sorting time to ~1.5ms, a ~50x improvement for large graphs.
