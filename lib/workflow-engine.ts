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
    private adj: Map<string, string[]>;

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

        // Pre-calculate adjacency list (outgoing edges) for O(1) neighbor lookups
        this.adj = new Map();
        for (const nodeId of this.nodesMap.keys()) {
            this.adj.set(nodeId, []);
        }
        for (const edge of this.edges) {
            if (this.adj.has(edge.source)) {
                this.adj.get(edge.source)!.push(edge.target);
            }
        }
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
        const downstreamNodes = new Set<string>();
        downstreamNodes.add(startNodeId);

        // Optimized BFS: use head pointer instead of shift() to avoid O(N) penalties
        // and use pre-calculated adjacency list for O(1) neighbor lookups.
        let head = 0;
        while (head < queue.length) {
            const current = queue[head++];
            const neighbors = this.adj.get(current) || [];
            for (const neighbor of neighbors) {
                if (!downstreamNodes.has(neighbor)) {
                    downstreamNodes.add(neighbor);
                    queue.push(neighbor);
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

    /**
     * Group nodes into execution levels using Kahn's algorithm for topological sorting.
     * Time Complexity: O(V + E) where V is nodes and E is edges.
     * This is significantly faster than the previous O(V^2) approach on large graphs.
     */
    private getExecutionLevels(): string[][] {
        const inDegree = new Map<string, number>();
        for (const nodeId of this.nodesMap.keys()) {
            inDegree.set(nodeId, 0);
        }

        for (const edge of this.edges) {
            if (inDegree.has(edge.target)) {
                inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
            }
        }

        let queue: string[] = [];
        for (const [nodeId, degree] of inDegree.entries()) {
            if (degree === 0) {
                queue.push(nodeId);
            }
        }

        const levels: string[][] = [];
        let processedCount = 0;

        while (queue.length > 0) {
            levels.push(queue);
            processedCount += queue.length;
            const nextQueue: string[] = [];

            for (const nodeId of queue) {
                const neighbors = this.adj.get(nodeId) || [];
                for (const neighbor of neighbors) {
                    const degree = (inDegree.get(neighbor) || 0) - 1;
                    inDegree.set(neighbor, degree);
                    if (degree === 0) {
                        nextQueue.push(neighbor);
                    }
                }
            }
            queue = nextQueue;
        }

        // Handle cycles by grouping all remaining unprocessed nodes into a final level
        if (processedCount < this.nodesMap.size) {
            const remaining: string[] = [];
            for (const [nodeId, degree] of inDegree.entries()) {
                if (degree > 0) {
                    remaining.push(nodeId);
                }
            }
            if (remaining.length > 0) {
                levels.push(remaining);
            }
        }

        return levels;
    }

    private gatherInputs(node: Node<NodeData>): NodeInputs {
        const definition = getNodeDefinition(node.data.type);
        if (!definition) return {};

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

        return definition.gatherInputs(node, this.edges, getSourceData);
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
