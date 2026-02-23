## 2026-02-23 - Optimized WorkflowEngine for Large Graphs
**Learning:** Naive topological sorting and level calculation in the `WorkflowEngine` led to $O(V^2)$ performance due to repeated array filtering and $O(N)$ `shift()` operations.
**Action:** Use Kahn's algorithm for $O(V+E)$ level calculation and maintain pre-calculated adjacency lists for $O(1)$ edge lookups. Always use head-pointers for BFS queues in JavaScript to avoid $O(N)$ `Array.prototype.shift()` penalties.
