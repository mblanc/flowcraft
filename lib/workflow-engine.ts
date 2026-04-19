import logger from "@/app/logger";
import { Edge, Node } from "@xyflow/react";
import { BATCH_CONCURRENCY } from "@/lib/constants";
import {
    NodeData,
    NodeInputs,
    CustomWorkflowData,
    NamedNodeInput,
} from "./types";
import { getNodeDefinition, ExecutionContext } from "./node-registry";
import type { LibraryAssetProvenance } from "./library-types";
import { fetchAndCacheSignedUrl } from "@/lib/cache/signed-url-cache";

async function prewarmSignedUrls(result: Partial<NodeData>): Promise<void> {
    const uris: string[] = [];
    if ("images" in result && Array.isArray(result.images)) {
        uris.push(...result.images.filter((u): u is string => !!u?.startsWith("gs://")));
    }
    if ("videos" in result && Array.isArray(result.videos)) {
        uris.push(...result.videos.filter((u): u is string => !!u?.startsWith("gs://")));
    }
    if (uris.length === 0) return;
    await Promise.all(uris.map(fetchAndCacheSignedUrl));
}

// --- Batch / Unfold helpers ---

interface BatchPlan {
    level: 0 | 1 | 2;
    batchSize: number;
    collectionKeys: string[];
}

function detectBatchPlan(inputs: NodeInputs): BatchPlan {
    const collectionKeys: string[] = [];
    const lengths: number[] = [];

    const namedNodes = inputs.namedNodes || [];
    for (const nn of namedNodes) {
        if (nn.textValues && nn.textValues.length > 0) {
            collectionKeys.push(`namedNode:text:${nn.nodeId}`);
            lengths.push(nn.textValues.length);
        }
        if (nn.fileValuesList && nn.fileValuesList.length > 0) {
            collectionKeys.push(`namedNode:file:${nn.nodeId}`);
            lengths.push(nn.fileValuesList.length);
        }
    }

    if (collectionKeys.length === 0) {
        return { level: 0, batchSize: 1, collectionKeys: [] };
    }

    const batchSize = Math.min(...lengths);
    const level = collectionKeys.length === 1 ? 1 : 2;
    return { level: level as 1 | 2, batchSize, collectionKeys };
}

function sliceBatchInputs(
    inputs: NodeInputs,
    _plan: BatchPlan,
    index: number,
): NodeInputs {
    const sliced = { ...inputs };

    if (inputs.namedNodes) {
        sliced.namedNodes = inputs.namedNodes.map((nn): NamedNodeInput => {
            const copy: NamedNodeInput = { ...nn };
            if (nn.textValues) {
                copy.textValue = nn.textValues[index] ?? nn.textValues[0];
                copy.textValues = undefined;
            }
            if (nn.fileValuesList) {
                copy.fileValues =
                    nn.fileValuesList[index] ?? nn.fileValuesList[0];
                copy.fileValuesList = undefined;
                if (copy.fileValues.length > 0) {
                    sliced.image = copy.fileValues[0].url;
                }
            }
            return copy;
        });
    }

    return sliced;
}

function mergeResults(
    results: Partial<NodeData>[],
    nodeType: string,
): Partial<NodeData> {
    if (results.length === 0) return {};

    switch (nodeType) {
        case "image": {
            const allImages = results.flatMap(
                (r) =>
                    ((r as Record<string, unknown>).images as string[]) || [],
            );
            const firstImageResult = results[0] as Record<string, unknown>;
            return {
                images: allImages,
                prompt: firstImageResult?.prompt,
                mediaInputs: firstImageResult?.mediaInputs,
            } as Partial<NodeData>;
        }
        case "llm": {
            const allOutputs = results.map(
                (r) => ((r as Record<string, unknown>).output as string) || "",
            );
            return {
                output: allOutputs[0],
                outputs: allOutputs,
            } as Partial<NodeData>;
        }
        case "video": {
            const allUrls = results.map(
                (r) =>
                    ((r as Record<string, unknown>).videoUrl as string) || "",
            );
            const firstVideoResult = results[0] as Record<string, unknown>;
            return {
                videoUrl: allUrls[0],
                videoUrls: allUrls,
                prompt: firstVideoResult?.prompt,
                mediaInputs: firstVideoResult?.mediaInputs,
            } as Partial<NodeData>;
        }
        case "upscale": {
            const allImages = results.map(
                (r) => ((r as Record<string, unknown>).image as string) || "",
            );
            return {
                image: allImages[0],
                images: allImages,
            } as Partial<NodeData>;
        }
        case "resize": {
            const allOutputs = results.map(
                (r) => ((r as Record<string, unknown>).output as string) || "",
            );
            return {
                output: allOutputs[0],
                outputs: allOutputs,
            } as Partial<NodeData>;
        }
        default:
            return results[0];
    }
}

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

        while (queue.length > 0) {
            const current = queue.shift()!;
            downstreamNodes.add(current);
            const outgoingEdges = this.edges.filter(
                (e) => e.source === current,
            );
            for (const edge of outgoingEdges) {
                if (!downstreamNodes.has(edge.target)) {
                    queue.push(edge.target);
                    downstreamNodes.add(edge.target);
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
        await this.executeUpstreamRouters(nodeId);
        return this.executeNodeSync(nodeId);
    }

    private async executeUpstreamRouters(nodeId: string): Promise<void> {
        const incomingEdges = this.edges.filter((e) => e.target === nodeId);
        for (const edge of incomingEdges) {
            const sourceNode = this.nodesMap.get(edge.source);
            if (sourceNode?.data.type === "router") {
                await this.executeUpstreamRouters(edge.source);
                await this.executeNodeSync(edge.source);
            }
        }
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
                batchTotal: undefined,
                batchProgress: undefined,
            } as Partial<NodeData>);

            const inputs = this.gatherInputs(node);
            let result: Partial<NodeData>;

            if (node.data.type === "custom-workflow") {
                result = await this.executeSubWorkflow(node, inputs);
            } else if (node.data.type === "workflow-input") {
                result = { ...node.data };
            } else {
                const batchPlan = detectBatchPlan(inputs);

                if (batchPlan.level > 0) {
                    this.onNodeUpdate(nodeId, {
                        executing: true,
                        batchTotal: batchPlan.batchSize,
                        batchProgress: 0,
                    } as Partial<NodeData>);

                    logger.info(
                        `[WorkflowEngine] Batch execution: ${node.data.type} node "${node.data.name}" running ${batchPlan.batchSize} iterations`,
                    );

                    let completedCount = 0;
                    const batchResults: Partial<NodeData>[] = new Array(
                        batchPlan.batchSize,
                    );
                    const indices = Array.from(
                        { length: batchPlan.batchSize },
                        (_, i) => i,
                    );
                    const runNext = async (): Promise<void> => {
                        const i = indices.shift();
                        if (i === undefined) return;
                        const singleInputs = sliceBatchInputs(
                            inputs,
                            batchPlan,
                            i,
                        );
                        const singleResult = await definition.execute(
                            node,
                            singleInputs,
                            {
                                ...this.context,
                                onNodeUpdate: this.onNodeUpdate,
                            },
                        );
                        batchResults[i] = singleResult;
                        completedCount++;
                        this.onNodeUpdate(nodeId, {
                            batchProgress: completedCount,
                        } as Partial<NodeData>);
                        return runNext();
                    };
                    await Promise.all(
                        Array.from(
                            {
                                length: Math.min(
                                    BATCH_CONCURRENCY,
                                    batchPlan.batchSize,
                                ),
                            },
                            runNext,
                        ),
                    );

                    result = {
                        ...mergeResults(batchResults, node.data.type),
                        batchTotal: batchPlan.batchSize,
                    } as Partial<NodeData>;
                } else {
                    result = await definition.execute(node, inputs, {
                        ...this.context,
                        onNodeUpdate: this.onNodeUpdate,
                    });
                    (result as Record<string, unknown>).batchTotal = undefined;
                }
            }

            this.executionResults.set(nodeId, result);

            // Pre-warm signed URL cache before updating the node so the first
            // render after execution resolves the URL synchronously (no placeholder flash).
            await prewarmSignedUrls(result);

            // Fire-and-forget: save generated media to library
            this.saveToLibrary(node, result).catch((err) =>
                logger.warn(
                    `[WorkflowEngine] Library save failed for node ${nodeId}:`,
                    err,
                ),
            );

            this.onNodeUpdate(nodeId, {
                ...result,
                executing: false,
                generatedAt: Date.now(),
                error: undefined,
            } as Partial<NodeData>);

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
            throw error;
        }
    }

    private async saveToLibrary(
        node: Node<NodeData>,
        result: Partial<NodeData>,
    ): Promise<void> {
        const { userId, flowId, flowName } = this.context;
        if (!userId || !flowId) return;

        const fetchFn = this.context.fetch ?? fetch;
        const r = result as Record<string, unknown>;
        const provenance: LibraryAssetProvenance = {
            sourceType: "flow",
            sourceId: flowId,
            sourceName: flowName ?? "Untitled Flow",
            nodeId: node.id,
            nodeLabel:
                ((node.data as Record<string, unknown>).label as
                    | string
                    | undefined) ?? node.data.type,
            prompt:
                (r.resolvedPrompt as string | undefined) ??
                (r.prompt as string | undefined) ??
                ((node.data as Record<string, unknown>).prompt as
                    | string
                    | undefined),
            mediaInputs: r.mediaInputs as
                | { url: string; mimeType?: string }[]
                | undefined,
        };

        if (node.data.type === "image") {
            const uris = (r.images as string[] | undefined) ?? [];
            const nodeData = node.data as Record<string, unknown>;
            await Promise.all(
                uris.filter(Boolean).map((gcsUri) =>
                    fetchFn("/api/library", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "image",
                            gcsUri,
                            mimeType: "image/png",
                            aspectRatio: nodeData.aspectRatio,
                            model: nodeData.model,
                            provenance,
                        }),
                    }),
                ),
            );
        } else if (node.data.type === "video") {
            const uris =
                (r.videoUrls as string[] | undefined) ??
                (r.videoUrl ? [r.videoUrl as string] : []);
            const nodeData = node.data as Record<string, unknown>;
            await Promise.all(
                uris.filter(Boolean).map((gcsUri) =>
                    fetchFn("/api/library", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "video",
                            gcsUri,
                            mimeType: "video/mp4",
                            aspectRatio: nodeData.aspectRatio,
                            model: nodeData.model,
                            duration: nodeData.duration,
                            provenance,
                        }),
                    }),
                ),
            );
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
