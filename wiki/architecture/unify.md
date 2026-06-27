# Unified Flows and Nodes

## The Problem

Flowcraft currently has two concepts that express the same idea:

- **Flows** — DAGs built in the Flow editor, with explicit `workflow-input` and `workflow-output` nodes that declare the interface
- **Custom nodes** (`custom-workflow` node type) — a node that wraps a flow so it can be reused inside another flow

These are the same abstraction written twice. A flow with `workflow-input`/`workflow-output` nodes _is_ a custom node. The only difference is which surface you're looking at it from. This split creates unnecessary indirection: to make a flow reusable, you have to think of it as two separate things.

## The Unified Model

> A flow is just a DAG. When it has exposed ports, it is also a reusable node — everywhere.

There is no separate "custom node" concept. A flow becomes reusable the moment its topology exposes a clear interface. That same flow can then be:

- Embedded as a node inside another flow
- Called as a tool by the canvas agent
- Run standalone as before

The primitive is always a flow. Reusability is a property of the flow, not a separate object type.

## Deriving the Interface from Topology

A flow's interface is not declared — it is read from the graph.

- **Input ports** → root nodes (in-degree = 0) marked as exposed
- **Output ports** → leaf nodes (out-degree = 0) marked as exposed

Each node carries a single boolean: `exposed`. Root and leaf nodes default to `exposed: true`. Authors set it to `false` for nodes that are fixed constants — a hardcoded system prompt, a locked model config — that should not be bound by a caller.

The node's existing label becomes the port name. No new node types are introduced.

### Why topology, not declaration

The graph already encodes structure. Adding explicit `workflow-input`/`workflow-output` nodes to declare what topology already shows is redundant ceremony. It also creates a synchronization problem: change the graph, forget to update the interface nodes, and the declared interface drifts from reality.

Reading the interface from topology means the interface is always correct by construction. The only authoring decision left is: which root/leaf nodes are variable (exposed) versus fixed (not exposed).

### The `exposed` toggle

This is the only escape hatch needed. Three cases:

| Node position                                  | Default         | Override to |
| ---------------------------------------------- | --------------- | ----------- |
| Root node, meant to be filled by caller        | `exposed: true` | —           |
| Root node, fixed constant (e.g. system prompt) | `exposed: true` | `false`     |
| Leaf node, meaningful output                   | `exposed: true` | —           |

Everything else is inferred.

## What Disappears

With this model, the following concepts become unnecessary:

- `workflow-input` and `workflow-output` node types — the graph already says this
- `custom-workflow` as a distinct node type — it is just "a flow with exposed ports, embedded here"
- The mental distinction between "building a flow" and "creating a reusable node" — they are the same act

An author does not publish a flow as a custom node. They build a flow. If it has exposed ports, it is reusable. That's all.

## Making a Flow Discoverable

For a flow to be useful to the canvas agent — or to another human browsing what's available — it needs one additional piece of metadata beyond its graph: a **natural-language description**.

This description answers: _what does this flow do, expressed as a capability?_

Example: _"Takes a photo of a person and a garment image. Produces a video of the person wearing the garment."_

A flow with exposed ports and a description is **published** — it is part of the capability library. A flow without a description is private, even if it has exposed ports. The author controls discoverability with a single field.

Port names (derived from node labels) + the description together form everything a caller needs to use the flow without knowing its internals.

## The Agent Side

Canvas Agent B (the Director) currently plans media production by calling primitives: image generation, video generation, production pipelines. The unified model extends this naturally.

### Discovery

Before planning, the agent has access to a catalog of published flows. Each entry exposes:

- Flow name and description
- Input port names and what they represent
- Output port names and what they produce

The agent uses this catalog the same way it uses knowledge of image/video primitives: to decide which capability fits the user's intent.

### Planning

When the agent constructs a production plan, flow steps are first-class alongside primitive steps. A plan node can say: _run the virtual-try-on flow, binding the subject image from step 1 and the clothes image from step 2_.

The agent does not need to know what happens inside the flow. It knows the interface (inputs, outputs) and the intent (description). That is enough to plan with it.

### Binding

Inputs to a flow step are bound using the same reference system already in use for inter-step dependencies: a step can reference an output from a prior step or an existing canvas node. The flow's port names are the binding targets.

The agent sees the flow as a black box with named slots. Filling those slots from context it has already planned is the same operation as connecting any two steps in a production plan.

### Composition

This model makes the agent a composer of flows, not a caller of one monolithic pipeline. A complex user request might be fulfilled by:

- One flow for avatar generation
- One flow for virtual try-on
- One primitive for video upscaling

The agent plans the dependencies between them. The topology of the production plan mirrors the topology of the individual flows — the same DAG model, one level up.

## The Single Abstraction

In the unified model, there is one concept: **a flow**.

- Small flows are leaves — a single model call, a single API operation
- Large flows compose smaller ones as nodes
- The canvas agent composes flows into production plans
- Standalone execution, embedded execution, and agent-driven execution are all the same operation: call a flow with inputs, get outputs

The interface is always topology. The reusability is always opt-in via `exposed`. The discoverability is always a description.

Nothing else is needed.
