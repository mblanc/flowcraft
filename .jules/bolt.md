## 2026-02-27 - Optimized WorkflowEngine for Large Graphs

**Learning:** The previous `WorkflowEngine` implementation had $O(V^2)$ and $O(V \cdot E)$ bottlenecks in topological sorting and input collection, which became noticeable with graphs larger than 1000 nodes. For 5000 nodes, sorting took ~1.9s and input collection took ~1.1s.

**Action:** Use Kahn's algorithm for $O(V+E)$ topological sorting and pre-calculate adjacency lists (edge maps) in the constructor to ensure $O(1)$ edge lookups. These changes reduced sorting time by ~145x and total input collection time by ~14x for 5000 nodes.
