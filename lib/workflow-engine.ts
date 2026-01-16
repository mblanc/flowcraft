import logger from "@/app/logger";
import { Edge, Node } from "@xyflow/react";
import { NodeData, NodeInputs } from "./types";
import { getNodeDefinition, ExecutionContext } from "./node-registry";

export class WorkflowEngine {
    private nodesMap: Map<string, Node<NodeData>>;
    private edges: Edge[];
    private onNodeUpdate: (nodeId: string, data: Partial<NodeData>) => void;
    private executionResults: Map<string, Partial<NodeData>> = new Map();
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
            this.onNodeUpdate(nodeId, { executing: true } as Partial<NodeData>);

            const inputs = this.gatherInputs(node);
            const result = await definition.execute(node, inputs, {
                ...this.context,
                onNodeUpdate: this.onNodeUpdate,
            });

            // Store result for dependent nodes
            this.executionResults.set(nodeId, result);

            // Update node with result
            this.onNodeUpdate(nodeId, {
                ...result,
                executing: false,
                generatedAt: Date.now(),
            } as Partial<NodeData>);

            // Update internal map state for next levels
            const updatedNode: Node<NodeData> = {
                ...node,
                data: { ...node.data, ...result } as NodeData,
            };
            this.nodesMap.set(nodeId, updatedNode);
        } catch (error) {
            logger.error(`Error executing node ${nodeId}:`, error);
            this.onNodeUpdate(nodeId, {
                executing: false,
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

        const getSourceData = (sourceId: string): NodeData | null => {
            const sourceNode = this.nodesMap.get(sourceId);
            const result = this.executionResults.get(sourceId);
            if (!sourceNode) return null;

            return { ...sourceNode.data, ...result } as NodeData;
        };

        return definition.gatherInputs(node, this.edges, getSourceData);
    }
}
