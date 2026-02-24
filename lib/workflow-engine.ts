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

    // Performance optimizations for large graphs
    private adjacencyList = new Map<string, string[]>();
    private targetEdgesMap = new Map<string, Edge[]>();

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

        // Pre-calculate maps for O(V+E) traversal
        nodes.forEach((n) => {
            this.adjacencyList.set(n.id, []);
            this.targetEdgesMap.set(n.id, []);
        });
        edges.forEach((e) => {
            this.adjacencyList.get(e.source)?.push(e.target);
            this.targetEdgesMap.get(e.target)?.push(e);
        });
    }

    async run() {
        this.validateCustomWorkflowEdges();
        const levels = this.getExecutionLevels();
        for (const level of levels) {
            await Promise.all(level.map((id) => this.executeNodeSync(id)));
        }
    }

    async runFromNode(startNodeId: string) {
        this.validateCustomWorkflowEdges();
        const levels = this.getExecutionLevelsFromNode(startNodeId);
        for (const level of levels) {
            await Promise.all(level.map((id) => this.executeNodeSync(id)));
        }
    }

    private getExecutionLevelsFromNode(startNodeId: string): string[][] {
        const queue = [startNodeId],
            downstream = new Set([startNodeId]);
        let head = 0;
        while (head < queue.length) {
            const current = queue[head++]!;
            for (const targetId of this.adjacencyList.get(current) || []) {
                if (!downstream.has(targetId)) {
                    downstream.add(targetId);
                    queue.push(targetId);
                }
            }
        }
        return this.getExecutionLevels()
            .map((level) => level.filter((id) => downstream.has(id)))
            .filter((level) => level.length > 0);
    }

    private validateCustomWorkflowEdges() {
        for (const edge of this.edges) {
            const sourceNode = this.nodesMap.get(edge.source);
            if (
                sourceNode?.data.type === "custom-workflow" &&
                !edge.sourceHandle
            ) {
                logger.warn(
                    `[WorkflowEngine] Edge ${edge.id} from custom-workflow "${sourceNode.data.name}" (${edge.source}) missing sourceHandle.`,
                );
            }
        }
    }

    async executeNode(nodeId: string) {
        return this.executeNodeSync(nodeId);
    }

    private async executeNodeSync(nodeId: string) {
        const node = this.nodesMap.get(nodeId);
        const definition = node && getNodeDefinition(node.data.type);
        if (!node || !definition) return;

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
                result = { ...node.data };
            } else {
                result = await definition.execute(node, inputs, {
                    ...this.context,
                    onNodeUpdate: this.onNodeUpdate,
                });
            }

            this.executionResults.set(nodeId, result);
            this.onNodeUpdate(nodeId, {
                ...result,
                executing: false,
                generatedAt: Date.now(),
                error: undefined,
            } as Partial<NodeData>);

            this.nodesMap.set(nodeId, {
                ...node,
                data: { ...node.data, ...result },
            } as Node<NodeData>);
        } catch (error) {
            const errorMsg =
                error instanceof Error ? error.message : String(error);
            this.onNodeUpdate(nodeId, {
                executing: false,
                error: errorMsg,
            } as Partial<NodeData>);
            throw error;
        }
    }

    private getExecutionLevels(): string[][] {
        const inDegree = new Map<string, number>();
        Array.from(this.nodesMap.keys()).forEach((id) => inDegree.set(id, 0));
        this.edges.forEach((e) => {
            if (this.nodesMap.has(e.source) && this.nodesMap.has(e.target)) {
                inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
            }
        });

        const levels: string[][] = [],
            processed = new Set<string>();
        let queue = Array.from(inDegree.entries())
            .filter(([_id, d]) => d === 0)
            .map(([id]) => id);

        while (queue.length > 0) {
            levels.push(queue);
            const next: string[] = [];
            for (const id of queue) {
                processed.add(id);
                for (const neighbor of this.adjacencyList.get(id) || []) {
                    inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
                    if (inDegree.get(neighbor) === 0) next.push(neighbor);
                }
            }
            queue = next;
        }

        if (processed.size < this.nodesMap.size) {
            const remaining = Array.from(this.nodesMap.keys()).filter(
                (id) => !processed.has(id),
            );
            if (remaining.length > 0) levels.push(remaining);
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

            if (sourceNode.data.type === "custom-workflow") {
                const cwData = sourceNode.data as CustomWorkflowData;
                const cwResult = (result as {
                    results?: Record<string, { value?: unknown }>;
                }) || {
                    results: cwData.results,
                };
                if (!cwResult?.results) return null;

                const handle = sourceHandle || Object.keys(cwResult.results)[0];
                const subOutput = cwResult.results[handle!];
                if (subOutput === undefined) return null;

                return (
                    subOutput?.value !== undefined ? subOutput.value : subOutput
                ) as NodeData;
            }
            return { ...sourceNode.data, ...result } as NodeData;
        };

        return definition.gatherInputs(
            node,
            this.targetEdgesMap.get(node.id) || [],
            getSourceData,
        );
    }

    private async executeSubWorkflow(
        node: Node<NodeData>,
        inputs: NodeInputs,
    ): Promise<Partial<NodeData>> {
        const data = node.data as CustomWorkflowData;
        if (!data.subWorkflowId)
            throw new Error("Sub-workflow configuration missing");

        const baseUrl =
            typeof window !== "undefined"
                ? window.location.origin
                : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        const res = await (this.context.fetch || fetch)(
            `${baseUrl}/api/custom-nodes/${data.subWorkflowId}`,
        );
        if (!res.ok)
            throw new Error(`Failed to fetch custom node: ${res.statusText}`);

        const customNodeData = await res.json();
        const subNodes = customNodeData.nodes as Node<NodeData>[];
        const subEdges = customNodeData.edges as Edge[];

        const initializedSubNodes = subNodes.map((n) => {
            if (n.type === "workflow-input") {
                const val = inputs[n.id];
                if (val !== undefined) {
                    const valueData =
                        typeof val === "object" &&
                        val !== null &&
                        !Array.isArray(val)
                            ? { ...(val as Record<string, unknown>) }
                            : { value: val };
                    delete (valueData as Record<string, unknown>).type;
                    return { ...n, data: { ...n.data, ...valueData } };
                }
            }
            return n;
        });

        const subEngine = new WorkflowEngine(
            initializedSubNodes,
            subEdges,
            () => {},
            this.context,
        );
        await subEngine.run();

        const results: Record<string, Partial<NodeData>> = {};
        subNodes
            .filter(
                (n) =>
                    n.type === "workflow-output" ||
                    n.data?.type === "workflow-output",
            )
            .forEach((n) => {
                const res = subEngine.executionResults.get(n.id);
                if (res) results[n.id] = res;
            });

        return { results } as Partial<CustomWorkflowData>;
    }
}
