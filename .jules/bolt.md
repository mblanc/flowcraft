# Bolt's Journal - FlowCraft Performance

## 2024-05-23 - Initial Performance Audit
**Learning:** The initial implementation of `WorkflowEngine` claimed to be optimized with Kahn's algorithm, but was actually using an O(V^2) approach for topological sorting and O(V*E) for graph traversals and input gathering due to repeated array filtering.
**Action:** Re-implemented Kahn's algorithm correctly and introduced adjacency maps (incoming/outgoing) to achieve true O(V+E) performance for all graph operations.
