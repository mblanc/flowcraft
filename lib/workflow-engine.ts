import logger from "@/app/logger";
import { Edge, Node } from "@xyflow/react";
import { NodeData, NodeInputs, CustomWorkflowData } from "./types";
import { getNodeDefinition, ExecutionContext } from "./node-registry";

export class WorkflowEngine {
    private nodesMap: Map<string, Node<NodeData>>;
    private edges: Edge[];
    private onNodeUpdate: (nodeId: string, data: Partial<NodeData>) => void;
    public executionResults: Map<string, Partial<NodeData>> = new Map();
    private context: ExecutionContext;

    // Pre-calculated graph structures for performance
    private adjList: Map<string, string[]> = new Map();
    private targetEdgesMap: Map<string, Edge[]> = new Map();

    constructor(
        nodes: Node<NodeData>[],
        edges: Edge[],
        onNodeUpdate: (nodeId: string, data: Partial<NodeData>) => void,
        context?: ExecutionContext,
    ) {
        this.nodesMap = new Map(nodes.map((n) => [n.id, n]));
        this.edges = edges;
        this.onNodeUpdate = onNodeUpdate;
        this.context = context || {};

        // Initialize graph structures
        nodes.forEach((node) => {
            this.adjList.set(node.id, []);
            this.targetEdgesMap.set(node.id, []);
        });

        edges.forEach((edge) => {
            if (this.adjList.has(edge.source)) {
                this.adjList.get(edge.source)!.push(edge.target);
            }
            if (this.targetEdgesMap.has(edge.target)) {
                this.targetEdgesMap.get(edge.target)!.push(edge);
            }
        });
    }

    async run() {
        // Validate edges from custom-workflow nodes
        this.validateCustomWorkflowEdges();

        const levels = this.getExecutionLevels();

        for (const level of levels) {
            await Promise.all(
                level.map(async (nodeId) => {
                    await this.executeNodeSync(nodeId);
                }),
            );
        }
    }

    async runFromNode(startNodeId: string) {
        this.validateCustomWorkflowEdges();

        const levels = this.getExecutionLevelsFromNode(startNodeId);

        for (const level of levels) {
            await Promise.all(
                level.map(async (nodeId) => {
                    await this.executeNodeSync(nodeId);
                }),
            );
        }
    }

    private getExecutionLevelsFromNode(startNodeId: string): string[][] {
        const queue = [startNodeId];
        const downstreamNodes = new Set<string>([startNodeId]);

        // BFS to find all reachable nodes from startNodeId using pre-calculated adjList (O(V+E))
        while (queue.length > 0) {
            const current = queue.shift()!;

            const neighbors = this.adjList.get(current) || [];
            for (const neighborId of neighbors) {
                if (!downstreamNodes.has(neighborId)) {
                    downstreamNodes.add(neighborId);
                    queue.push(neighborId);
                }
            }
        }

        const allLevels = this.getExecutionLevels();
        return allLevels
            .map((level) =>
                level.filter((nodeId) => downstreamNodes.has(nodeId)),
            )
            .filter((level) => level.length > 0);
    }

    private validateCustomWorkflowEdges() {
        for (const edge of this.edges) {
            const sourceNode = this.nodesMap.get(edge.source);
            if (sourceNode?.data.type === "custom-workflow") {
                if (!edge.sourceHandle) {
                    logger.warn(
                        `[WorkflowEngine] Edge ${edge.id} from custom-workflow "${sourceNode.data.name}" (${edge.source}) ` +
                            `to node ${edge.target} is missing sourceHandle. ` +
                            `This may cause the output data to not be extracted correctly. ` +
                            `Please reconnect the edge from the sub-workflow's output port.`,
                    );
                }
            }
        }
    }

    async executeNode(nodeId: string) {
        return this.executeNodeSync(nodeId);
    }

    private async executeNodeSync(nodeId: string) {
        const node = this.nodesMap.get(nodeId);
        if (!node) return;

        const definition = getNodeDefinition(node.data.type);
        if (!definition) return;

        try {
            this.onNodeUpdate(nodeId, {
                executing: true,
                error: undefined,
            } as Partial<NodeData>);

            const inputs = this.gatherInputs(node);
            let result: Partial<NodeData>;

            if (node.data.type === "custom-workflow") {
                result = await this.executeSubWorkflow(node, inputs);
            } else if (node.data.type === "workflow-input") {
                // Workflow input nodes should return their current data as result
                // so it's available for downstream nodes in executionResults
                result = { ...node.data };
            } else {
                result = await definition.execute(node, inputs, {
                    ...this.context,
                    onNodeUpdate: this.onNodeUpdate,
                });
            }

            // Store result for dependent nodes
            this.executionResults.set(nodeId, result);

            // Update node with result
            this.onNodeUpdate(nodeId, {
                ...result,
                executing: false,
                generatedAt: Date.now(),
                error: undefined,
            } as Partial<NodeData>);

            // Update internal map state for next levels
            const updatedNode: Node<NodeData> = {
                ...node,
                data: { ...node.data, ...result } as NodeData,
            };
            this.nodesMap.set(nodeId, updatedNode);
        } catch (error) {
            logger.error(`Error executing node ${nodeId}:`, error);
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            this.onNodeUpdate(nodeId, {
                executing: false,
                error: errorMessage,
            } as Partial<NodeData>);
            throw error; // Re-throw to handle in the run loop if needed
        }
    }

    private getExecutionLevels(): string[][] {
        const nodes = Array.from(this.nodesMap.values());
        const inDegree = new Map<string, number>();

        // Initialize in-degrees (O(V+E))
        nodes.forEach((node) => inDegree.set(node.id, 0));
        this.edges.forEach((edge) => {
            if (inDegree.has(edge.target)) {
                inDegree.set(edge.target, inDegree.get(edge.target)! + 1);
            }
        });

        const levels: string[][] = [];
        const processed = new Set<string>();

        // Kahn's algorithm variant to group by levels (O(V+E))
        let currentQueue = nodes
            .filter((node) => inDegree.get(node.id) === 0)
            .map((node) => node.id);

        while (currentQueue.length > 0) {
            levels.push(currentQueue);
            const nextQueue: string[] = [];

            for (const nodeId of currentQueue) {
                processed.add(nodeId);
                const neighbors = this.adjList.get(nodeId) || [];
                for (const neighborId of neighbors) {
                    const newDegree = inDegree.get(neighborId)! - 1;
                    inDegree.set(neighborId, newDegree);
                    if (newDegree === 0) {
                        nextQueue.push(neighborId);
                    }
                }
            }
            currentQueue = nextQueue;
        }

        // Handle cycles or disconnected nodes that weren't processed
        if (processed.size < nodes.length) {
            const remaining = nodes
                .filter((node) => !processed.has(node.id))
                .map((node) => node.id);
            if (remaining.length > 0) {
                levels.push(remaining);
            }
        }

        return levels;
    }

    private gatherInputs(node: Node<NodeData>): NodeInputs {
        const definition = getNodeDefinition(node.data.type);
        if (!definition) return {};

        // Use pre-calculated targetEdgesMap for O(1) edge lookup instead of O(E) filtering
        const nodeEdges = this.targetEdgesMap.get(node.id) || [];

        const getSourceData = (
            sourceId: string,
            sourceHandle?: string | null,
        ): NodeData | null => {
            const sourceNode = this.nodesMap.get(sourceId);
            const result = this.executionResults.get(sourceId);
            if (!sourceNode) {
                logger.warn(
                    `[getSourceData] Source node not found: ${sourceId}`,
                );
                return null;
            }

            // Handle custom-workflow (sub-workflow) nodes
            if (sourceNode.data.type === "custom-workflow") {
                // First check executionResults from current run, then fall back to stored node data
                // This is important for single-node execution where upstream nodes weren't re-executed
                const cwData = sourceNode.data as CustomWorkflowData;
                const cwResult = (result as
                    | { results?: Record<string, { value?: unknown }> }
                    | undefined) || { results: cwData.results };

                // Check if we have results from the sub-workflow execution or stored in node data
                if (!cwResult?.results) {
                    logger.warn(
                        `[getSourceData] Custom workflow ${sourceId} has no results. ` +
                            `Has it been executed? Try running the full flow first.`,
                    );
                    return null;
                }

                logger.debug(
                    `[getSourceData] Using ${result ? "execution" : "stored"} results for custom-workflow ${sourceId}`,
                );

                // sourceHandle is required for custom-workflow nodes to identify which output to use
                if (!sourceHandle) {
                    logger.warn(
                        `[getSourceData] Missing sourceHandle for custom-workflow ${sourceId}. ` +
                            `Edge may be misconfigured. Available outputs: ${Object.keys(cwResult.results).join(", ")}`,
                    );
                    // Attempt to use first available output as fallback
                    const outputKeys = Object.keys(cwResult.results);
                    if (outputKeys.length === 1) {
                        logger.info(
                            `[getSourceData] Using single available output: ${outputKeys[0]}`,
                        );
                        const subOutput = cwResult.results[outputKeys[0]];
                        return (subOutput?.value || subOutput) as NodeData;
                    }
                    return null;
                }

                // Look up the specific output by sourceHandle (workflow-output node ID)
                const subOutput = cwResult.results[sourceHandle];
                if (subOutput === undefined) {
                    logger.warn(
                        `[getSourceData] Output "${sourceHandle}" not found in custom-workflow ${sourceId}. ` +
                            `Available outputs: ${Object.keys(cwResult.results).join(", ")}. ` +
                            `The sub-workflow may have been modified.`,
                    );
                    return null;
                }

                logger.debug(
                    `[getSourceData] Extracted sub-workflow output "${sourceHandle}" from ${sourceId}`,
                );

                // Unwraps { value: ... } if it came from a Workflow Output node
                // Use nullish coalescing to handle falsy values like empty strings correctly
                const unwrapped =
                    subOutput?.value !== undefined
                        ? subOutput.value
                        : subOutput;
                return unwrapped as NodeData;
            }

            // For regular nodes, merge node data with execution result
            return { ...sourceNode.data, ...result } as NodeData;
        };

        return definition.gatherInputs(node, nodeEdges, getSourceData);
    }

    private async executeSubWorkflow(
        node: Node<NodeData>,
        inputs: NodeInputs,
    ): Promise<Partial<NodeData>> {
        const data = node.data as CustomWorkflowData;
        if (!data.subWorkflowId) {
            throw new Error("Sub-workflow configuration missing");
        }

        // 1. Fetch custom node definition from the new API
        const baseUrl =
            typeof window !== "undefined"
                ? window.location.origin
                : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        const res = await (this.context.fetch || fetch)(
            `${baseUrl}/api/custom-nodes/${data.subWorkflowId}`,
        );

        if (!res.ok) {
            throw new Error(`Failed to fetch custom node: ${res.statusText}`);
        }

        const customNodeData = await res.json();
        const subNodes = customNodeData.nodes as Node<NodeData>[];
        const subEdges = customNodeData.edges as Edge[];

        // 2. Map external inputs to sub-workflow Input Nodes
        const initializedSubNodes = subNodes.map((n) => {
            if (n.type === "workflow-input") {
                // The key in 'inputs' is the nodeId of the original Workflow Input node
                const providedValue = inputs[n.id];
                if (providedValue !== undefined) {
                    let valueData: Record<string, unknown>;

                    if (
                        typeof providedValue === "object" &&
                        providedValue !== null &&
                        !Array.isArray(providedValue)
                    ) {
                        valueData = {
                            ...(providedValue as Record<string, unknown>),
                        };
                        // We remove 'type' from providedValue to not overwrite n.data.type which is 'workflow-input'
                        delete valueData.type;
                    } else {
                        // For strings, arrays, or other primitives, wrap it in a 'value' field
                        valueData = { value: providedValue };
                    }

                    return {
                        ...n,
                        data: {
                            ...n.data,
                            ...valueData,
                        },
                    };
                }
            }
            return n;
        });

        logger.debug(
            `[WorkflowEngine] Executing custom node ${data.subWorkflowId}`,
        );

        // 3. Execute sub-workflow
        // We use a nested engine.
        // We don't necessarily want to bubble up all internal updates to the main UI
        // to avoid cluttering, but we could if we wanted to show progress inside the sub-graph.
        const subEngine = new WorkflowEngine(
            initializedSubNodes,
            subEdges,
            () => {}, // Silent internal updates for now
            this.context,
        );

        await subEngine.run();

        // 4. Gather results from sub-workflow Output Nodes
        const results: Record<string, Partial<NodeData>> = {};
        const outputNodes = subNodes.filter(
            (n) =>
                n.type === "workflow-output" ||
                n.data?.type === "workflow-output",
        );

        for (const outNode of outputNodes) {
            const outResult = subEngine.executionResults.get(outNode.id);
            if (outResult) {
                // Map the output node's resulting data to its ID
                results[outNode.id] = outResult;
            }
        }

        return { results } as Partial<CustomWorkflowData>;
    }
}
