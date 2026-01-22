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
    }

    async run() {
        const levels = this.getExecutionLevels();

        for (const level of levels) {
            await Promise.all(
                level.map(async (nodeId) => {
                    await this.executeNodeSync(nodeId);
                }),
            );
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
        const dependencies = new Map<string, Set<string>>();

        nodes.forEach((node) => {
            dependencies.set(node.id, new Set());
        });

        this.edges.forEach((edge) => {
            dependencies.get(edge.target)?.add(edge.source);
        });

        const levels: string[][] = [];
        const processed = new Set<string>();

        while (processed.size < nodes.length) {
            const currentLevel = nodes
                .filter((node) => !processed.has(node.id))
                .filter((node) => {
                    const deps = dependencies.get(node.id);
                    return (
                        !deps ||
                        Array.from(deps).every((dep) => processed.has(dep))
                    );
                })
                .map((node) => node.id);

            if (currentLevel.length === 0) {
                const remaining = nodes.filter(
                    (node) => !processed.has(node.id),
                );
                if (remaining.length > 0) {
                    currentLevel.push(...remaining.map((n) => n.id));
                }
                break;
            }

            levels.push(currentLevel);
            currentLevel.forEach((id) => processed.add(id));
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
            if (!sourceNode) return null;

            if (
                sourceNode.data.type === "custom-workflow" &&
                sourceHandle &&
                result &&
                (result as { results?: Record<string, { value?: unknown }> })
                    .results
            ) {
                // Return the specific output node's data from the sub-workflow
                const results = (
                    result as { results: Record<string, { value?: unknown }> }
                ).results;
                const subOutput = results[sourceHandle];
                // Unwraps { value: ... } if it came from a Workflow Output node
                return (subOutput?.value || subOutput) as NodeData;
            }

            return { ...sourceNode.data, ...result } as NodeData;
        };

        return definition.gatherInputs(node, this.edges, getSourceData);
    }

    private async executeSubWorkflow(
        node: Node<NodeData>,
        inputs: NodeInputs,
    ): Promise<Partial<NodeData>> {
        const data = node.data as CustomWorkflowData;
        if (!data.subWorkflowId || !data.subWorkflowVersion) {
            throw new Error("Sub-workflow configuration missing");
        }

        // 1. Fetch sub-workflow definition
        const baseUrl =
            typeof window !== "undefined"
                ? window.location.origin
                : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        const res = await (this.context.fetch || fetch)(
            `${baseUrl}/api/flows/${data.subWorkflowId}/versions/${data.subWorkflowVersion}`,
        );

        if (!res.ok) {
            throw new Error(`Failed to fetch sub-workflow: ${res.statusText}`);
        }

        const subFlow = await res.json();
        const subNodes = subFlow.nodes as Node<NodeData>[];
        const subEdges = subFlow.edges as Edge[];

        // 2. Map external inputs to sub-workflow Input Nodes
        const initializedSubNodes = subNodes.map((n) => {
            if (n.type === "workflow-input") {
                // The key in 'inputs' is the nodeId of the original Workflow Input node
                const providedValue = inputs[n.id];
                if (providedValue !== undefined) {
                    let valueData: any;
                    
                    if (typeof providedValue === 'object' && providedValue !== null && !Array.isArray(providedValue)) {
                        valueData = { ...providedValue };
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
            `[WorkflowEngine] Executing sub-workflow ${data.subWorkflowId} v${data.subWorkflowVersion}`,
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
