## 2025-05-15 - Optimized WorkflowEngine execution graph processing

**Learning:** The previous implementation of `getExecutionLevels` and BFS in `WorkflowEngine` had O(V^2) and O(V\*E) complexity respectively, due to nested filters and the use of `Array.prototype.shift()`. For large graphs (e.g., 5000 nodes), this caused significant performance degradation.
**Action:** Implemented Kahn's algorithm for topological sorting to achieve O(V+E) complexity for level calculation. Replaced `shift()` with a head pointer in BFS and pre-calculated adjacency lists and incoming edge maps to ensure O(V+E) performance across the entire graph processing pipeline. Measured ~32ms for a 5000-node chain, which would have taken several seconds with the previous O(N^2) approach.
