## 2026-02-24 - WorkflowEngine Graph Optimization
**Learning:**Brute-force graph traversal using `Array.filter()` and $O(V^2)$ topological sorting becomes a major bottleneck as the graph size grows. Pre-calculating adjacency lists and target-edge maps in the constructor allows for $O(V+E)$ traversal. Kahn's algorithm is significantly more efficient than iterative filtering for generating execution levels.
**Action:**Always prefer $O(V+E)$ graph algorithms (like Kahn's or DFS with adjacency lists) and avoid repeated array filtering inside loops for graph-based logic.
