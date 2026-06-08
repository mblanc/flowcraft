/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { GenerateTextSchema } from "@/lib/schemas";
import type { Primitive } from "../types";
import type { LLMData } from "@/lib/types";
import { MODELS } from "@/lib/constants";
import {
    getSourceValue,
    isCollectionSource,
    buildFileValues,
    inferMimeType,
    createNamedNodesTracker,
} from "@/lib/node-adapters/utils/node-helpers";

const llmOutputSchema = z.object({
    text: z.unknown(),
});

export const llmPrimitive: Primitive<
    LLMData,
    any,
    z.infer<typeof GenerateTextSchema>,
    z.infer<typeof llmOutputSchema>
> = {
    id: "llm",
    label: "LLM",
    mediaType: "text",
    requestSchema: GenerateTextSchema,
    outputShape: llmOutputSchema,

    execute: null,

    flow: {
        type: "llm",
        inputs: {
            "prompts-input": "text",
            "file-input": "any",
        },
        outputs: {
            "": "text",
        },
        gatherInputs: (node, edges, getSourceData) => {
            const inputs: any = { files: [], prompts: [], namedNodes: [] };
            const tracker = createNamedNodesTracker();

            const promptEdges = edges.filter(
                (e) =>
                    e.target === node.id && e.targetHandle === "prompts-input",
            );
            for (const edge of promptEdges) {
                const sourceData = getSourceData(
                    edge.source,
                    edge.sourceHandle,
                );
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
                const sourceData = getSourceData(
                    edge.source,
                    edge.sourceHandle,
                );
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
            inputs.instructions = node.data.instructions;
            inputs.model = node.data.model;
            inputs.outputType = node.data.outputType;
            inputs.responseSchema = node.data.responseSchema;
            inputs.strictMode = node.data.strictMode;
            inputs.thinkingLevel = node.data.thinkingLevel;

            return inputs;
        },
        toFlowData: (node, inputs, result) => {
            const output =
                typeof result.text === "object"
                    ? JSON.stringify(result.text, null, 2)
                    : (result.text as string);
            return {
                output,
            };
        },
        mergeResults: (results) => {
            if (results.length === 0) return {};
            const allOutputs = results.map(
                (r) => ((r as Record<string, unknown>).output as string) || "",
            );
            return {
                output: allOutputs[0],
                outputs: allOutputs,
            };
        },
        saveToLibrary: async (node, result, ctx) => {
            const { flowId, flowName, fetch: fetchFn } = ctx;
            const outputText =
                typeof result.text === "object"
                    ? JSON.stringify(result.text, null, 2)
                    : (result.text as string);

            const provenance = {
                sourceType: "flow" as const,
                sourceId: flowId,
                sourceName: flowName ?? "Untitled Flow",
                nodeId: node.id,
                nodeLabel: node.data.name || node.data.type,
                prompt: node.data.instructions,
            };

            await fetchFn("/api/library", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "text",
                    content: outputText,
                    provenance,
                }),
            });
        },
        defaultData: {
            type: "llm",
            name: "LLM",
            model: MODELS.TEXT.GEMINI_3_5_FLASH,
            instructions: "",
            outputType: "text",
            strictMode: false,
            visualSchema: [],
            thinkingLevel: "HIGH",
        },
    },

    canvas: null,
    agent: null,
};
