# SPEC: Node-Driven Flow Execution

## Objective

Replace the broken global "Run Flow" and "Run Selected" buttons with per-node execution controls. Every node gets the execution affordances that match its role: generators get "Generate" + "Run from here", data nodes get "Run downstream", and terminal nodes get "Run to here". Remove all dead global execution code.

---

## Current State (what to remove)

| Item                        | Location                                   | Action                           |
| --------------------------- | ------------------------------------------ | -------------------------------- |
| `FlowRunPanel` component    | `src/components/flow/flow-run-panel.tsx`   | Delete file                      |
| `FlowRunPanel` usage        | `src/components/flow/flow-canvas.tsx`      | Remove import + JSX              |
| `runFlow` function          | `src/hooks/use-flow-execution.ts`          | Remove                           |
| `runSelectedNodes` function | `src/hooks/use-flow-execution.ts`          | Remove                           |
| `isRunning` store flag      | `use-flow-store` (graph-slice or ui-slice) | Remove if only used by the panel |
| `setIsRunning` calls        | `use-flow-execution.ts`                    | Remove along with the functions  |

Tests referencing these (`flow-canvas.test.tsx`, `header.test.tsx`) must be updated or removed.

---

## Execution Model

### Node categories and their buttons

| Category            | Node types                                                 | Generate button     | Run from here button                            | Run to here button |
| ------------------- | ---------------------------------------------------------- | ------------------- | ----------------------------------------------- | ------------------ |
| Generator           | image, video, llm, upscale, resize, music, custom-workflow | ✓ `executeNode(id)` | ✓ `runFromNode(id)`                             | —                  |
| Logic               | router                                                     | —                   | ✓ `runFromNode(id)`                             | —                  |
| Data (pass-through) | text, file, list, workflow-input                           | —                   | ✓ `runFromNode(id)` (tooltip: "Run downstream") | —                  |
| Terminal            | workflow-output                                            | —                   | —                                               | ✓ `runToNode(id)`  |

**Semantics:**

- **Generate** — re-executes only this node. Uses the existing results of upstream nodes. Fast iteration on a single step.
- **Run from here** — executes this node and all downstream nodes in topological order. For data nodes, the node itself is a no-op (returns `{}`), so the effect is "propagate current data downstream."
- **Run to here** — executes all upstream ancestors of this node plus this node, in topological order. Does NOT execute any downstream siblings. Useful for testing pipeline segments up to a specific output.

### New engine method: `runToNode`

Add to `WorkflowEngine` in `src/lib/flow/workflow-engine.ts`:

```ts
async runToNode(targetNodeId: string) {
    this.validateCustomWorkflowEdges();
    const levels = this.getExecutionLevelsToNode(targetNodeId);
    for (const level of levels) {
        await Promise.all(level.map((nodeId) => this.executeNodeSync(nodeId)));
    }
}

private getExecutionLevelsToNode(targetNodeId: string): string[][] {
    // Reverse BFS: collect all ancestors of targetNodeId (inclusive)
    const queue = [targetNodeId];
    const ancestors = new Set<string>();
    while (queue.length > 0) {
        const current = queue.shift()!;
        ancestors.add(current);
        for (const edge of this.edges) {
            if (edge.target === current && !ancestors.has(edge.source)) {
                queue.push(edge.source);
                ancestors.add(edge.source);
            }
        }
    }
    // Filter the full topo-sorted levels to only ancestor nodes
    const allLevels = this.getExecutionLevels();
    return allLevels
        .map((level) => level.filter((id) => ancestors.has(id)))
        .filter((level) => level.length > 0);
}
```

### New hook function: `runToNode`

Add to `useFlowExecution` in `src/hooks/use-flow-execution.ts`:

```ts
const runToNode = useCallback(async (nodeId: string) => {
    const { nodes, edges, updateNodeData } = useFlowStore.getState();
    try {
        const engine = new WorkflowEngine(
            nodes,
            edges,
            updateNodeData,
            buildContext(),
        );
        await engine.runToNode(nodeId);
    } catch (error) {
        logger.error("Error running to node:", error);
    }
}, []);
```

---

## Per-Node Changes

### Nodes already complete (no changes needed)

- `image`, `video`, `llm`, `music`, `resize`, `upscale` — have both Generate and Run from here

### custom-workflow — add Run from here

File: `src/primitives/custom-workflow/FlowNode.tsx`

- Import `runFromNode` from `useFlowExecution`
- Add `handleRunFromHere` callback calling `runFromNode(id)`
- Pass `onRunFromHere={handleRunFromHere}` to `NodeActionBar`

### router — already correct

Has Run from here only. No changes needed.

### text — add Run downstream button

File: `src/primitives/text/FlowNode.tsx`

- Import `runFromNode` from `useFlowExecution`
- Add `handleRunDownstream` callback calling `runFromNode(id)`
- Pass `onRunFromHere={handleRunDownstream}` to `NodeActionBar`
- The tooltip in `NodeActionBar` when there is no `onGenerate` and only `onRunFromHere` should read "Run downstream"

### file — add Run downstream button

File: `src/primitives/file/FlowNode.tsx`

- Same pattern as text

### list — add Run downstream button

File: `src/primitives/list/FlowNode.tsx`

- Same pattern as text

### workflow-input — add Run downstream button

File: `src/primitives/workflow-input/FlowNode.tsx`

- Same pattern as text

### workflow-output — add Run to here button

File: `src/primitives/workflow-output/FlowNode.tsx`

- Import `runToNode` from `useFlowExecution`
- Add `handleRunToHere` callback calling `runToNode(id)`
- Pass to `NodeActionBar` via a new `onRunToHere` prop

### NodeActionBar — add Run to here slot

File: `src/components/nodes/node-action-bar.tsx`

- Add optional `onRunToHere?: () => void` to `NodeActionBarProps`
- Render a button (icon: `ChevronsRight` or `ArrowDownToLine`) with tooltip "Run to here" when `onRunToHere` is provided
- Insert it between `onRunFromHere` and `onSettings`
- Update the divider logic to account for the new button

### NodeActionBar — conditional tooltip for Run from here

When `onGenerate` is absent and only `onRunFromHere` is present (data nodes), the tooltip should read "Run downstream" instead of "Run from here". Pass a `runFromHereLabel?: string` prop or derive from whether `onGenerate` exists.

---

## useFlowExecution — final surface

After changes, the hook exports only:

```ts
return {
    runFromNode, // node + all downstream
    runToNode, // all ancestors + node
    executeNode, // single node only
};
```

`runFlow` and `runSelectedNodes` are removed.

---

## Files to delete

- `src/components/flow/flow-run-panel.tsx`

---

## Files to modify

| File                                                 | Change                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/hooks/use-flow-execution.ts`                    | Remove `runFlow`, `runSelectedNodes`, `isRunning`/`setIsRunning`. Add `runToNode`. |
| `src/lib/flow/workflow-engine.ts`                    | Add `runToNode(targetNodeId)` and `getExecutionLevelsToNode(targetNodeId)`         |
| `src/components/flow/flow-canvas.tsx`                | Remove `FlowRunPanel` import and usage                                             |
| `src/components/nodes/node-action-bar.tsx`           | Add `onRunToHere` prop + button; conditional tooltip for "Run downstream"          |
| `src/primitives/custom-workflow/FlowNode.tsx`        | Add Run from here                                                                  |
| `src/primitives/text/FlowNode.tsx`                   | Add Run downstream                                                                 |
| `src/primitives/file/FlowNode.tsx`                   | Add Run downstream                                                                 |
| `src/primitives/list/FlowNode.tsx`                   | Add Run downstream                                                                 |
| `src/primitives/workflow-input/FlowNode.tsx`         | Add Run downstream                                                                 |
| `src/primitives/workflow-output/FlowNode.tsx`        | Add Run to here                                                                    |
| `src/__tests__/unit/components/flow-canvas.test.tsx` | Remove/update `FlowRunPanel` and `runFlow` references                              |
| `src/__tests__/unit/components/header.test.tsx`      | Remove/update `runFlow` references                                                 |

---

## Testing strategy

### Unit tests

- `WorkflowEngine.runToNode` — test that only ancestors + target execute, not siblings or downstream
- `WorkflowEngine.runFromNode` on a data node — verify downstream nodes execute and data node's `.data` is passed through correctly
- `NodeActionBar` — snapshot/render tests for `onRunToHere` presence

### Manual verification checklist

- [ ] "Run Flow" panel is gone from the canvas
- [ ] Image node: Generate re-runs single node; Run from here propagates to all downstream
- [ ] custom-workflow node: Run from here executes it + downstream
- [ ] text node: Run downstream button appears; clicking it executes downstream nodes with current text value
- [ ] workflow-output node: Run to here button appears; clicking it executes all upstream ancestors up to and including the output node
- [ ] No execution buttons remain broken or orphaned

---

## Boundaries

**Always do:**

- Keep `executeNode` and `runFromNode` untouched in behavior — only remove their callers in dead code
- Preserve `isRunning` guard if any other code still references it (check before removing)

**Ask first:**

- Any change to `WorkflowEngine.getExecutionLevels` (used by both `run` and `runFromNode`)

**Never do:**

- Remove `runFromNode` from `WorkflowEngine` — it is actively used by all generator nodes
- Add new global keyboard shortcuts or toolbar buttons for flow-level execution
