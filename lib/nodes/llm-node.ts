import logger from "@/app/logger";
import { Node } from "@xyflow/react";
import {
    LLMData,
    NodeInputs,
    NamedNodeInput,
    NodeDefinition,
    ExecutionContext,
} from "../types";
import {
    getSourceValue,
    isCollectionSource,
    buildFileValues,
    inferMimeType,
    createNamedNodesTracker,
} from "./shared/node-helpers";
import { executeNodeApiCall } from "./shared/execute-api-call";
import {
    resolveInlineMentions,
    appendUnreferencedNodes,
} from "./shared/mention-resolver";

export async function executeLLMNode(
    node: Node<LLMData>,
    inputs: {
        prompts?: string[];
        files?: { url: string; type: string }[];
        namedNodes?: NamedNodeInput[];
    },
    context?: ExecutionContext,
): Promise<Partial<LLMData>> {
    const { namedNodes = [] } = inputs;
    const referencedIds = new Set<string>();

    const parts = resolveInlineMentions(
        node.data.instructions,
        namedNodes,
        referencedIds,
    );

    appendUnreferencedNodes(parts, namedNodes, referencedIds);

    if (parts.length === 0) {
        throw new Error("No prompt available for LLM node");
    }

    logger.info(
        `[Executor] Generating text with ${parts.length} content parts`,
    );

    const data = await executeNodeApiCall<{ text: unknown }>(
        "/api/generate-text",
        {
            parts,
            model: node.data.model,
            outputType: node.data.outputType,
            responseSchema: node.data.responseSchema,
            strictMode: node.data.strictMode,
        },
        context,
    );

    const output =
        typeof data.text === "object"
            ? JSON.stringify(data.text, null, 2)
            : (data.text as string);
    return { output };
}

export const llmNodeDefinition: NodeDefinition<LLMData, NodeInputs> = {
    type: "llm",
    inputs: {
        "prompts-input": "text",
        "file-input": "any",
    },
    outputs: {
        "": "text",
    },
    gatherInputs: (node, edges, getSourceData) => {
        const inputs: NodeInputs = { files: [], prompts: [], namedNodes: [] };
        const tracker = createNamedNodesTracker();

        const promptEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle === "prompts-input",
        );
        for (const edge of promptEdges) {
            const sourceData = getSourceData(edge.source, edge.sourceHandle);
            if (!sourceData) continue;
            const value = getSourceValue(sourceData);

            if (Array.isArray(value) && isCollectionSource(sourceData)) {
                const named = tracker.getOrCreate(edge.source, sourceData);
                named.textValues = value as string[];
                named.textValue = (value as string[])[0] ?? null;
            } else if (typeof value === "string") {
                inputs.prompts?.push(value);
                const named = tracker.getOrCreate(edge.source, sourceData);
                named.textValue = value;
            }
        }

        const fileEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle === "file-input",
        );
        for (const edge of fileEdges) {
            const sourceData = getSourceData(edge.source, edge.sourceHandle);
            if (!sourceData) continue;

            const value = getSourceValue(sourceData);
            if (!value) continue;

            if (Array.isArray(value) && isCollectionSource(sourceData)) {
                const named = tracker.getOrCreate(edge.source, sourceData);
                named.fileValuesList = (value as string[]).map((url) => [
                    { url, type: inferMimeType(url, sourceData) },
                ]);
                named.fileValues = named.fileValuesList[0] || [];
            } else {
                const rawValues = Array.isArray(value) ? value : [value];
                const fileValues = buildFileValues(rawValues, sourceData);

                for (const fv of fileValues) {
                    inputs.files?.push(fv);
                }

                const named = tracker.getOrCreate(edge.source, sourceData);
                named.fileValues.push(...fileValues);
            }
        }

        inputs.namedNodes = tracker.values();
        return inputs;
    },
    execute: (node, inputs, context) => executeLLMNode(node, inputs, context),
};
